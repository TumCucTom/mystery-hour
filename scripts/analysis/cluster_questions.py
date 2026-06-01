#!/usr/bin/env /home/b5av/alinelena.b5av/mace-lammps-torch-2.6.0/bin/python3
import sys
sys.path.insert(0, '/scratch/b6ar/trvbale.b6ar/.local/lib/python3.11/site-packages')
"""
Cluster Mystery Hour questions with UMAP + HDBSCAN for better semantic coherence.
Also explore a wide range of K for KMeans to find optimal granularity.

Usage:
  HF_TOKEN=xxx /home/b5av/.../python3 cluster_questions.py [--n-clusters 150]
"""

import json
import os
import re
import numpy as np
from pathlib import Path
from collections import Counter

# ── Config ────────────────────────────────────────────────────────────────────
SCRIPT_DIR = Path(__file__).parent
ALL_QA = "/scratch/b6ar/trvbale.b6ar/all_qa.json"
EMBEDDINGS = "/scratch/b6ar/trvbale.b6ar/embeddings/question_embeddings.npz"
OUT_DIR = Path("/scratch/b6ar/trvbale.b6ar/embeddings")

N_CLUSTERS = int(os.environ.get("N_CLUSTERS", 150))

# Stopwords to exclude from cluster keyword summaries
STOPWORDS = {
    'the','a','an','and','or','but','in','on','at','to','for','of','with',
    'by','from','as','is','was','are','were','be','been','being','have','has',
    'had','do','does','did','will','would','could','should','may','might',
    'must','shall','can','this','that','these','those','what','which','who',
    'whom','when','where','why','how','all','each','every','both','few','more',
    'most','other','some','such','no','nor','not','only','own','same','so',
    'than','too','very','just','about','into','through','during','before',
    'after','above','below','between','under','again','further','then',
    'once','here','there','where','when','why','how','any','both','each',
    'few','more','most','other','some','such','no','nor','not','only','own',
    'same','so','than','too','very','s','t','can','will','just','don','now',
    'its','let','says','said','one','two','also','get','got','going','know',
    'think','like','ve','re','ll','didn','don','really','thing','things',
    'way','ways','something','anything','everything','nothing','someone',
    'anyone','everyone','nobody','always','never','ever','even','still',
    'though','although','because','since','while','if','whether','though',
    'call','called','calling','calls','ask','asked','asking','asks','tell',
    'told','telling','asks','get','getting','got','go','going','went','gone',
    'come','coming','came','make','made','making','take','took','taking',
    'give','gave','giving','know','knew','known','knowing','see','saw','seen',
    'use','used','using','find','found','finding','want','wanted','wanting',
    'seem','seemed','seeming','need','needed','needing','mean','meant','mean',
    'they','them','their','they','she','her','his','him','you','your','yours',
    'we','us','our','ours','it','its','i','me','my','mine','what','that','this'
}

# ── Load ──────────────────────────────────────────────────────────────────────
print("Loading embeddings and metadata...")
data = np.load(EMBEDDINGS)
embeddings = data["embeddings"]
print(f"  Embeddings: {embeddings.shape}")

with open("/scratch/b6ar/trvbale.b6ar/embeddings/question_meta.json") as f:
    meta = json.load(f)
print(f"  Questions: {len(meta)}")

# ── UMAP Dimensionality Reduction ─────────────────────────────────────────────
print("\nFitting UMAP (reducing 768 → 20 dims for clustering)...")
try:
    import umap
except ImportError:
    os.system("/home/b5av/alinelena.b5av/mace-lammps-torch-2.6.0/bin/pip install --quiet umap-learn")
    import umap
reducer = umap.UMAP(
    n_neighbors=15,
    n_components=20,
    min_dist=0.1,
    metric='cosine',
    random_state=42,
    verbose=False
)
embed_2d = reducer.fit_transform(embeddings)
print(f"  UMAP done: {embed_2d.shape}")

# ── KMeans with larger K ───────────────────────────────────────────────────────
print(f"\nRunning KMeans with k={N_CLUSTERS}...")
from sklearn.cluster import KMeans
from sklearn.preprocessing import normalize

