# Mystery Hour — Analysis Roadmap & Documentation

> 601 episodes · 6,134 questions · 7,809 answers · 768-dim embeddings · 80/120 topic clusters

---

## 🎯 What's Been Built

### Data Assets (on scratch at `/scratch/b6ar/trvbale.b6ar/`)

| Asset | Path | Description |
|-------|------|-------------|
| `all_qa.json` | `../all_qa.json` | Merged Q&A for all 601 episodes (5.8MB) |
| `question_embeddings.npz` | `embeddings/` | 6,097 × 768 float32 vectors (BAAI/bge-base-en-v1.5) |
| `question_meta.json` | `embeddings/` | Index mapping: question text, caller, episode, resolved |
| `kmeans_k80_labels.npz` | `embeddings/` | Cluster label per question (k=80) |
| `kmeans_k80_stats.json` | `embeddings/` | Per-cluster stats: size, resolved rate, keywords, examples |
| `kmeans_k120_labels.npz` | `embeddings/` | Cluster labels (k=120) |
| `kmeans_k120_stats.json` | `embeddings/` | Per-cluster stats (k=120) |
| `duplicates.json` | `embeddings/` | 232 semantic near-duplicate chains (sim > 0.88) |
| `recurring_questions.json` | `embeddings/` | 19 exact duplicate questions across episodes |
| `umap_2d_coords.npz` | `embeddings/` | 2D UMAP projection (for scatter plot) |

### Scripts (in this repo)

| Script | What it does |
|--------|--------------|
| `embed_cluster.py` | Embed + cluster in one pipeline |
| `cluster_final.py` | KMeans sweep at k=80,120,200 |
| `find_duplicates.py` | Exact + semantic duplicate detection |
| `umap_visualize.py` | UMAP 2D → interactive HTML scatter plot |
| `extract_qa.py` | MiniMax M2.7 → structured Q&A JSON |
| `bootstrap.py` | RSS → episode MP3 URL extraction |
| `transcribe.sh` | Whisper large-v3 on GPU via SLURM |

### Dashboard (static HTML, no backend)

Located in `dashboard/` — open any `.html` file directly in a browser:

| Page | File | Features |
|------|------|----------|
| Overview | `index.html` | Stats, Q/episode chart, caller locations, cluster cards |
| Topic Clusters | `clusters.html` | 80/120 clusters, drill into questions per cluster |
| Episodes | `episodes.html` | All 601 episodes with full Q&A detail |
| Search | `search.html` | Full-text question search |
| Duplicates | `duplicates.html` | Exact + semantic duplicate chains |
| UMAP | `umap.html` | Interactive 2D scatter plot of all 6,097 questions |

---

## 📊 Ideas & Roadmap

### 🔍 Discovery & Search

- [x] **Semantic search** — embed all questions, find "similar questions" to any query *(build the index; add /search)*
- [x] **Recurring questions** — find exact duplicates across 604 episodes
- [ ] **Episode similarity** — find episodes with similar Q&A topics via embedding cosine similarity
- [ ] **"Ask the dataset"** — type a question → find closest real Q&A from corpus (use embedding dot product)
- [ ] **Cross-episode linking** — which questions reference answers from earlier in the same episode?

### 📊 Question Analytics

- [x] **Clustering questions** — embed + KMeans → topic taxonomy *(k=80/120/200 done)*
- [ ] **Question type taxonomy** — why/how/what/who — what gets answered best? Is "why" harder than "what"?
- [ ] **Unanswered questions analysis** — what makes a question hard to answer? Cluster difficulty by embedding region
- [ ] **Answer success prediction** — given question embedding + cluster + length → predict if resolved?
- [ ] **Episode difficulty score** — unresolved ratio per episode as a difficulty metric

### 🔄 Answer Dynamics

- [ ] **Overturned answers** — scan all Q&A for `overturned: true` flags. Count: how often does James give a wrong answer that callers later correct? Build a "James got it wrong" tracker.
- [ ] **Multi-answer chains** — how many callers typically weigh in before resolution? Distribution of answer count before resolution.
- [ ] **Longest unresolved chains** — which questions had most back-and-forth but never resolved?
- [ ] **Answer confidence** — short dismissals vs thorough explanations. What's the linguistic signature of a "good" answer?
- [ ] **James wrong/right ratio** — track his accuracy over time. Group by cluster: does he do worse on science than language?

### 📍 Geographic Patterns

- [ ] **Caller locations** — extract city/county from `caller` field (e.g. "Neil from Farnham"). Count by location. Plot on UK map (use D3 or Leaflet).
- [ ] **Geography of questions** — do different regions ask different topics? (e.g. London callers more likely to ask about transport)
- [ ] **Urban vs rural** — city callers vs countryside. Any pattern in resolution rate?

