#!/usr/bin/env python3
"""
james_accuracy.py — How often does James (and others) get it wrong?

Tracks:
  - Overall overturned rate (all answers)
  - James O'Brien vs callers breakdown
  - Per speaker accuracy
  - Overturned per topic cluster per speaker group
  - Accuracy over time (by era)
  - Per episode stats with speaker split

Outputs:
  - james_accuracy.json (for dashboard)
"""

import json, sys
from pathlib import Path
from collections import defaultdict

SCRATCH = Path("/scratch/b6ar/trvbale.b6ar")
DATA    = SCRATCH / "all_qa.json"
OUT     = SCRATCH / "embeddings" / "james_accuracy.json"

# ── Normalise speaker names ──────────────────────────────────────────────────
def normalise_speaker(name):
    if not name:
        return "Unknown"
    name = name.strip()
    if name.startswith("James") or name == "James":
        return "James O'Brien"
    return name

# ── Assign era from episode number ─────────────────────────────────────────
def episode_era(ep_id):
    try:
        num = int(ep_id.split("_")[1])
    except (ValueError, IndexError):
        return 0
    if num < 100: return 0
    if num < 200: return 1
    if num < 300: return 2
    if num < 400: return 3
    if num < 500: return 4
    return 5

ERA_LABELS = {
    0: "Era 1 (eps 0–99)",
    1: "Era 2 (eps 100–199)",
    2: "Era 3 (eps 200–299)",
    3: "Era 4 (eps 300–399)",
    4: "Era 5 (eps 400–499)",
    5: "Era 6 (eps 500–600)",
}

