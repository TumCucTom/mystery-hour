#!/usr/bin/env /home/b5av/alinelena.b5av/mace-lammps-torch-2.6.0/bin/python3
import sys
sys.path.insert(0, '/scratch/b6ar/trvbale.b6ar/.local/lib/python3.11/site-packages')
"""
Find duplicate and recurring questions across all Mystery Hour episodes.

Usage:
  /home/b5av/.../python3 find_duplicates.py
"""
import json, numpy as np
from pathlib import Path
from collections import defaultdict
from sklearn.preprocessing import normalize

OUT_DIR = Path("/scratch/b6ar/trvbale.b6ar/embeddings")

print("Loading data...")
emb = np.load(OUT_DIR / "question_embeddings.npz")["embeddings"]
emb_norm = normalize(emb, axis=1)
with open(OUT_DIR / "question_meta.json") as f:
    meta = json.load(f)

n = len(meta)
print(f"Total questions: {n}")

# ── Exact duplicates (exact same question text) ───────────────────────────────
print("\n=== EXACT DUPLICATE QUESTIONS ===")
text_to_episodes = defaultdict(list)
for i, q in enumerate(meta):
    txt = (q.get("question") or "").strip()
    if txt:
        text_to_episodes[txt].append(q.get("episode") or "unknown")

exact_dups = [(len(eps), txt) for txt, eps in text_to_episodes.items() if len(eps) >= 2 and len(txt) > 10]
exact_dups.sort(key=lambda x: -x[0])
print(f"Found {len(exact_dups)} questions asked multiple times:")
for count, txt in exact_dups[:20]:
    eps = list(set(text_to_episodes[txt]))
    print(f"  [{count}x] {txt[:80]}...")
    print(f"       Episodes: {', '.join(sorted(eps)[:8])}")

# Save
with open(OUT_DIR / "recurring_questions.json", "w") as f:
    json.dump([{"question": txt, "count": c, "episodes": sorted(set(text_to_episodes[txt]))}
              for c, txt in exact_dups], f, indent=2)
print(f"\nSaved recurring_questions.json ({len(exact_dups)} recurring Qs)")

# ── Near-duplicate via embedding similarity ────────────────────────────────────
print("\n\n=== NEAR-DUPLICATE PAIRS (embedding sim > 0.88) ===")
THRESHOLD = 0.88
BATCH = 400
pairs = []
for start in range(0, n, BATCH):
    end = min(start + BATCH, n)
    batch_emb = emb_norm[start:end]
    sims = batch_emb @ emb_norm.T
    for bi in range(end - start):
        gi = start + bi
        row = sims[bi]
        for j in range(gi + 1, n):
            if row[j] > THRESHOLD:
                pairs.append((gi, j, round(float(row[j]), 4)))
print(f"Found {len(pairs)} near-duplicate pairs")

# Cluster pairs into chains
visited = set()
chains = []
for i, j, sim in sorted(pairs, key=lambda x: -x[2]):
    if i in visited and j in visited:
        continue
    chain = list(set([i, j]))
    visited.update(chain)
    for i2, j2, sim2 in pairs:
        if i2 in chain and j2 not in visited:
            chain.append(j2); visited.add(j2)
        if j2 in chain and i2 not in visited:
            chain.append(i2); visited.add(i2)
    chains.append(sorted(chain))

chains.sort(key=lambda x: -len(x))
print(f"Grouped into {len(chains)} chains")
print("\nTop 10 chains by size:")
for ci, chain in enumerate(chains[:10]):
    print(f"\n  Chain {ci+1} ({len(chain)} questions, sim > {THRESHOLD}):")
    for idx in chain[:5]:
        q = meta[idx]
        ep = (q.get("episode") or "?")
        qt = (q.get("question") or "?")[:80]
        print(f"    [{idx}] {ep}: {qt}...")

with open(OUT_DIR / "duplicates.json", "w") as f:
    json.dump([{"chain_size": len(c), "indices": c,
               "examples": [{"episode": meta[i].get("episode","?"), "question": meta[i].get("question","")}
                            for i in c[:3]]}
              for c in chains], f, indent=2)
print(f"\nSaved duplicates.json ({len(chains)} chains)")
print("\nDone!")