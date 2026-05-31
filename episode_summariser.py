#!/usr/bin/env python3
"""
episode_summariser.py — 3-sentence summary per episode via MiniMax M2.7.

Batches episodes at 3 per API call → ~200 calls for 601 episodes.
Each summary: "This week James tackled topic A, topic B, and topic C."
Output: episode_summaries.json
"""

import json, time
from pathlib import Path
from minimax import MiniMax

SCRATCH  = Path("/scratch/b6ar/trvbale.b6ar")
DATA     = SCRATCH / "all_qa.json"
OUT      = SCRATCH / "embeddings" / "episode_summaries.json"

PROMPT = """Write a 3-sentence summary of this Mystery Hour episode.
Format: "This week James tackled X, Y, and Z." — be specific, name the topics.
If a question was particularly memorable, mention it.

Episode questions:
{questions}

Return ONLY the 3-sentence summary, no markdown, no quotes."""

def chunk(lst, n):
    for i in range(0, len(lst), n):
        yield lst[i:i+n]

def main():
    with open(DATA) as f:
        all_qa = json.load(f)

    episodes = all_qa.get("episodes", [])
    print(f"Summarising {len(episodes)} episodes in batches of 3...")

    api_key = open("/home/b6ar/trvbale.b6ar/.minimax_token").read().strip()
    client = MiniMax(api_key=api_key)

    summaries = []
    for batch_idx, batch in enumerate(chunk(episodes, 3)):
        # Build prompt with all questions from up to 3 episodes
        questions_block = ""
        for ep in batch:
            ep_id = ep.get("episode", "?")
            qs = ep.get("questions", [])
            q_texts = [q.get("question", "") for q in qs[:8]]  # max 8 per ep
            questions_block += f"\n=== {ep_id} ===\n" + "\n".join(f"- {q}" for q in q_texts if q)

        prompt = PROMPT.format(questions=questions_block)
        for attempt in range(3):
            try:
                resp = client.chat.completions.create(
                    model="MiniMax-Embedding-Large",
                    messages=[{"role": "user", "content": prompt}],
                    max_tokens=300,
                )
                summary = resp.choices[0].message.content.strip()
                # Strip any markdown
                summary = summary.strip("```").strip()
                summaries.append({"episode": batch[0].get("episode", "?"), "summary": summary})
                break
            except Exception as e:
                print(f"  Batch {batch_idx} error: {e} — attempt {attempt+1}")
                time.sleep(3)
        else:
            summaries.append({"episode": batch[0].get("episode", "?"), "summary": "[summary unavailable]"})

        if (batch_idx + 1) % 20 == 0:
            print(f"  Processed {batch_idx + 1}/{len(episodes)//3 + 1} batches...")

    print(f"\nSummarised {len(summaries)} episodes")

    with open(OUT, "w") as f:
        json.dump({"summaries": summaries}, f, indent=2)
    print(f"Saved -> {OUT}")

if __name__ == "__main__":
    main()