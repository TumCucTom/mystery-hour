#!/usr/bin/env /home/b5av/alinelena.b5av/mace-lammps-torch-2.6.0/bin/python3
import sys
sys.path.insert(0, '/scratch/b6ar/trvbale.b6ar/.local/lib/python3.11/site-packages')
"""
Mystery Hour Dashboard — Flask app
Serves Q&A + cluster data with interactive visualizations.

Usage:
  FLASK_SECRET=xxx python3 app.py
  Then open http://localhost:5000
"""
import os, json, re, numpy as np
from pathlib import Path
from collections import Counter, defaultdict

from flask import Flask, jsonify, render_template, request

app = Flask(__name__)
app.secret_key = os.environ.get("FLASK_SECRET", "mystery-hour-secret-2024")

# ── Load all data once at startup ─────────────────────────────────────────────
SCRATCH = Path("/scratch/b6ar/trvbale.b6ar")
EMBED_DIR = SCRATCH / "embeddings"

print("Loading all_qa.json...")
with open(SCRATCH / "all_qa.json") as f:
    all_qa = json.load(f)

print("Loading metadata...")
with open(EMBED_DIR / "question_meta.json") as f:
    meta = json.load(f)  # list of dicts

print("Loading cluster results (k=80)...")
with open(EMBED_DIR / "kmeans_k80_stats.json") as f:
    cluster_k80 = json.load(f)["clusters"]

with open(EMBED_DIR / "kmeans_k120_stats.json") as f:
    cluster_k120 = json.load(f)["clusters"]

labels_k80 = np.load(EMBED_DIR / "kmeans_k80_labels.npz")["labels"]
labels_k120 = np.load(EMBED_DIR / "kmeans_k120_labels.npz")["labels"]

n_episodes = len(all_qa["episodes"])
total_questions = sum(len(ep.get("questions", [])) for ep in all_qa["episodes"])
total_answers = sum(
    sum(len(q.get("answers", [])) for q in ep.get("questions", []))
    for ep in all_qa["episodes"]
)
resolved = sum(
    sum(1 for q in ep.get("questions", []) if q.get("resolved"))
    for ep in all_qa["episodes"]
)

# ── Precompute per-episode stats ─────────────────────────────────────────────
episode_stats = []
for ep in all_qa["episodes"]:
    qs = ep.get("questions", [])
    episode_stats.append({
        "episode": ep.get("episode", "ep_???"),
        "n_questions": len(qs),
        "n_answers": sum(len(q.get("answers", [])) for q in qs),
        "resolved": sum(1 for q in qs if q.get("resolved")),
        "topics": list(set(t for q in qs for t in (q.get("topics") or [])))[:5],
    })

# Top-level cluster stats with example questions
def enrich_cluster(c):
    """Add example questions from a cluster."""
    # Find example questions for this cluster
    # We reconstruct by looking at meta
    return c

for c in cluster_k80:
    c["resolved_pct"] = int(c["resolved_rate"] * 100)
    c["avg_answers"] = c["avg_answers"]

for c in cluster_k120:
    c["resolved_pct"] = int(c["resolved_rate"] * 100)

# ── Build caller location map ─────────────────────────────────────────────
caller_locations = defaultdict(int)
for q in meta:
    loc = q.get("caller", "")
    if "," in loc:
        city = loc.split(",")[-1].strip()
        caller_locations[city] += 1

top_locations = sorted(caller_locations.items(), key=lambda x: -x[1])[:30]

# ── Topic over time (episode index → topic counts) ─────────────────────────
# We don't have episode dates, but we can show question count per episode
episode_q_counts = [ep["n_questions"] for ep in episode_stats]

# ─────────────────────────────────────────────────────────────────────────────
# ROUTES
# ─────────────────────────────────────────────────────────────────────────────

@app.route("/")
def index():
    return render_template("index.html",
        n_episodes=n_episodes,
        total_questions=total_questions,
        total_answers=total_answers,
        resolved_pct=int(resolved / total_questions * 100) if total_questions else 0,
        top_locations=top_locations[:15],
        episode_q_counts=episode_q_counts,
    )

