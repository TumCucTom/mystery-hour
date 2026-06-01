#!/usr/bin/env python3
"""
topic_drift.py — Compute per-episode cluster composition over time.
Uses pre-computed cluster labels + episode fingerprints.

Outputs topic_drift.json with stacked area chart data:
  episodes[], clusters[], series[{cluster_id, label, values[]}]
"""

import json, numpy as np
from pathlib import Path

SCRATCH   = Path("/scratch/b6ar/trvbale.b6ar")
EMBED_DIR = SCRATCH / "embeddings"
DATA      = SCRATCH / "all_qa.json"
K80_LABELS = np.load(EMBED_DIR / "kmeans_k80_labels.npz")["labels"]

def ep_num(ep_id):
    try:
        return int(ep_id.split("_")[1])
    except:
        return 0

with open(EMBED_DIR / "question_meta.json") as f:
    meta = json.load(f)

with open(DATA) as f:
    episodes = sorted(json.load(f).get("episodes", []), key=lambda e: ep_num(e["episode"]))

# Build ep -> list of cluster labels
ep_labels = {}
for i, m in enumerate(meta):
    ep = m.get("episode", f"ep_{i:03d}")
    ep_labels.setdefault(ep, []).append(int(K80_LABELS[i]))

N = len(episodes)
dist_matrix = np.zeros((N, 80), dtype=float)
for col, ep in enumerate(episodes):
    labels = ep_labels.get(ep["episode"], [])
    total  = len(labels) or 1
    for l in labels:
        dist_matrix[col, l] += 1
    dist_matrix[col] /= total

# Top 10 most variable clusters
vars_ = dist_matrix.var(axis=0)
top10 = vars_.argsort()[-10:][::-1]

cluster_sizes = K80_LABELS
series = []
for c in top10:
    size = int((cluster_sizes == c).sum())
    series.append({
        "cluster_id": int(c),
        "label": f"Cluster {c} ({size} Q)",
        "values": dist_matrix[:, c].tolist(),
    })

out = {
    "episodes": [e["episode"] for e in episodes],
    "clusters": [int(c) for c in top10],
    "series": series,
}
with open(EMBED_DIR / "topic_drift.json", "w") as f:
    json.dump(out, f, indent=2)
print(f"topic_drift.json → {len(episodes)} episodes, top 10 clusters: {[int(c) for c in top10]}")