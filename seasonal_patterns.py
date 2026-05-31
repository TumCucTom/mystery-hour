#!/usr/bin/env python3
"""
seasonal_patterns.py — Do Christmas/summer episodes have different topics?
"""

import json
import numpy as np
from pathlib import Path

SCRATCH   = Path("/scratch/b6ar/trvbale.b6ar")
EMBED_DIR = SCRATCH / "embeddings"
DATA      = SCRATCH / "all_qa.json"
OUT       = EMBED_DIR / "seasonal_patterns.json"

def ep_num(ep_id):
    try:
        return int(ep_id.split("_")[1])
    except:
        return 0

def estimate_month(ep_idx):
    return int((ep_idx % 52) * 12 / 52)

with open(EMBED_DIR / "question_meta.json") as f:
    meta = json.load(f)

with open(DATA) as f:
    episodes_raw = json.load(f).get("episodes", [])

episodes = sorted(episodes_raw, key=lambda e: ep_num(e.get("episode", "ep_000")))

K80_LABELS = np.load(EMBED_DIR / "kmeans_k80_labels.npz")["labels"]
ep_labels = {}
for i, m in enumerate(meta):
    ep = m.get("episode", f"ep_{i:03d}")
    ep_labels.setdefault(ep, []).append(int(K80_LABELS[i]))

seasons = {'christmas': [], 'summer': [], 'spring': [], 'autumn': [], 'covid': [], 'winter_non_christmas': []}
for ep in episodes:
    ep_id  = ep.get("episode", "?")
    idx    = ep_num(ep_id)
    month  = estimate_month(idx)
    year   = 2007 + idx / 52
    labels = ep_labels.get(ep_id, [])
    total  = len(labels) or 1

    if month in [11, 12, 1]:
        seasons['christmas'].append({'ep': ep_id, 'labels': labels, 'total': total, 'year': int(year)})
    elif month in [6, 7, 8]:
        seasons['summer'].append({'ep': ep_id, 'labels': labels, 'total': total, 'year': int(year)})
    elif month in [3, 4, 5]:
        seasons['spring'].append({'ep': ep_id, 'labels': labels, 'total': total, 'year': int(year)})
    elif month in [9, 10]:
        seasons['autumn'].append({'ep': ep_id, 'labels': labels, 'total': total, 'year': int(year)})
    else:
        seasons['winter_non_christmas'].append({'ep': ep_id, 'labels': labels, 'total': total, 'year': int(year)})

    if 2020 <= year <= 2021:
        seasons['covid'].append({'ep': ep_id, 'labels': labels, 'total': total, 'year': int(year)})

def cluster_composition(eps_list):
    counts = np.zeros(80, dtype=float)
    for e in eps_list:
        for l in e['labels']:
            counts[l] += 1
    total = counts.sum() or 1
    return (counts / total).tolist()

result = {}
for season, eps_list in seasons.items():
    if not eps_list:
        continue
    comp = cluster_composition(eps_list)
    top5 = sorted(enumerate(comp), key=lambda x: -x[1])[:5]
    result[season] = {
        'n_episodes': len(eps_list),
        'n_questions': sum(e['total'] for e in eps_list),
        'composition': comp,
        'top_clusters': [{'id': i, 'frac': round(f, 3)} for i, f in top5],
    }

print("Seasonal Patterns:")
for s, d in result.items():
    top_labels = [f"c{x['id']}({x['frac']})" for x in d['top_clusters']]
    print(f"  {s:<25}: {d['n_episodes']:>3} eps, top clusters: {top_labels}")

with open(OUT, "w") as f:
    json.dump(result, f, indent=2)
print(f"Saved -> {OUT}")