### ⏱️ Temporal

- [ ] **Topic drift over 10+ years** — 601 episodes span ~2007–2024. Plot topic cluster composition per episode over time. Did Brexit / COVID spike new clusters?
- [ ] **Seasonal patterns** — do Christmas episodes have different topics? Summer callers ask more about gardens/weather/picnics?
- [ ] **Episode-by-episode difficulty** — unresolved ratio as a time series. Any trend over the decade?

### 🧩 Knowledge Graph

- [ ] **Q→A→Sub-question chains** — in each episode, which answer led to a new question from a caller?
- [ ] **James's knowledge map** — cluster by resolved/unresolved. What topics does he know cold vs always deflect on?
- [ ] **Cross-episode linking** — does a question in ep_050 reference something answered in ep_049? (Use embedding similarity across episode boundaries)

### 🤖 LLM-based

- [ ] **Question quality scorer** — use MiniMax M2.7 to rate each question: interest (1-5), difficulty (1-5), novelty (1-5)
- [ ] **Answer quality classifier** — short correct vs rambling wrong. Does answer length predict resolution?
- [ ] **Auto-tag topics** — run MiniMax on each question with fine-grained topic taxonomy (50+ fine tags)
- [ ] **Episode summariser** — 3-sentence summary per episode: "This week James tackled etymology, zoology, and why train seats face different directions."
- [ ] **"Ask James" trivia game** — pick random answered question, hide the answer, see if user can guess before reading. Track score.

### 🎮 Creative / Fun

- [ ] **"How did James do?" scorecard** — per episode: % resolved, avg answers per Q, number of times corrected. A fun retrospective.
- [ ] **Mystery Hour Trivia Game** — random answered question shown, user tries to match or beat James's answer
- [ ] **Episode "topic fingerprint"** — radar chart of which of the 80 clusters dominate each episode. Compare ep_000 vs ep_500.
- [ ] **Recurring-unanswered corner** — questions asked multiple times across episodes but never resolved. The mysteries that haunt the show.
- [ ] **Cluster explorer** — interactive version of the k=80 cluster view. Drag to reorder. Filter by resolved rate.

---

## 🚀 Top 5 Next Steps (Recommended)

1. **`james_accuracy.py`** — compute James's overturned/wrong rate overall and per cluster. Quick to compute, always interesting.
2. **`topic_fingerprint.py`** — for each episode, compute distribution across 80 clusters → radar chart per episode. Great visual for the dashboard.
3. **`semantic_search.py`** — user types question → dot product against all 6,097 embeddings → top-5 real similar Q&A. Immediate utility.
4. **`topic_drift.py`** — average cluster composition per episode, plotted as stacked area chart over episode index (~601 points). Shows how topics evolved.
5. **`dashboard_static.py` → static site rebuild** — currently `dashboard/` is Flask. Convert to pure static HTML + fetch from pre-loaded JSON. No backend needed.

---

## 📁 Data Storage

All data lives on HPC scratch filesystem — **not in git**:

```
/scratch/b6ar/trvbale.b6ar/
├── all_qa.json              (5.8 MB — merged Q&A)
├── embeddings/
│   ├── question_embeddings.npz  (18.7 MB)
│   ├── question_meta.json       (1.7 MB)
│   ├── kmeans_k80_labels.npz
│   ├── kmeans_k80_stats.json
│   ├── kmeans_k120_labels.npz
│   ├── kmeans_k120_stats.json
│   ├── duplicates.json
│   ├── recurring_questions.json
│   └── umap_2d_coords.npz
├── transcripts/              (29 MB — 604 files)
└── qa/                       (6.7 MB — 601 files)
```

Git repo (code only, ~1MB):
```
/home/b6ar/trvbale.b6ar/scratch/mystery-hour/
├── extract_qa.py
├── embed_cluster.py
├── cluster_final.py
├── find_duplicates.py
├── umap_visualize.py
├── bootstrap.py / transcribe.sh
├── dashboard/                 (static HTML — no backend)
└── TODO.md / ANALYSIS.md
```

---

## 🔧 Running the Dashboard

**Static (no server needed):**
```bash
# Just open these files directly in a browser:
dashboard/templates/index.html
dashboard/templates/clusters.html
dashboard/templates/umap.html   # needs pre-computed umap_2d_coords.npz
```

**With Flask (for API routes):**
```bash
cd dashboard
FLASK_SECRET=whatever HF_TOKEN=xxx \
  /home/b5av/alinelena.b5av/mace-lammps-torch-2.6.0/bin/python3 app.py
# → http://localhost:5000
```

---

*Last updated: 2026-05-31 · 601 episodes · 6,134 questions · BAAI/bge-base-en-v1.5 embeddings*