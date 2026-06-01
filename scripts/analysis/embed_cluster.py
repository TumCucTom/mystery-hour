#!/usr/bin/env /home/b5av/alinelena.b5av/mace-lammps-torch-2.6.0/bin/python3
import sys
# Add huggingface_hub from scratch
sys.path.insert(0, '/scratch/b6ar/trvbale.b6ar/.local/lib/python3.11/site-packages')
"""
Embed all Mystery Hour questions using BAAI/bge-base-en-v1.5 via HuggingFace InferenceClient.
Then run KMeans clustering and save cluster labels.

Usage:
  HF_TOKEN=xxx python3 embed_cluster.py [--batch-size 32]
"""

import json
import os
import sys
import time
import numpy as np
from pathlib import Path
from typing import List, Optional

# ── Config ────────────────────────────────────────────────────────────────────
SCRIPT_DIR = Path(__file__).parent
ALL_QA_PATH = os.environ.get("ALL_QA", str(SCRIPT_DIR.parent / "all_qa.json"))
HF_TOKEN = os.environ.get("HF_TOKEN", "")
BATCH_SIZE = int(os.environ.get("BATCH_SIZE", "32"))
MODEL = "BAAI/bge-base-en-v1.5"
EMBED_DIM = 768
N_CLUSTERS = int(os.environ.get("N_CLUSTERS", "50"))

os.environ["HF_TOKEN"] = HF_TOKEN

OUT_EMBED = str(SCRIPT_DIR.parent / "embeddings" / "question_embeddings.npz")
OUT_META = str(SCRIPT_DIR.parent / "embeddings" / "question_meta.json")
OUT_CLUSTERS = str(SCRIPT_DIR.parent / "embeddings" / "cluster_labels.npz")
OUT_STATS = str(SCRIPT_DIR.parent / "embeddings" / "cluster_stats.json")

Path(OUT_EMBED).parent.mkdir(exist_ok=True)

# ── Embed via HuggingFace InferenceClient ────────────────────────────────────
def embed_batch(texts: List[str], client) -> np.ndarray:
    """Embed a batch of texts using HF InferenceClient with auto-retry on model loading."""
    while True:
        try:
            vecs = client.feature_extraction(texts, model=MODEL)
            # client returns np.ndarray of shape (n, 768)
            return np.array(vecs, dtype=np.float32)
        except Exception as e:
            err = str(e).lower()
            if "loading" in err or "currently loading" in err or "model is loading" in err:
                print(f"    Model loading, waiting 30s...")
                time.sleep(30)
                continue
            raise


