#!/usr/bin/env python3
"""
question_type_taxonomy.py — What question types get answered best?

Classify questions by opening word: why/how/what/who/where/when/which/if/can/would
Measure resolved rate and avg answers per type.

Outputs question_type_stats.json
"""

import json
from pathlib import Path
from collections import Counter, defaultdict

SCRATCH = Path("/scratch/b6ar/trvbale.b6ar")
DATA    = SCRATCH / "all_qa.json"
OUT     = SCRATCH / "embeddings" / "question_type_stats.json"

TYPE_KEYWORDS = {
    'why':   ['why', "what's the reason", "what causes", "why do", "why is", "why are", "why does"],
    'how':   ['how', "how come", "how do", "how is", "how does", "how many", "how much", "how long", "how old"],
    'what':  ['what', "what's", "what are", "what did", "what does", "what is", "what was", "what do"],
    'who':   ['who', "who's", "who are", "who did", "who does", "who is", "who was"],
    'where': ['where', "where's", "where are", "where did", "where does", "where is"],
    'when':  ['when', "when's", "when did", "when does", "when is", "when was", "when are"],
    'which': ['which'],
    'if':    ['if ', "if you", "if i", "if they", "if there's"],
    'can':   ['can ', "can you", "can i", "can someone", "could "],
    'would': ['would ', "would you", "would i", "could "],
    'is':    ['is ', "is it", "is there", "is the", "is this", "is that"],
    'does':  ['does ', "does the", "does it", "does he", "does she"],
}

def classify_question(q_text):
    if not q_text:
        return 'other'
    q = q_text.lower().strip()
    for type_name, keywords in TYPE_KEYWORDS.items():
        for kw in keywords:
            if q.startswith(kw) or f' {kw}' in q:
                return type_name
    return 'other'

def main():
    with open(DATA) as f:
        data = json.load(f)

    episodes = data.get("episodes", [])

    type_stats = defaultdict(lambda: {'total': 0, 'resolved': 0, 'total_answers': 0})

    for ep in episodes:
        for q in ep.get("questions", []):
            q_text = q.get("question") or ""
            q_type = classify_question(q_text)
            n_ans  = len(q.get("answers", []))
            res    = 1 if q.get("resolved") else 0

            type_stats[q_type]['total'] += 1
            type_stats[q_type]['resolved'] += res
            type_stats[q_type]['total_answers'] += n_ans

    # Compute rates
    results = {}
    for t, s in sorted(type_stats.items(), key=lambda x: -x[1]['total']):
        total = s['total']
        res_pct = round(s['resolved'] / total * 100, 1) if total else 0
        avg_ans = round(s['total_answers'] / total, 2) if total else 0
        results[t] = {
            'total': total,
            'resolved': s['resolved'],
            'resolved_rate_pct': res_pct,
            'avg_answers': avg_ans,
        }

    print("Question Type Taxonomy:")
    for t, s in results.items():
        bar = '█' * int(s['resolved_rate_pct'] / 5)
        print(f"  {t:<8}: {s['total']:>5} Q  |  {s['resolved_rate_pct']:>5}% resolved  |  {s['avg_answers']:.2f} avg ans  | {bar}")

    with open(OUT, "w") as f:
        json.dump(results, f, indent=2)
    print(f"\nSaved → {OUT}")

if __name__ == '__main__':
    main()