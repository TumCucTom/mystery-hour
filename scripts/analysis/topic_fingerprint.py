#!/usr/bin/env python3
"""
topic_fingerprint.py — Per-episode cluster distribution.

For each episode, compute the fraction of questions belonging to each cluster
(k=80). This gives a "fingerprint" — what topics dominated each episode.

Also computes topic_drift data: stacked area chart of cluster composition over
episode index (sorted chronologically).

Outputs:
  - episode_fingerprints.json   # per-episode cluster fractions
  - topic_drift.json             # stacked area data for time-series visualization
"""

import json
import numpy as np
from pathlib import Path

SCRATCH    = Path("/scratch/b6ar/trvbale.b6ar")
EMBED_DIR  = SCRATCH / "embeddings"
DATA       = SCRATCH / "all_qa.json"
K80_LABELS  = np.load(EMBED_DIR / "kmeans_k80_labels.npz")["labels"]  # (6097,)
META_JSON  = EMBED_DIR / "question_meta.json"
OUT_FP     = EMBED_DIR / "episode_fingerprints.json"
OUT_DRIFT  = EMBED_DIR / "topic_drift.json"
N_CLUSTERS = 80

def main():
    # ── Load question meta ─────────────────────────────────────
    with open(META_JSON) as f:
        meta = json.load(f)   # list of {episode, question, ...}

    # Build: episode -> list of cluster labels
    ep_labels = {}   # ep_id -> [label, ...]
    for i, m in enumerate(meta):
        ep = m.get("episode", f"ep_{i:03d}")
        ep_labels.setdefault(ep, []).append(int(K80_LABELS[i]))

    # ── Load episode order from all_qa ──────────────────────────
    with open(DATA) as f:
        all_qa = json.load(f)
    episodes = all_qa.get("episodes", [])

    # Sort episodes by their numeric index
    def ep_num(ep_id):
        try:
            return int(ep_id.split("_")[1])
        except:
            return 0

    sorted_eps = sorted(episodes, key=lambda e: ep_num(e.get("episode", "ep_000")))

    # ── Compute fingerprints ────────────────────────────────────
    fingerprints = []
    for ep in sorted_eps:
        ep_id = ep.get("episode", "?")
        labels = ep_labels.get(ep_id, [])
        total  = len(labels) or 1

        # Count per cluster
        counts = np.zeros(N_CLUSTERS, dtype=float)
        for l in labels:
            counts[l] += 1

        # Fraction
        frac = (counts / total).tolist()

        fingerprints.append({
            "episode": ep_id,
            "n_questions": len(labels),
            "distribution": frac,   # 80 floats summing to 1.0
        })

    # ── Compute topic drift (stacked area data) ─────────────────
    # X axis = episode index (sorted)
    # Y axis = fraction per cluster, top N clusters only (for readability)
    # For the area chart we show the top 10 most-variable clusters

    # Find clusters with most variation across episodes (most "interesting")
    dist_matrix = np.array([fp["distribution"] for fp in fingerprints])  # (n_ep, 80)
    cluster_vars = dist_matrix.var(axis=0)
    top_clusters  = cluster_vars.argsort()[-10:][::-1]  # top 10 most variable cluster IDs

    # Labels for top clusters (use cluster index + size for label)
    cluster_sizes = K80_LABELS  # (6097,)
    cluster_label = {c: f"Cluster {c} ({int((cluster_sizes == c).sum())} Q)" for c in top_clusters}

    drift_data = {
        "episodes": [ep["episode"] for ep in sorted_eps],
        "clusters": [int(c) for c in top_clusters],
        "cluster_labels": [cluster_label[c] for c in top_clusters],
        "series": [
            {
                "cluster_id": int(c),
                "label": cluster_label[c],
                "values": dist_matrix[:, c].tolist(),
            }
            for c in top_clusters
        ],
    }

    # ── Save outputs ────────────────────────────────────────────
    with open(OUT_FP, "w") as f:
        json.dump({"fingerprints": fingerprints}, f, indent=2)
    print(f"Fingerprints → {OUT_FP}  ({len(fingerprints)} episodes)")

    with open(OUT_DRIFT, "w") as f:
        json.dump(drift_data, f, indent=2)
    print(f"Topic drift  → {OUT_DRIFT}")

    # ── Print top clusters info ─────────────────────────────────
    print(f"\nTop 10 most variable clusters (by episode-to-episode variance):")
    for c in top_clusters:
        size = int((cluster_sizes == c).sum())
        var  = cluster_vars[c]
        print(f"  Cluster {c:>3}: {size:>4} questions, variance={var:.4f}")

if __name__ == "__main__":
    main()