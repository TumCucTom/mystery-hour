#!/usr/bin/env /home/b5av/alinelena.b5av/mace-lammps-torch-2.6.0/bin/python3
import sys
sys.path.insert(0, '/scratch/b6ar/trvbale.b6ar/.local/lib/python3.11/site-packages')
"""
HDBSCAN clustering + UMAP 2D visualization for Mystery Hour questions.
Finds natural clusters without forcing a k.

Usage:
  HF_TOKEN=xxx /home/b5av/.../python3 cluster_hdbscan.py
"""

import json, os, re, numpy as np
from pathlib import Path
from collections import Counter

OUT_DIR = Path("/scratch/b6ar/trvbale.b6ar/embeddings")

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
    'ask','asks','tell','told','tell','get','got','getting','go','going',
    'went','gone','come','came','coming','make','made','making','take',
    'took','taking','give','gave','giving','know','knew','known','see','saw',
    'seen','use','used','using','find','found','finding','want','wanted',
    'need','needed','seem','seemed','mean','meant','they','them','their',
    'she','her','his','him','you','your','yours','we','us','our','ours',
    'it','its','i','me','my','mine','what','that','this','ve','re','ll',
    'didn','don','really','thing','things','way','ways','something','anything',
    'everything','nothing','someone','anyone','everyone','nobody','always',
    'never','ever','even','still','though','although','because','since',
    'while','if','whether','though','one','two','three','four','five','ten',
    's','t','doesn','wasn','aren','isn','aren','couldn','wouldn','shouldn',
    'hasn','haven','hadn','let\'s','you\'re','we\'re','they\'re','i\'m',
    'it\'s','that\'s','what\'s','there\'s','here\'s','how\'s','who\'s',
}

# ── Load ──────────────────────────────────────────────────────────────────────
print("Loading data...")
embeddings = np.load(OUT_DIR / "question_embeddings.npz")["embeddings"]
with open(OUT_DIR / "question_meta.json") as f:
    meta = json.load(f)
print(f"  {embeddings.shape[0]} questions, {embeddings.shape[1]} dims")

# ── UMAP 2D for visualization ──────────────────────────────────────────────────
print("\nFitting UMAP 2D for visualization...")
try:
    import umap
except ImportError:
    os.system("/home/b5av/alinelena.b5av/mace-lammps-torch-2.6.0/bin/pip install --quiet umap-learn")
    import umap

reducer = umap.UMAP(n_neighbors=20, n_components=2, min_dist=0.1,
                    metric='euclidean', random_state=42, verbose=False)
coords_2d = reducer.fit_transform(embeddings)
print(f"  UMAP 2D done: {coords_2d.shape}")

# ── HDBSCAN ────────────────────────────────────────────────────────────────────
print("\nInstalling HDBSCAN if needed...")
try:
    import hdbscan
except ImportError:
    os.system("/home/b5av/alinelena.b5av/mace-lammps-torch-2.6.0/bin/pip install --quiet hdbscan")
    import hdbscan

from sklearn.preprocessing import normalize
embeddings_norm = normalize(embeddings, axis=1)

print("Running HDBSCAN (euclidean on L2-norm = cosine)...")
clusterer = hdbscan.HDBSCAN(
    min_cluster_size=20,
    min_samples=5,
    metric='euclidean',  # On L2-norm vectors, euclidean ≈ cosine
    cluster_selection_method='eom',
    prediction_data=True,
    core_dist_n_jobs=4,
    cluster_selection_epsilon=0.3
)
labels = clusterer.fit_predict(embeddings_norm)
n_clusters = len(set(labels)) - (1 if -1 in labels else 0)
n_noise = list(labels).count(-1)
print(f"  HDBSCAN: {n_clusters} clusters, {n_noise} noise points ({n_noise/len(labels)*100:.1f}%)")

# ── Cluster analysis ──────────────────────────────────────────────────────────
print(f"\nAnalyzing {n_clusters} clusters...")

cluster_indices = {c: [] for c in set(labels) if c != -1}
for i, l in enumerate(labels):
    if l in cluster_indices:
        cluster_indices[l].append(i)

def top_keywords(indices, meta, top_n=6):
    all_text = " ".join((meta[i].get("question","") or "") for i in indices).lower()
    words = re.findall(r'\b[a-z]{5,}\b', all_text)
    filtered = [w for w in words if w not in STOPWORDS and len(w) > 4]
    return [w for w, _ in Counter(filtered).most_common(top_n)]

# Per-cluster stats
results = []
for c in sorted(cluster_indices.keys()):
    idxs = cluster_indices[c]
    qs = [meta[i] for i in idxs]
    keywords = top_keywords(idxs, meta, 8)
    resolved = sum(1 for q in qs if q.get("resolved", False))
    n_ans = sum(q.get("n_answers", 0) for q in qs)

    results.append({
        "cluster_id": int(c),
        "size": len(idxs),
        "resolved_rate": round(resolved / len(qs), 3),
        "avg_answers": round(n_ans / len(qs), 2),
        "keywords": keywords,
        "topic_label": ", ".join(keywords[:4]),
        "examples": [meta[idxs[0]]["question"], meta[idxs[len(idxs)//2]]["question"]]
    })

results.sort(key=lambda x: -x["size"])

# ── Print results ─────────────────────────────────────────────────────────────
print(f"\n{'#':>4}  {'n':>4}  {'res%':>5}  {'ans':>5}  topic_label")
print("-" * 65)
for r in results:
    print(f"  {r['cluster_id']:3d}  {r['size']:4d}  {r['resolved_rate']:.0%}    {r['avg_answers']:.1f}  {r['topic_label']}")

# Sample questions
print("\n\nSample questions from top 8 clusters:")
for r in results[:8]:
    print(f"\n{'='*65}")
    print(f"Cluster {r['cluster_id']} ({r['size']} Qs, {r['resolved_rate']:.0%} resolved)")
    print(f"Keywords: {r['keywords']}")
    print(f"Examples:")
    for ex in r['examples'][:2]:
        print(f"  • {ex[:120]}...")

# ── Save ───────────────────────────────────────────────────────────────────────
out_stats = OUT_DIR / "hdbscan_cluster_stats.json"
with open(out_stats, "w") as f:
    json.dump({
        "method": "HDBSCAN_min20_on_BAAI-bge-base-en-v1.5",
        "n_clusters": n_clusters,
        "n_noise": n_noise,
        "n_questions": len(meta),
        "clusters": results
    }, f, indent=2)
print(f"\nSaved: {out_stats}")

# Save 2D coords for visualization
out_2d = OUT_DIR / "umap_2d_coords.npz"
np.savez(out_2d, coords=coords_2d, labels=labels)
print(f"Saved: {out_2d}")

# Noise analysis
if n_noise > 0:
    noise_idxs = [i for i, l in enumerate(labels) if l == -1]
    noise_kws = top_keywords(noise_idxs, meta, 8)
    print(f"\nNoise points ({n_noise}): top words: {noise_kws}")
    print(f"  Example noise questions:")
    for i in noise_idxs[:3]:
        print(f"  • {meta[i]['question'][:120]}...")

# Cluster size distribution
sizes = [r['size'] for r in results]
print(f"\nCluster size stats: min={min(sizes)}, max={max(sizes)}, mean={np.mean(sizes):.1f}")
print(f"Noise fraction: {n_noise/len(labels)*100:.1f}%")
print(f"\nHDBSCAN complete! {n_clusters} clusters found.")