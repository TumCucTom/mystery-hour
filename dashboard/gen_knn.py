import json, random, math

with open('public/data/question_vectors.json') as f:
    qv = json.load(f)
with open('public/data/question_meta.json') as f:
    meta = json.load(f)

questions = qv['questions']
n = len(questions)
print(f"N: {n}")

# Pre-compute normalized embeddings
norms = []
for q in questions:
    emb = q['embedding']
    s = math.sqrt(sum(v*v for v in emb))
    norm = [v/s if s > 0 else 0 for v in emb]
    norms.append(norm)

random.seed(42)
sample_idx = random.sample(range(n), min(400, n))

results = {}
for idx in sample_idx:
    target = norms[idx]
    scores = []
    for i in range(n):
        if i == idx:
            continue
        dot = sum(a*b for a, b in zip(target, norms[i]))
        scores.append((dot, i))
    scores.sort(reverse=True)
    m = meta[idx]
    qtext = m.get('question') or ''
    results[str(idx)] = {
        'episode': m.get('episode', ''),
        'question': qtext[:100],
        'resolved': bool(m.get('resolved', False)),
        'neighbors': [[meta[s[1]].get('question') or '', round(s[0], 4)] for s in scores[:5]]
    }

sample = list(results.values())[0]
print(f"Sample: {sample['question'][:50]}")
print(f"NN1: {sample['neighbors'][0][0][:50]} ({sample['neighbors'][0][1]})")

with open('public/data/knn_similar.json', 'w') as f:
    json.dump(results, f, indent=2)
print(f"Done ({len(results)} entries)")