# ── Main ──────────────────────────────────────────────────────────────────────
def main():
    from huggingface_hub import InferenceClient

    print(f"Loading {ALL_QA_PATH}...")
    with open(ALL_QA_PATH) as f:
        all_qa = json.load(f)

    # Collect all questions
    questions = []
    for ep_idx, episode in enumerate(all_qa["episodes"]):
        for q_idx, q in enumerate(episode.get("questions", [])):
            if "question" not in q:
                continue
            questions.append({
                "episode_idx": ep_idx,
                "question_idx": q_idx,
                "question": q["question"],
                "caller": q.get("caller", ""),
                "episode": episode.get("episode", f"ep_{ep_idx:03d}"),
                "resolved": q.get("resolved", False),
                "n_answers": len(q.get("answers", [])),
            })

    n = len(questions)
    print(f"Total questions: {n}")

    # Load or build embeddings
    if Path(OUT_EMBED).exists():
        data = np.load(OUT_EMBED)
        embeddings = data["embeddings"]
        done_count = embeddings.shape[0]
        print(f"Loaded {done_count} embeddings from cache")
    else:
        embeddings = np.zeros((n, EMBED_DIM), dtype=np.float32)

    client = InferenceClient(token=HF_TOKEN)

    # Embed in batches, checkpointing every 20 batches
    batch_times = []
    for batch_start in range(0, n, BATCH_SIZE):
        batch_end = min(batch_start + BATCH_SIZE, n)
        texts = [questions[i]["question"] for i in range(batch_start, batch_end)]

        t0 = time.time()
        try:
            vecs = embed_batch(texts, client)
        except Exception as e:
            print(f"  Batch {batch_start} failed: {e}")
            # Save partial and exit
            np.savez(OUT_EMBED, embeddings=embeddings)
            sys.exit(1)

        elapsed = time.time() - t0
        batch_times.append(elapsed)

        for j, idx in enumerate(range(batch_start, batch_end)):
            embeddings[idx] = vecs[j]

        eta = (sum(batch_times) / len(batch_times)) * ((n - batch_end) / BATCH_SIZE)
        print(f"  [{batch_end}/{n}] batch {len(batch_times)} — {elapsed:.1f}s avg — ETA {eta/60:.1f}min")

        if len(batch_times) % 20 == 0:
            np.savez(OUT_EMBED, embeddings=embeddings)
            print(f"  Checkpoint saved")

    # Final save
    np.savez(OUT_EMBED, embeddings=embeddings)
    print(f"\nEmbeddings saved: {OUT_EMBED} — shape {embeddings.shape}")

    # Save metadata
    with open(OUT_META, "w") as f:
        json.dump(questions, f, indent=2)
    print(f"Metadata saved: {OUT_META}")

    # ── Clustering ───────────────────────────────────────────────────────────
    print(f"\nRunning KMeans (k={N_CLUSTERS})...")
    from sklearn.cluster import KMeans
    from sklearn.preprocessing import normalize

    # L2-normalize embeddings before clustering
    embeddings_norm = normalize(embeddings, axis=1)

    kmeans = KMeans(n_clusters=N_CLUSTERS, random_state=42, n_init=10, max_iter=300)
    labels = kmeans.fit_predict(embeddings_norm)

    np.savez(OUT_CLUSTERS, labels=labels)
    print(f"Cluster labels saved: {OUT_CLUSTERS}")

    # ── Cluster stats ─────────────────────────────────────────────────────────
    # Per-cluster: size, resolution rate, avg n_answers, top keywords
    from collections import Counter
    import re

    cluster_stats = []
    for c in range(N_CLUSTERS):
        indices = [i for i, l in enumerate(labels) if l == c]
        qs = [questions[i] for i in indices]

        # Top keywords from question texts
        all_text = " ".join((q.get("question") or "") for q in qs).lower()
        words = re.findall(r'\b[a-z]{4,}\b', all_text)
        top_words = [w for w, _ in Counter(words).most_common(8)]

        cluster_stats.append({
            "cluster_id": c,
            "size": len(qs),
            "resolved_rate": round(sum(1 for q in qs if q["resolved"]) / len(qs), 3) if qs else 0,
            "avg_answers": round(sum(q["n_answers"] for q in qs) / len(qs), 2) if qs else 0,
            "top_words": top_words,
            "example_questions": [qs[0]["question"], qs[len(qs)//2]["question"]] if len(qs) > 1 else [qs[0]["question"]]
        })

    cluster_stats.sort(key=lambda x: -x["size"])

    with open(OUT_STATS, "w") as f:
        json.dump({
            "n_clusters": N_CLUSTERS,
            "n_questions": n,
            "clusters": cluster_stats
        }, f, indent=2)

    print(f"\nCluster stats saved: {OUT_STATS}")
    print("\nTop 10 clusters by size:")
    for cs in cluster_stats[:10]:
        print(f"  Cluster {cs['cluster_id']:2d}: n={cs['size']:3d}, "
              f"resolved={cs['resolved_rate']:.0%}, "
              f"avg_ans={cs['avg_answers']:.1f}, "
              f"words: {', '.join(cs['top_words'][:5])}")

    print("\nDone!")


if __name__ == "__main__":
    main()