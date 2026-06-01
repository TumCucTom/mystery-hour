# Mystery Hour Q&A Analysis — Ideas & Roadmap

## 🔍 Discovery & Search
- [ ] **Semantic search** — embed all questions, find "similar questions" to any query
- [ ] **Deduplication** — has this question been asked before? (Mystery Hour recycles questions a lot)
- [ ] **Episode similarity** — find episodes with similar Q&A topics via embedding cosine similarity
- [ ] **Recurring questions** — find exact/semantic duplicates across 604 episodes

## 📊 Question Analytics
- [ ] **Clustering questions** — embed questions (e.g. Google text-embedding-005 with 3072 dims), reduce with UMAP/PCA, cluster to discover natural topic taxonomy
- [ ] **Question type taxonomy** — why/how/what/who — what gets answered best?
- [ ] **Unanswered questions analysis** — what makes a question hard to answer? (James's knowledge gaps)
- [ ] **Answer success prediction** — what predicts whether a question gets resolved? (topic, caller region, complexity, time of day?)
- [ ] **How long until answered** — count number of callers/answers before resolution

## 🔄 Answer Dynamics
- [ ] **Overturned answers** — how often does James give a wrong answer that callers later correct?
- [ ] **Multi-answer chains** — how many callers typically weigh in before resolution?
- [ ] **Answer confidence** — short dismissals vs thorough explanations — what does resolution look like?
- [ ] **James wrong/right ratio** — track his accuracy over time

## 📍 Geographic Patterns
- [ ] **Caller locations** — plot UK map of where callers dial in from
- [ ] **Geography of questions** — do different regions ask different topics?
- [ ] **Urban vs rural** — city callers vs countryside

## ⏱️ Temporal
- [ ] **Topic drift over 10+ years** — 604 episodes span ~2007–2024; track topics over time
- [ ] **Seasonal patterns** — do certain questions appear in summer/winter?
- [ ] **Episode difficulty score** — unresolved ratio per episode as a difficulty metric

## 🧩 Knowledge Graph
- [ ] **Q→A→Sub-question chains** — build a graph of which answers lead to new questions
- [ ] **James's knowledge map** — what does he know cold vs always deflect?
- [ ] **Cross-episode linking** — which questions reference answers from earlier in the same episode?

## 🤖 LLM-based
- [ ] **Question quality scorer** — use LLM to rate question interest/difficulty
- [ ] **Answer quality classifier** — short correct vs rambling wrong
- [ ] **Auto-tag topics** — fine-grained topic labels beyond the extracted topics
- [ ] **Summarise episode** — 3-sentence summary of each episode's Q&A

## 📁 Suggested Commit Structure
```
commit 1: "bootstrap + transcription pipeline scripts"
commit 2: "Q&A extraction pipeline scripts"
commit 3: "TODO: analysis roadmap"
```
Data (transcripts/ qa/) lives on scratch, not in git.

## 🚀 Quick Wins (next steps)
1. `merge_qa.py` — merge 601 JSON files into `all_qa.json`
2. `cluster_questions.py` — embed + cluster questions, plot with matplotlib
3. `find_duplicates.py` — semantic similarity on all 6135 questions
