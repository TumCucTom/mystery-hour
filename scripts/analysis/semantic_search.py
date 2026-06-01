#!/usr/bin/env python3
"""
semantic_search.py — "Ask the Dataset"

Builds question_vectors.json from pre-computed embeddings (question_embeddings.npz).
The browser loads this JSON, normalizes vectors at startup, and performs
in-memory cosine similarity search (dot product) against any user query.

Smoke test: queries the index with "why is the sky blue" and prints top-5 matches.
"""

import json
import numpy as np
from pathlib import Path

SCRATCH   = Path("/scratch/b6ar/trvbale.b6ar")
EMBED_DIR = SCRATCH / "embeddings"
META_JSON = EMBED_DIR / "question_meta.json"
EMB_NPZ   = EMBED_DIR / "question_embeddings.npz"
OUT_VEC   = EMBED_DIR / "question_vectors.json"

def main():
    # ── Load embeddings ─────────────────────────────────────────
    emb_matrix = np.load(EMB_NPZ)["embeddings"].astype(np.float32)   # (6097, 768)
    print(f"Loaded embeddings: {emb_matrix.shape}")

    # L2-normalize for cosine similarity
    norms = np.linalg.norm(emb_matrix, axis=1, keepdims=True)
    norms[norms == 0] = 1
    emb_matrix_norm = emb_matrix / norms

    # ── Load meta ────────────────────────────────────────────────
    with open(META_JSON) as f:
        meta = json.load(f)
    print(f"Loaded meta: {len(meta)} questions")

    # ── Build JSON records (store normalized embeddings) ─────────
    # Each vector: 768 floats × 4 bytes = ~3KB per question → ~18MB total
    # This is acceptable for a one-time build, loaded once by the browser.
    records = []
    for i, m in enumerate(meta):
        records.append({
            "idx":      i,
            "episode":  m.get("episode", "?"),
            "question": m.get("question", ""),
            "caller":   m.get("caller", ""),
            "resolved": m.get("resolved", False),
            "n_answers": m.get("n_answers", 0),
            "embedding": emb_matrix_norm[i].tolist(),
        })

    with open(OUT_VEC, "w") as f:
        json.dump({"questions": records, "dims": 768}, f)

    size_mb = Path(OUT_VEC).stat().st_size / 1024 / 1024
    print(f"Saved → {OUT_VEC}  ({len(records)} questions, {size_mb:.1f}MB)")

    # ── Smoke test ───────────────────────────────────────────────
    # Use stored vectors for test (dot product with stored normalized vectors)
    # We don't re-embed; just simulate "why is the sky blue" by using the
    # mean of all "why" questions as a proxy query vector
    why_indices = [i for i, m in enumerate(meta) if (m.get("question") or "").lower().startswith("why")]
    if why_indices:
        query_vec = emb_matrix_norm[why_indices].mean(axis=0)
        query_vec = query_vec / np.linalg.norm(query_vec)
    else:
        query_vec = emb_matrix_norm[0]

    scores    = emb_matrix_norm @ query_vec
    top5_idx  = scores.argsort()[-5:][::-1]

    print("\nSmoke test — query 'why is the sky blue' (proxy: mean of 'why…' questions):")
    for idx in top5_idx:
        r = records[idx]
        print(f"  [{r['episode']}] score={scores[idx]:.3f} | {r['question'][:80]}")

if __name__ == "__main__":
    main()