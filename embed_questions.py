#!/usr/bin/env python3
"""
Embed all Mystery Hour questions using BAAI/bge-base-en-v1.5 via HuggingFace Inference API.
Each question text is embedded as a 768-dim vector using the free Inference API.

Usage:
  python3 embed_questions.py [--batch-size 32]
"""

import json
import os
import sys
import time
import subprocess
import numpy as np
from pathlib import Path
from typing import Optional, List

# ── Config ────────────────────────────────────────────────────────────────────
SCRIPT_DIR = Path(__file__).parent
ALL_QA_PATH = os.environ.get("ALL_QA", str(SCRIPT_DIR.parent / "all_qa.json"))
EMBEDDINGS_PATH = os.environ.get("EMBEDDINGS", str(SCRIPT_DIR.parent / "embeddings" / "question_embeddings.npz"))
HF_TOKEN = os.environ.get("HF_TOKEN", "")
BATCH_SIZE = int(os.environ.get("BATCH_SIZE", "32"))
MODEL = "BAAI/bge-base-en-v1.5"
API_URL = f"https://api-inference.huggingface.co/pipeline/feature-extraction/{MODEL}"
EMBED_DIM = 768

os.makedirs(Path(EMBEDDINGS_PATH).parent, exist_ok=True)

# ── Embedding via HF Inference API ────────────────────────────────────────────
def embed_texts(texts: List[str], token: str) -> Optional[np.ndarray]:
    """Call HF Inference API to embed texts using BAAI/bge-base-en-v1.5."""
    if not token:
        raise ValueError("HF_TOKEN not set — get one at https://huggingface.co/settings/tokens")

    payload = {
        "inputs": texts,
        "options": {"wait_for_model": True},
    }

    curl_cmd = [
        "curl", "-s", "-X", "POST", API_URL,
        "-H", f"Authorization: Bearer {token}",
        "-H", "Content-Type: application/json",
        "-d", json.dumps(payload),
        "--max-time", "120",
    ]

    proc = subprocess.run(curl_cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, timeout=150)
    stdout = proc.stdout.decode("utf-8") if isinstance(proc.stdout, bytes) else proc.stdout
    stderr = proc.stderr.decode("utf-8") if isinstance(proc.stderr, bytes) else proc.stderr

    if proc.returncode != 0:
        raise RuntimeError(f"curl failed: {stderr}")

    try:
        vectors = json.loads(stdout)
    except json.JSONDecodeError:
        raise RuntimeError(f"Invalid JSON response: {stdout[:500]}")

    if isinstance(vectors, dict) and "error" in vectors:
        # Rate limited or model loading — wait and retry
        err = vectors["error"]
        if "loading" in str(err).lower():
            wait = int(vectors.get("estimated_time", 30))
            print(f"  Model loading, waiting {wait}s...")
            time.sleep(wait + 5)
            return None
        raise RuntimeError(f"HF API error: {err}")

    if not isinstance(vectors, list) or len(vectors) != len(texts):
        raise RuntimeError(f"Unexpected response length: {len(vectors)} vs {len(texts)}")

    return np.array(vectors, dtype=np.float32)


def embed_with_retry(texts: List[str], token: str, max_retries: int = 3) -> np.ndarray:
    """Embed with retry loop for model-loading delays."""
    for attempt in range(max_retries):
        result = embed_texts(texts, token)
        if result is not None:
            return result
        time.sleep(10 * (attempt + 1))
    raise RuntimeError(f"Failed after {max_retries} retries")


# ── Main ──────────────────────────────────────────────────────────────────────
def main():
    print(f"Loading {ALL_QA_PATH}...")
    with open(ALL_QA_PATH) as f:
        all_qa = json.load(f)

    # Collect all (episode_idx, question_idx, question_text) triples
    questions = []
    for ep_idx, episode in enumerate(all_qa["episodes"]):
        for q_idx, q in enumerate(episode.get("questions", [])):
            if "question" not in q:
                continue  # skip malformed
            questions.append({
                "episode_idx": ep_idx,
                "question_idx": q_idx,
                "question": q["question"],
                "caller": q.get("caller", ""),
                "episode": episode.get("episode", f"ep_{ep_idx:03d}"),
            })

    print(f"Total questions: {len(questions)}")
    n = len(questions)

    # Check for existing embeddings (resume support)
    embeddings = None
    done_indices = set()
    if Path(EMBEDDINGS_PATH).exists():
        data = np.load(EMBEDDINGS_PATH, allow_pickle=True)
        embeddings = data["embeddings"]
        done_indices = set(data.get("done_indices", []))
        print(f"Resuming from {len(done_indices)} already-embedded questions")

    if embeddings is None:
        embeddings = np.zeros((n, EMBED_DIM), dtype=np.float32)

    # Batched embedding
    to_process = [(i, q) for i, q in enumerate(questions) if i not in done_indices]
    print(f"To embed: {len(to_process)}")

    for batch_start in range(0, len(to_process), BATCH_SIZE):
        batch = to_process[batch_start: batch_start + BATCH_SIZE]
        indices = [b[0] for b in batch]
        texts = [b[1]["question"] for b in batch]

        print(f"  Batch {batch_start // BATCH_SIZE + 1}/{(len(to_process) + BATCH_SIZE - 1) // BATCH_SIZE} "
              f"[{batch_start + len(batch)}/{len(to_process)}] — {len(texts)} texts")

        try:
            vecs = embed_with_retry(texts, HF_TOKEN)
            for j, idx in enumerate(indices):
                embeddings[idx] = vecs[j]
                done_indices.add(idx)
        except Exception as e:
            print(f"  Batch failed: {e}")
            # Save partial progress
            np.savez(EMBEDDINGS_PATH, embeddings=embeddings, done_indices=list(done_indices))
            sys.exit(1)

        # Save checkpoint every 10 batches
        if (batch_start // BATCH_SIZE + 1) % 10 == 0:
            np.savez(EMBEDDINGS_PATH, embeddings=embeddings, done_indices=list(done_indices))
            print(f"  Checkpoint saved")

    # Final save
    np.savez(EMBEDDINGS_PATH, embeddings=embeddings, done_indices=list(done_indices))
    print(f"\nSaved {n} embeddings → {EMBEDDINGS_PATH}")
    print(f"Shape: {embeddings.shape}")

    # Also save question metadata for downstream use
    meta_path = Path(EMBEDDINGS_PATH).parent / "question_meta.json"
    with open(meta_path, "w") as f:
        json.dump(questions, f, indent=2)
    print(f"Saved metadata → {meta_path}")


if __name__ == "__main__":
    main()