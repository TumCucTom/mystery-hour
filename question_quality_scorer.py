#!/usr/bin/env python3
"""
question_quality_scorer.py — rate each question on three dimensions:
  Interest (1-5), Difficulty (1-5), Novelty (1-5)
Uses MiniMax M2.7 to batch-score all 6,134 questions.

We batch by sending questions in groups of 10 per API call to avoid rate limits.
Output: question_quality_scores.json
"""

import json, time
from pathlib import Path
from minimax import MiniMax

SCRATCH   = Path("/scratch/b6ar/trvbale.b6ar")
META_JSON = SCRATCH / "embeddings" / "question_meta.json"
OUT       = SCRATCH / "embeddings" / "question_quality_scores.json"

PROMPT_TEMPLATE = '''Rate each of the following Mystery Hour questions on three dimensions:
- interest: how engaging/compelling is this question to a general listener? (1=boring, 5=fascinating)
- difficulty: how hard is this to answer confidently? (1=easy fact, 5=expert level)
- novelty: how original/unusual is this question? (1=asked many times, 5=never heard before)

Return ONLY a valid JSON array (no markdown, no explanation):
[
  {{"interest": N, "difficulty": N, "novelty": N}},
  ...
]
One entry per question, same order as input.

Questions:
{questions}'''

def chunk(lst, n):
    for i in range(0, len(lst), n):
        yield lst[i:i+n]

def main():
    with open(META_JSON) as f:
        meta = json.load(f)

    texts = [m.get("question", "(empty)") for m in meta]
    print(f"Scoring {len(texts)} questions in batches of 10...")

    client = MiniMax(api_key=open("/home/b6ar/trvbale.b6ar/.minimax_token").read().strip())

    all_scores = []
    for batch_idx, batch in enumerate(chunk(texts, 10)):
        prompt = PROMPT_TEMPLATE.format(questions="\n".join(f"{i+1}. {q}" for i, q in enumerate(batch)))
        for attempt in range(3):
            try:
                response = client.chat.completions.create(
                    model="MiniMax-Embedding-Large",
                    messages=[{"role": "user", "content": prompt}],
                    max_tokens=512,
                )
                raw = response.choices[0].message.content.strip()
                # Strip markdown code blocks if present
                if raw.startswith("```"):
                    raw = raw.split("```")[1]
                    if raw.startswith("json"):
                        raw = raw[4:]
                scores = json.loads(raw)
                if len(scores) == len(batch):
                    all_scores.extend(scores)
                    break
                else:
                    print(f"  Batch {batch_idx}: expected {len(batch)}, got {len(scores)} — retry {attempt+1}")
            except Exception as e:
                print(f"  Batch {batch_idx} error: {e} — attempt {attempt+1}")
                time.sleep(2)
        else:
            # Fallback: fill with nulls
            print(f"  Batch {batch_idx}: FAILED after 3 attempts, filling with nulls")
            all_scores.extend([{"interest": None, "difficulty": None, "novelty": None}] * len(batch))

        if (batch_idx + 1) % 50 == 0:
            print(f"  Processed {batch_idx + 1}/{len(texts)//10 + 1} batches...")

    # Build output
    records = []
    for i, m in enumerate(meta):
        s = all_scores[i] if i < len(all_scores) else {"interest": None, "difficulty": None, "novelty": None}
        records.append({
            "episode": m.get("episode", "?"),
            "question": m.get("question", ""),
            "interest": s.get("interest"),
            "difficulty": s.get("difficulty"),
            "novelty": s.get("novelty"),
        })

    # Summary stats
    valid = [r for r in all_scores if r.get("interest") is not None]
    avg_i = sum(r["interest"] for r in valid) / len(valid)
    avg_d = sum(r["difficulty"] for r in valid) / len(valid)
    avg_n = sum(r["novelty"] for r in valid) / len(valid)
    print(f"\nScored {len(valid)}/{len(texts)} questions")
    print(f"  Avg interest:    {avg_i:.2f}")
    print(f"  Avg difficulty:  {avg_d:.2f}")
    print(f"  Avg novelty:     {avg_n:.2f}")

    with open(OUT, "w") as f:
        json.dump({"scores": records, "summary": {"avg_interest": round(avg_i,2), "avg_difficulty": round(avg_d,2), "avg_novelty": round(avg_n,2), "n_scored": len(valid)}}, f, indent=2)
    print(f"Saved -> {OUT}")

if __name__ == "__main__":
    main()