@app.route("/api/clusters")
def api_clusters():
    k = int(request.args.get("k", 80))
    if k == 80:
        clusters = cluster_k80
        labels = labels_k80
    else:
        clusters = cluster_k120
        labels = labels_k120

    # Attach example questions to each cluster
    # Find the question closest to centroid for each cluster
    from sklearn.preprocessing import normalize
    emb = np.load(EMBED_DIR / "question_embeddings.npz")["embeddings"]
    emb_norm = normalize(emb, axis=1)

    cluster_kw = defaultdict(list)
    for i, l in enumerate(labels):
        cluster_kw[int(l)].append(i)

    for c in clusters:
        idxs = cluster_kw.get(c["cluster_id"], [])
        if idxs:
            center = np.mean(emb_norm[idxs], axis=0)
            dists = np.dot(emb_norm[idxs], center)
            best_idx = idxs[np.argmax(dists)]
            c["example"] = meta[best_idx]["question"][:200]
            c["example_caller"] = meta[best_idx].get("caller", "")

    return jsonify({"clusters": clusters, "k": k})

@app.route("/api/episode/<int:ep_idx>")
def api_episode(ep_idx):
    if ep_idx >= len(all_qa["episodes"]):
        return jsonify({"error": "not found"}), 404
    return jsonify(all_qa["episodes"][ep_idx])

@app.route("/api/search")
def api_search():
    q = request.args.get("q", "").lower().strip()
    if not q or len(q) < 2:
        return jsonify([])

    # Simple keyword match on questions
    results = []
    for i, m in enumerate(meta):
        qt = m.get("question", "").lower()
        if q in qt:
            results.append({
                "idx": i,
                "question": m["question"][:200],
                "caller": m.get("caller", ""),
                "episode": m.get("episode", ""),
                "resolved": m.get("resolved", False),
                "n_answers": m.get("n_answers", 0),
            })
        if len(results) >= 30:
            break
    return jsonify(results)

@app.route("/api/cluster/<int:cluster_id>")
def api_cluster_questions(cluster_id):
    k = int(request.args.get("k", 80))
    labels = labels_k80 if k == 80 else labels_k120

    idxs = [i for i, l in enumerate(labels) if l == cluster_id]
    questions = []
    for i in idxs:
        m = meta[i]
        questions.append({
            "question": m["question"],
            "caller": m.get("caller", ""),
            "episode": m.get("episode", ""),
            "resolved": m.get("resolved", False),
            "n_answers": m.get("n_answers", 0),
        })
    return jsonify({"cluster_id": cluster_id, "questions": questions, "k": k})

@app.route("/clusters")
def clusters_page():
    return render_template("clusters.html", k=80)

@app.route("/episodes")
def episodes_page():
    return render_template("episodes.html",
        episode_stats=episode_stats[:100]  # first 100 for preview
    )

@app.route("/search")
def search_page():
    return render_template("search.html")

@app.route("/api/topics")
def api_topics():
    """All unique topics across episodes"""
    topic_counts = Counter()
    for ep in all_qa["episodes"]:
        for q in ep.get("questions", []):
            for t in (q.get("topics") or []):
                topic_counts[t] += 1
    return jsonify(topic_counts.most_common(100))


@app.route("/api/recurring")
def api_recurring():
    """Questions that have been asked multiple times across episodes"""
    with open(EMBED_DIR / "recurring_questions.json") as f:
        return jsonify(json.load(f))


@app.route("/api/duplicates")
def api_duplicates():
    """Near-duplicate question chains"""
    with open(EMBED_DIR / "duplicates.json") as f:
        return jsonify(json.load(f))


@app.route("/duplicates")
def duplicates_page():
    return render_template("duplicates.html")


@app.route("/umap")
def umap_page():
    return render_template("umap.html")


@app.route("/api/answer-quality")
def api_answer_quality():
    """Distribution of answer counts and resolution rates"""
    ans_counts = Counter()
    resolved_by_ans = defaultdict(int)
    total_by_ans = defaultdict(int)
    for ep in all_qa["episodes"]:
        for q in ep.get("questions", []):
            n = min(len(q.get("answers", [])), 10)  # bucket at 10+
            ans_counts[n] += 1
            total_by_ans[n] += 1
            if q.get("resolved"):
                resolved_by_ans[n] += 1
    return jsonify({
        "distribution": [{"answers": k, "count": v} for k, v in sorted(ans_counts.items())],
        "resolved_by_answers": [{"answers": k, "resolved": resolved_by_ans[k], "total": total_by_ans[k]}
                              for k in sorted(total_by_ans.keys())]
    })


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=False)