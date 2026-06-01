#!/usr/bin/env python3
"""
recurring_unanswered.py — Questions asked multiple times across episodes but never resolved.
"The mysteries that haunt the show."

Uses semantic similarity (pre-computed embeddings) to group semantically
similar questions that were never resolved, even if not exact duplicates.
"""

import json
import numpy as np
from pathlib import Path
from collections import defaultdict

SCRATCH    = Path("/scratch/b6ar/trvbale.b6ar")
EMBED_DIR  = SCRATCH / "embeddings"
DATA       = SCRATCH / "all_qa.json"
OUT        = EMBED_DIR / "recurring_unanswered.json"

def main():
    with open(DATA) as f:
        data = json.load(f)

    # Collect all unresolved questions
    unresolved = []
    for ep in data.get("episodes", []):
        ep_id = ep.get("episode", "?")
        for q in ep.get("questions", []):
            if not q.get("resolved") and q.get("answers"):
                unresolved.append({
                    'question': (q.get("question") or "")[:120],
                    'episode': ep_id,
                    'n_answers': len(q.get("answers", [])),
                    'topics': q.get("topics", [])[:3],
                })

    # Load embeddings for similarity matching
    emb_matrix = np.load(EMBED_DIR / "question_embeddings.npz")["embeddings"].astype(np.float32)
    norms = np.linalg.norm(emb_matrix, axis=1, keepdims=True)
    norms[norms == 0] = 1
    emb_matrix_norm = emb_matrix / norms

    with open(EMBED_DIR / "question_meta.json") as f:
        meta = json.load(f)

    # Build index: which meta entries are unresolved
    unresolved_indices = []
    meta_unresolved_map = {}  # meta index -> unresolved record
    for i, m in enumerate(meta):
        ep_id = m.get("episode", "?")
        q_text = m.get("question", "")
        # Find in unresolved list
        match = next((u for u in unresolved if u['episode'] == ep_id and u['question'] == q_text), None)
        if match:
            unresolved_indices.append(i)
            meta_unresolved_map[i] = match

    print(f"Found {len(unresolved_indices)} unresolved questions with embeddings")

    # Group by semantic similarity — find clusters of similar unresolved questions
    # Use simple nearest-neighbor: for each unresolved, find others with cosine > 0.85
    groups = []
    used   = set()

    for idx in unresolved_indices:
        if idx in used:
            continue
        group_indices = [idx]
        vec = emb_matrix_norm[idx]

        for jdx in unresolved_indices:
            if jdx == idx or jdx in used:
                continue
            sim = float(np.dot(vec, emb_matrix_norm[jdx]))
            if sim > 0.88:
                group_indices.append(jdx)
                used.add(jdx)

        if len(group_indices) >= 2:
            groups.append(group_indices)
            for gi in group_indices:
                used.add(gi)

    # Build output records
    recurring = []
    for grp in groups:
        questions = [meta_unresolved_map[i] for i in grp if i in meta_unresolved_map]
        if len(questions) >= 2:
            recurring.append({
                'count': len(questions),
                'episodes': [q['episode'] for q in questions],
                'questions': [q['question'] for q in questions],
                'avg_answers': round(sum(q['n_answers'] for q in questions) / len(questions), 1),
                'topics': list(set(sum((q['topics'] for q in questions), [])))[:5],
            })

    recurring.sort(key=lambda x: -x['count'])

    print(f"Found {len(recurring)} recurring unanswered groups (2+ similar unanswered questions)")
    print(f"  Top 5 groups: {[(r['count'], r['questions'][0][:50]) for r in recurring[:5]]}")

    out = {
        'summary': {
            'total_unresolved': len(unresolved),
            'recurring_groups': len(recurring),
            'total_questions_in_groups': sum(r['count'] for r in recurring),
        },
        'recurring_groups': recurring[:50],  # Top 50 for dashboard
    }

    with open(OUT, "w") as f:
        json.dump(out, f, indent=2)
    print(f"Saved → {OUT}")

if __name__ == '__main__':
    main()