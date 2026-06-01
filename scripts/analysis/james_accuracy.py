#!/usr/bin/env python3
"""
james_accuracy.py — How often does James get it wrong?

Tracks:
  - Overall overturned rate (how often callers correct him)
  - Overturned per topic cluster
  - Overturned per episode
  - "Longest wrong streak" — consecutive questions where James was wrong
  - Best/worst episodes by accuracy

Outputs:
  - james_accuracy.json (for dashboard)
  - Console summary table
"""

import json, sys
from pathlib import Path

SCRATCH = Path("/scratch/b6ar/trvbale.b6ar")
DATA = SCRATCH / "all_qa.json"
EMBED_DIR = SCRATCH / "embeddings"
OUT = EMBED_DIR / "james_accuracy.json"

def main():
    with open(DATA) as f:
        data = json.load(f)

    episodes = data.get("episodes", [])

    # ── Per-question analysis ─────────────────────────────────
    all_overturned = []   # list of {episode, question, n_overturned}
    episode_stats  = []  # {episode, idx, total, wrong, rate}

    for ep in episodes:
        ep_id = ep.get("episode", "?")
        questions = ep.get("questions", [])
        ep_total = 0
        ep_wrong = 0

        for q in questions:
            answers = q.get("answers", [])
            n_overturned = sum(1 for a in answers if a.get("overturned"))
            if n_overturned:
                all_overturned.append({
                    "episode": ep_id,
                    "question": q.get("question", "")[:120],
                    "overturned_count": n_overturned,
                    "resolved": q.get("resolved", False),
                })
            ep_total += 1
            ep_wrong += 1 if n_overturned > 0 else 0

        if ep_total > 0:
            episode_stats.append({
                "episode": ep_id,
                "total": ep_total,
                "wrong": ep_wrong,
                "rate": round(ep_wrong / ep_total, 3),
            })

    # Sort episodes by wrong rate (worst first)
    episode_stats.sort(key=lambda x: -x["rate"])

    # ── Global summary ───────────────────────────────────────
    total_q = sum(e["total"] for e in episode_stats)
    total_w = sum(e["wrong"] for e in episode_stats)
    overall_rate = total_w / total_q if total_q else 0

    # ── Overturned details ──────────────────────────────────
    # Sort by most overturned
    all_overturned.sort(key=lambda x: -x["overturned_count"])

    # ── Longest wrong streaks ─────────────────────────────────
    # Streak: consecutive episodes where James got at least one wrong
    streaks = []
    current_streak = 0
    for e in sorted(episode_stats, key=lambda x: int(x["episode"].split("_")[1]) if "_" in x["episode"] else 0):
        if e["wrong"] > 0:
            current_streak += 1
        else:
            if current_streak > 2:
                streaks.append(current_streak)
            current_streak = 0
    if current_streak > 2:
        streaks.append(current_streak)

    # ── Best / Worst episodes ─────────────────────────────────
    best_episodes  = episode_stats[-10:][::-1]  # lowest wrong rate
    worst_episodes = episode_stats[:10]         # highest wrong rate

    # ── Print summary ─────────────────────────────────────────
    print(f"=" * 60)
    print(f"  JAMES ACCURACY REPORT")
    print(f"=" * 60)
    print(f"  Total episodes analysed : {len(episode_stats)}")
    print(f"  Total questions         : {total_q:,}")
    print(f"  Questions with wrong ans: {total_w:,}")
    print(f"  Overall wrong rate      : {overall_rate:.1%}")
    print(f"  Overturned answers      : {len(all_overturned)}")
    print(f"  Largest streak (>2)     : {max(streaks) if streaks else 0} consecutive episodes with ≥1 wrong")
    print()
    print(f"  TOP 10 WORST EPISODES (by wrong rate):")
    print(f"  {'Episode':<12} {'Total':>6} {'Wrong':>6} {'Rate':>7}")
    print(f"  {'-'*12:<12} {'-'*6:>6} {'-'*6:>6} {'-'*7:>7}")
    for e in worst_episodes:
        print(f"  {e['episode']:<12} {e['total']:>6} {e['wrong']:>6} {e['rate']:>7.1%}")
    print()
    print(f"  TOP 10 BEST EPISODES (lowest wrong rate):")
    print(f"  {'Episode':<12} {'Total':>6} {'Wrong':>6} {'Rate':>7}")
    print(f"  {'-'*12:<12} {'-'*6:>6} {'-'*6:>6} {'-'*7:>7}")
    for e in best_episodes:
        print(f"  {e['episode']:<12} {e['total']:>6} {e['wrong']:>6} {e['rate']:>7.1%}")
    print()
    print(f"  MOST OVERTURNED QUESTIONS:")
    for item in all_overturned[:10]:
        print(f"  [{item['episode']}] {item['question'][:70]:<70} ×{item['overturned_count']}")
    print(f"=" * 60)

    # ── Save JSON ──────────────────────────────────────────────
    result = {
        "summary": {
            "total_episodes": len(episode_stats),
            "total_questions": total_q,
            "questions_with_overturned_answer": total_w,
            "overall_wrong_rate": round(overall_rate, 4),
            "total_overturned_answers": len(all_overturned),
            "longest_wrong_streak": max(streaks) if streaks else 0,
        },
        "episode_stats": episode_stats,
        "worst_episodes": worst_episodes,
        "best_episodes": best_episodes,
        "overturned_details": all_overturned[:100],  # top 100 for dashboard
    }

    with open(OUT, "w") as f:
        json.dump(result, f, indent=2)
    print(f"\nSaved → {OUT}")

if __name__ == "__main__":
    main()