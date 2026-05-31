#!/usr/bin/env python3
"""
episode_summariser.py — 3-sentence summary per episode via MiniMax M2.7.
Uses direct API calls (urllib).
"""

import json, time, urllib.request, re
from pathlib import Path

SCRATCH  = Path("/scratch/b6ar/trvbale.b6ar")
DATA     = SCRATCH / "all_qa.json"
OUT      = SCRATCH / "embeddings" / "episode_summaries.json"

BATCH_SIZE = 3
PROMPT = """Write a 3-sentence summary of this Mystery Hour episode.
Format: "This week James tackled X, Y, and Z." — be specific, name the topics.

Episode questions:
{questions}

Return ONLY the 3-sentence summary (no markdown, no thinking)."""

def chunk(lst, n):
    for i in range(0, len(lst), n):
        yield lst[i:i+n]

def strip_thinking(text):
    text = re.sub(r'<think>.*?', '', text, flags=re.DOTALL).strip()
    return text

def api_call(prompt, max_tokens=300):
    api_key = open("/home/b6ar/trvbale.b6ar/.minimax_token").read().strip()
    data = json.dumps({
        'model': 'MiniMax-M2.7',
        'messages': [{"role": "user", "content": prompt}],
        'max_tokens': max_tokens,
        'skip_thinking': True,
    }).encode()
    req = urllib.request.Request(
        'https://api.minimax.io/v1/text/chatcompletion_v2',
        data=data,
        headers={'Authorization': f'Bearer {api_key}', 'Content-Type': 'application/json'},
        method='POST'
    )
    with urllib.request.urlopen(req, timeout=60) as resp:
        result = json.loads(resp.read())
        raw = strip_thinking(result['choices'][0]['message'].get('content', ''))
        return raw

def main():
    with open(DATA) as f:
        all_qa = json.load(f)

    episodes = all_qa.get("episodes", [])
    print(f"Summarising {len(episodes)} episodes in batches of {BATCH_SIZE}...")
    n_batches = (len(episodes) + BATCH_SIZE - 1) // BATCH_SIZE

    summaries = []
    for batch_idx, batch in enumerate(chunk(episodes, BATCH_SIZE)):
        questions_block = ""
        for ep in batch:
            ep_id = ep.get("episode", "?")
            qs = ep.get("questions", [])
            q_texts = [(q.get("question") or "") for q in qs[:8]]
            questions_block += f"\n=== {ep_id} ===\n" + "\n".join(f"- {q}" for q in q_texts if q)

        prompt = PROMPT.format(questions=questions_block)
        for attempt in range(3):
            try:
                summary = api_call(prompt)
                summaries.append({"episode": batch[0].get("episode", "?"), "summary": summary.strip("```").strip()})
                break
            except Exception as e:
                print(f"  Batch {batch_idx+1}/{n_batches} error: {str(e)[:80]} — attempt {attempt+1}")
                time.sleep(3)
        else:
            summaries.append({"episode": batch[0].get("episode", "?"), "summary": "[summary unavailable]"})

        if (batch_idx + 1) % 20 == 0:
            print(f"  Progress: {batch_idx+1}/{n_batches} batches done...")

    print(f"\nSummarised {len(summaries)} episodes")

    with open(OUT, "w") as f:
        json.dump({"summaries": summaries}, f, indent=2)
    print(f"Saved -> {OUT}")

if __name__ == "__main__":
    main()