def main():
    with open(DATA) as f:
        data = json.load(f)

    episodes = data.get("episodes", [])

    # ── Per-answer records ─────────────────────────────────────────────────
    all_answers = []  # {episode, era, speaker, speaker_group, question, answer, overturned}

    # speaker_group: "James O'Brien" | "Caller" | "Unknown"
    # Per-episode stats: episode -> {total, wrong, james_total, james_wrong, caller_total, caller_wrong}
    ep_stats = defaultdict(lambda: {
        "episode": "",
        "idx": 0,
        "total": 0, "wrong": 0,
        "james_total": 0, "james_wrong": 0,
        "caller_total": 0, "caller_wrong": 0,
    })

    # Era stats: era -> speaker_group -> {total, wrong}
    era_stats = defaultdict(lambda: defaultdict(lambda: {"total": 0, "wrong": 0}))

    # Speaker stats: speaker -> {total, wrong}
    speaker_stats = defaultdict(lambda: {"total": 0, "wrong": 0})

    # Per-question records for top overturned
    all_overturned = []

    ep_idx = 0
    for ep in sorted(episodes, key=lambda x: int(x.get("episode","ep_0").split("_")[1]) if "_" in x.get("episode","ep_0") else 0):
        ep_id = ep.get("episode", "?")
        era = episode_era(ep_id)

        stats = ep_stats[ep_id]
        stats["episode"] = ep_id
        stats["idx"] = ep_idx
        ep_idx += 1

        for q in ep.get("questions", []):
            for a in q.get("answers", []):
                speaker = normalise_speaker(a.get("caller", ""))
                group = "James O'Brien" if speaker == "James O'Brien" else ("Caller" if speaker != "Unknown" else "Unknown")
                is_over = bool(a.get("overturned"))

                all_answers.append({
                    "episode": ep_id,
                    "era": era,
                    "speaker": speaker,
                    "speaker_group": group,
                    "question": (q.get("question") or "")[:120],
                    "overturned": is_over,
                })

                stats["total"] += 1
                speaker_stats[speaker]["total"] += 1
                era_stats[era][group]["total"] += 1

                if is_over:
                    stats["wrong"] += 1
                    speaker_stats[speaker]["wrong"] += 1
                    era_stats[era][group]["wrong"] += 1
                    all_overturned.append({
                        "episode": ep_id,
                        "era": era,
                        "speaker": speaker,
                        "question": (q.get("question") or "")[:120],
                        "answer": a.get("answer", "")[:80],
                    })

                if group == "James O'Brien":
                    stats["james_total"] += 1
                    if is_over:
                        stats["james_wrong"] += 1
                else:
                    stats["caller_total"] += 1
                    if is_over:
                        stats["caller_wrong"] += 1

    # ── Per-episode summary ─────────────────────────────────────────────────
    episode_stats = []
    for ep_id, stats in ep_stats.items():
        t = stats["total"]
        w = stats["wrong"]
        episode_stats.append({
            "episode": stats["episode"],
            "idx": stats["idx"],
            "total": t,
            "wrong": w,
            "rate": round(w / t, 3) if t else 0,
            "james_total": stats["james_total"],
            "james_wrong": stats["james_wrong"],
            "james_rate": round(stats["james_wrong"] / stats["james_total"], 3) if stats["james_total"] else None,
            "caller_total": stats["caller_total"],
            "caller_wrong": stats["caller_wrong"],
            "caller_rate": round(stats["caller_wrong"] / stats["caller_total"], 3) if stats["caller_total"] else None,
        })

    episode_stats.sort(key=lambda x: int(x["episode"].split("_")[1]) if "_" in x["episode"] else 0)

    # ── Era breakdown ─────────────────────────────────────────────────────
    era_breakdown = {}
    for era, groups in sorted(era_stats.items()):
        era_breakdown[str(era)] = {
            "label": ERA_LABELS.get(era, f"Era {era+1}"),
            "all": {
                "total": sum(g["total"] for g in groups.values()),
                "wrong": sum(g["wrong"] for g in groups.values()),
            },
            "james": dict(groups.get("James O'Brien", {"total": 0, "wrong": 0})),
            "caller": dict(groups.get("Caller", {"total": 0, "wrong": 0})),
        }

    # ── Speaker leaderboard ────────────────────────────────────────────────
    speaker_leaderboard = []
    for speaker, s in speaker_stats.items():
        if s["total"] < 3:
            continue  # skip one-offs
        speaker_leaderboard.append({
            "speaker": speaker,
            "total": s["total"],
            "wrong": s["wrong"],
            "rate": round(s["wrong"] / s["total"], 4) if s["total"] else 0,
        })
    speaker_leaderboard.sort(key=lambda x: -x["rate"])

    # ── Overall summary ───────────────────────────────────────────────────
    james_total = sum(s["james_total"] for s in episode_stats)
    james_wrong = sum(s["james_wrong"] for s in episode_stats)
    caller_total = sum(s["caller_total"] for s in episode_stats)
    caller_wrong = sum(s["caller_wrong"] for s in episode_stats)
    all_total = sum(s["total"] for s in episode_stats)
    all_wrong = sum(s["wrong"] for s in episode_stats)

    # ── Best / worst episodes ─────────────────────────────────────────────
    worst_episodes = episode_stats[:10]
    best_episodes   = episode_stats[-10:][::-1]

    # ── Longest wrong streaks ─────────────────────────────────────────────
    streaks = []
    current = 0
    for e in episode_stats:
        if e["wrong"] > 0:
            current += 1
        else:
            if current > 2:
                streaks.append(current)
            current = 0
    if current > 2:
        streaks.append(current)

    # ── Print summary ─────────────────────────────────────────────────────
    print(f"=" * 60)
    print(f"  ACCURACY REPORT")
    print(f"=" * 60)
    print(f"\n  OVERALL:")
    print(f"  {'All answers':<30} {all_total:>5}  wrong: {all_wrong:>4}  {all_wrong/all_total*100:.1f}%")
    jbr = james_wrong/james_total*100 if james_total else 0
    print(f"  James O'Brien:<30 {james_total:>5}  wrong: {james_wrong:>4}  {jbr:.1f}%")
    cbr = caller_wrong/caller_total*100 if caller_total else 0
    print(f"  {'Callers (experts)':<30} {caller_total:>5}  wrong: {caller_wrong:>4}  {cbr:.1f}%")
    print(f"\n  ERA TREND (James O'Brien only):")
    for era, ed in sorted(era_breakdown.items()):
        j = ed["james"]
        r = j["wrong"]/j["total"]*100 if j["total"] else 0
        print(f"  {ed['label']:<28} {j['total']:>5}  wrong: {j['wrong']:>4}  {r:.1f}%")
    print(f"\n  TOP SPEAKER WRONG RATES (min 10 answers):")
    for s in speaker_leaderboard[:12]:
        print(f"  {s['speaker']:<40} {s['total']:>5}  wrong: {s['wrong']:>4}  {s['rate']*100:.1f}%")
    print(f"=" * 60)

    # ── Save ───────────────────────────────────────────────────────────────
    result = {
        "summary": {
            "all_total": all_total,
            "all_wrong": all_wrong,
            "all_rate": round(all_wrong / all_total, 4) if all_total else 0,
            "james_total": james_total,
            "james_wrong": james_wrong,
            "james_rate": round(james_wrong / james_total, 4) if james_total else 0,
            "caller_total": caller_total,
            "caller_wrong": caller_wrong,
            "caller_rate": round(caller_wrong / caller_total, 4) if caller_total else 0,
            "longest_wrong_streak": max(streaks) if streaks else 0,
        },
        "era_breakdown": era_breakdown,
        "episode_stats": episode_stats,
        "worst_episodes": worst_episodes,
        "best_episodes": best_episodes,
        "speaker_leaderboard": speaker_leaderboard,
        "overturned_details": all_overturned[:200],
    }

    with open(OUT, "w") as f:
        json.dump(result, f, indent=2)
    print(f"\nSaved → {OUT}")

if __name__ == "__main__":
    main()