embeddings_norm = normalize(embeddings, axis=1)

kmeans = KMeans(n_clusters=N_CLUSTERS, random_state=42, n_init=10, max_iter=500)
labels = kmeans.fit_predict(embeddings_norm)

# ── Cluster analysis ──────────────────────────────────────────────────────────
print(f"\nAnalyzing {N_CLUSTERS} clusters...")

# Build inverted index: cluster_id -> [question_indices]
cluster_indices = {c: [] for c in range(N_CLUSTERS)}
for i, l in enumerate(labels):
    cluster_indices[l].append(i)

# Helper: extract meaningful keywords from question texts
def top_keywords(question_indices, meta, top_n=6):
    all_text = " ".join((meta[i].get("question","") or "") for i in question_indices).lower()
    words = re.findall(r'\b[a-z]{5,}\b', all_text)
    filtered = [w for w in words if w not in STOPWORDS and len(w) > 4]
    counts = Counter(filtered)
    return [w for w, _ in counts.most_common(top_n)]

# ── Cluster stats with semantic labels ─────────────────────────────────────────
results = []
for c in range(N_CLUSTERS):
    idxs = cluster_indices[c]
    if not idxs:
        continue
    qs = [meta[i] for i in idxs]

    keywords = top_keywords(idxs, meta, 6)

    # Get the 2 most central questions (closest to centroid)
    cluster_center = kmeans.cluster_centers_[c]
    dists = np.dot(embeddings_norm[idxs], cluster_center)
    sorted_idxs = [idxs[i] for i in np.argsort(-dists)]
    examples = [meta[sorted_idxs[0]]["question"], meta[sorted_idxs[min(1, len(sorted_idxs)-1)]]["question"]]

    # Topic label: best keywords joined
    topic_label = ", ".join(keywords[:4]) if keywords else "general"

    results.append({
        "cluster_id": c,
        "size": len(idxs),
        "resolved_rate": round(sum(1 for q in qs if q.get("resolved", False)) / len(qs), 3),
        "avg_answers": round(sum(q.get("n_answers", 0) for q in qs) / len(qs), 2),
        "keywords": keywords,
        "topic_label": topic_label,
        "examples": examples
    })

results.sort(key=lambda x: -x["size"])

# Print top 20 clusters with proper labels
print("\nTop 20 clusters by size:")
print(f"{'#':>3}  {'n':>4}  {'res%':>5}  {'ans':>5}  topic_label")
print("-" * 70)
for r in results[:20]:
    print(f"  {r['cluster_id']:2d}  {r['size']:4d}  {r['resolved_rate']:.0%}    {r['avg_answers']:.1f}  {r['topic_label']}")

# Print some example questions for top clusters
print("\n\nSample questions from top 5 clusters:")
for r in results[:5]:
    print(f"\n{'='*60}")
    print(f"Cluster {r['cluster_id']} ({r['size']} Qs, {r['resolved_rate']:.0%} resolved)")
    print(f"Keywords: {r['keywords']}")
    print(f"Topic: {r['topic_label']}")
    print(f"Examples:")
    for ex in r['examples'][:2]:
        print(f"  • {ex[:100]}...")

# ── Save outputs ───────────────────────────────────────────────────────────────
out_stats = OUT_DIR / "cluster_stats_v2.json"
with open(out_stats, "w") as f:
    json.dump({
        "method": f"KMeans_k{N_CLUSTERS}_on_BAAI-bge-base-en-v1.5",
        "umap_dims": 20,
        "n_clusters": N_CLUSTERS,
        "n_questions": len(meta),
        "clusters": results
    }, f, indent=2)
print(f"\nSaved: {out_stats}")

# Save labels
out_labels = OUT_DIR / "cluster_labels_v2.npz"
np.savez(out_labels, labels=labels)
print(f"Saved: {out_labels}")

# ── Silhouette score ───────────────────────────────────────────────────────────
from sklearn.metrics import silhouette_score
score = silhouette_score(embeddings_norm, labels, sample_size=min(5000, len(labels)))
print(f"\nSilhouette score: {score:.4f} (range -1 to 1, higher = better)")
print("(Note: silhouette doesn't capture semantic coherence — check examples above)")