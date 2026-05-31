#!/usr/bin/env /home/b5av/alinelena.b5av/mace-lammps-torch-2.6.0/bin/python3
import sys
sys.path.insert(0, '/scratch/b6ar/trvbale.b6ar/.local/lib/python3.11/site-packages')
"""
Fast, high-quality clustering of Mystery Hour questions using MiniLM + KMeans.
Run range of k to find good semantic granularity.

Usage:
  HF_TOKEN=xxx /home/b5av/.../python3 cluster_final.py [--k 200]
"""

import json, os, re, numpy as np
from pathlib import Path
from collections import Counter

OUT_DIR = Path("/scratch/b6ar/trvbale.b6ar/embeddings")
ALL_QA = "/scratch/b6ar/trvbale.b6ar/all_qa.json"

STOPWORDS = {
    'the','a','an','and','or','but','in','on','at','to','for','of','with',
    'by','from','as','is','was','are','were','be','been','being','have','has',
    'had','do','does','did','will','would','could','should','may','might',
    'must','shall','can','this','that','these','those','what','which','who',
    'whom','when','where','why','how','all','each','every','both','few','more',
    'most','other','some','such','no','nor','not','only','own','same','so',
    'than','too','very','just','about','into','through','during','before',
    'after','above','below','between','under','again','further','then',
    'once','here','there','call','called','calling','calls','ask','asked',
    'ask','asks','tell','told','get','got','getting','go','going','went',
    'gone','come','came','make','made','take','took','give','gave',
    'know','knew','seen','see','use','used','find','found','want','wanted',
    'need','seem','seemed','they','them','their','she','her','you','your',
    'we','us','our','it','its','i','me','my','what','that','this','ve','re',
    'll','don','really','thing','things','way','ways','something','anything',
    'everything','nothing','someone','anyone','everyone','always','never',
    'ever','even','still','though','because','since','while','if','whether',
    'one','two','s','t','doesn','wasn','isn','couldn','wouldn','shouldn',
    'let\'s','you\'re','we\'re','they\'re','i\'m','it\'s','that\'s','what\'s',
}

# ── Load ──────────────────────────────────────────────────────────────────────
print("Loading embeddings and metadata...")
embeddings = np.load(OUT_DIR / "question_embeddings.npz")["embeddings"]
with open(OUT_DIR / "question_meta.json") as f:
    meta = json.load(f)
print(f"  {embeddings.shape[0]} questions × {embeddings.shape[1]} dims")

# ── L2 normalize (cosine similarity = dot product in this space) ───────────
from sklearn.preprocessing import normalize
embeddings_norm = normalize(embeddings, axis=1)

# ── Run KMeans for range of k to find good granularity ──────────────────────
from sklearn.cluster import KMeans

for k in [80, 120, 200]:
    print(f"\n{'='*60}")
    print(f"KMEANS k={k}")
    print('='*60)
    km = KMeans(n_clusters=k, random_state=42, n_init=15, max_iter=500)
    labels = km.fit_predict(embeddings_norm)

    # Build cluster → indices
    cluster_idxs = {c: [] for c in range(k)}
    for i, l in enumerate(labels):
        cluster_idxs[l].append(i)

    def keywords(idxs, top_n=8):
        all_text = " ".join((meta[i].get("question","") or "") for i in idxs).lower()
        words = [w for w in re.findall(r'\b[a-z]{5,}\b', all_text)
                 if w not in STOPWORDS and len(w) > 4]
        return [w for w, _ in Counter(words).most_common(top_n)]

    results = []
    for c in range(k):
        idxs = cluster_idxs[c]
        if not idxs:
            continue
        qs = [meta[i] for i in idxs]
        kw = keywords(idxs, 8)
        resolved = sum(1 for q in qs if q.get("resolved"))
        n_ans = sum(q.get("n_answers", 0) for q in qs)
        results.append({
            "cluster_id": c,
            "size": len(idxs),
            "resolved_rate": round(resolved / len(qs), 3),
            "avg_answers": round(n_ans / len(qs), 2),
            "keywords": kw,
            "topic_label": ", ".join(kw[:5]),
        })

    results.sort(key=lambda x: -x["size"])

    print(f"\n{'#':>3}  {'n':>4}  {'res%':>5}  {'ans':>5}  topic_label")
    print("-" * 70)
    for r in results[:25]:
        print(f"  {r['cluster_id']:3d}  {r['size']:4d}  {r['resolved_rate']:.0%}    {r['avg_answers']:.1f}  {r['topic_label']}")

    # Show example questions for top 6 clusters
    print("\n--- Top 6 clusters with examples ---")
    for r in results[:6]:
        idxs = cluster_idxs[r['cluster_id']]
        center = km.cluster_centers_[r['cluster_id']]
        dists = np.dot(embeddings_norm[idxs], center)
        best_idx = idxs[np.argmax(dists)]
        print(f"\nCluster {r['cluster_id']} ({r['size']} Qs, {r['resolved_rate']:.0%} resolved)")
        print(f"  Keywords: {r['keywords']}")
        print(f"  Example: {meta[best_idx]['question'][:120]}...")

    # Save per k
    with open(OUT_DIR / f"kmeans_k{k}_stats.json", "w") as f:
        json.dump({"k": k, "clusters": results}, f, indent=2)
    np.savez(OUT_DIR / f"kmeans_k{k}_labels.npz", labels=labels)
    print(f"\n  Saved k={k} results")

print("\n\nDone — check kmeans_k{80,120,200}_stats.json to find best k")