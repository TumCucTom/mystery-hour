#!/usr/bin/env python3
"""
answer_dynamics.py — Multi-answer chains and unresolved chains analysis.

Outputs:
  - answer_chains.json: distribution of answers per question, chains by length
  - longest_unresolved.json: questions with most back-and-forth but never resolved
  - answer_length_stats.json: answer length vs resolution correlation
"""

import json
from pathlib import Path
from collections import Counter

SCRATCH  = Path("/scratch/b6ar/trvbale.b6ar")
DATA     = SCRATCH / "all_qa.json"
OUT_DIR  = SCRATCH / "embeddings"

def main():
    with open(DATA) as f:
        data = json.load(f)

    episodes = data.get("episodes", [])

    # ── Answer count distribution ─────────────────────────────
    ans_dist    = Counter()   # n_answers -> count
    resolved_by_ans = {}       # n_answers -> {total, resolved}
    total_overturned = 0

    for ep in episodes:
        for q in ep.get("questions", []):
            n = len(q.get("answers", []))
            ans_dist[n] += 1
            if n not in resolved_by_ans:
                resolved_by_ans[n] = {'total': 0, 'resolved': 0}
            resolved_by_ans[n]['total'] += 1
            if q.get('resolved'):
                resolved_by_ans[n]['resolved'] += 1
            total_overturned += sum(1 for a in q.get('answers', []) if a.get('overturned'))

    # ── Longest unresolved chains ─────────────────────────────
    unresolved_chains = []
    for ep in episodes:
        for q in ep.get("questions", []):
            if not q.get('resolved') and len(q.get('answers', [])) >= 4:
                unresolved_chains.append({
                    'episode': ep.get('episode', '?'),
                    'question': (q.get('question') or '')[:120],
                    'n_answers': len(q.get('answers', [])),
                    'answers': [(a.get('answer') or '')[:80] for a in q.get('answers', [])],
                    'topics': q.get('topics', [])[:5],
                })

    unresolved_chains.sort(key=lambda x: -x['n_answers'])

    # ── Answer length stats ────────────────────────────────────
    short_answers  = 0   # <= 50 chars
    med_answers    = 0   # 50-200 chars
    long_answers   = 0   # > 200 chars
    short_resolved = 0
    med_resolved   = 0
    long_resolved  = 0

    for ep in episodes:
        for q in ep.get("questions", []):
            for a in q.get('answers', []):
                txt = a.get('answer') or ''
                l   = len(txt)
                if l <= 50:
                    short_answers += 1
                    if q.get('resolved'): short_resolved += 1
                elif l <= 200:
                    med_answers += 1
                    if q.get('resolved'): med_resolved += 1
                else:
                    long_answers += 1
                    if q.get('resolved'): long_resolved += 1

    # ── Print summary ─────────────────────────────────────────
    print(f"Answer Dynamics Summary:")
    print(f"  Total answers: {sum(ans_dist.values()):,}")
    print(f"  Overturned answers: {total_overturned}")
    print(f"  Questions with most answers: {ans_dist.most_common(1)[0]}")
    print(f"  Longest unresolved chains: {len(unresolved_chains)} with 4+ answers")
    print(f"  Answer length — short (<=50): {short_answers} (res: {short_resolved})")
    print(f"  Answer length — medium (50-200): {med_answers} (res: {med_resolved})")
    print(f"  Answer length — long (>200): {long_answers} (res: {long_resolved})")

    # Save
    chains_out = {
        'answer_distribution': dict(sorted(resolved_by_ans.items())),
        'total_answers': sum(ans_dist.values()),
        'total_overturned': total_overturned,
        'longest_unresolved': unresolved_chains[:50],
        'summary': {
            'pct_multi_answer': round(sum(k*v for k,v in ans_dist.items() if k>=2) / sum(ans_dist.values()) * 100, 1),
            'avg_answers_per_question': round(sum(k*v for k,v in ans_dist.items()) / sum(ans_dist.values()), 2),
        },
        'answer_length_stats': {
            'short':   {'count': short_answers,  'resolved': short_resolved,  'rate': round(short_resolved/short_answers, 3) if short_answers else 0},
            'medium': {'count': med_answers,    'resolved': med_resolved,    'rate': round(med_resolved/med_answers, 3) if med_answers else 0},
            'long':   {'count': long_answers,   'resolved': long_resolved,   'rate': round(long_resolved/long_answers, 3) if long_answers else 0},
        }
    }

    with open(OUT_DIR / "answer_chains.json", "w") as f:
        json.dump(chains_out, f, indent=2)
    print(f"Saved → {OUT_DIR / 'answer_chains.json'}")

if __name__ == '__main__':
    main()