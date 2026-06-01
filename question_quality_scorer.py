#!/usr/bin/env python3
"""
question_quality_scorer.py — rate each question on three dimensions:
  Interest (1-5), Difficulty (1-5), Novelty (1-5)
Uses MiniMax M2.7 via direct API (urllib). skip_thinking=True.
"""

import json, time, urllib.request, re
from pathlib import Path

SCRATCH    = Path("/scratch/b6ar/trvbale.b6ar")
META_JSON  = SCRATCH / "embeddings" / "question_meta.json"
OUT        = SCRATCH / "embeddings" / "question_quality_scores.json"

BATCH_SIZE = 10
PROMPT_TEMPLATE = (
    "You must respond with ONLY a valid JSON array, nothing else.\n"
    "No thinking, no explanation, no markdown -- just the array.\n"
    "Format: [{{'interest': N, 'difficulty': N, 'novelty': N}}, ...]\n"
    "One entry per question, same order.\n\nQuestions:\n{questions}"
)

def chunk(lst, n):
    for i in range(0, len(lst), n):
        yield lst[i:i+n]

def extract_json(text):
    """Extract JSON array from response content.
    The thinking block may contain JSON-like text from the prompt.
    We only parse content AFTER the last  tag."""
    parts = text.rsplit('', 1)
    search_text = parts[-1] if len(parts) > 1 else text

    m = re.search(r'\[\s*\{', search_text)
    if not m:
        return None

    start = m.start()
    depth = 0
    in_str = False
    for i in range(start, len(search_text)):
        c = search_text[i]
        if c == '"' and (i == 0 or search_text[i-1] != '\\'):
            in_str = not in_str
        elif not in_str:
            if c == '[':
                depth += 1
            elif c == ']':
                depth -= 1
                if depth == 0:
                    try:
                        return json.loads(search_text[start:i+1])
                    except:
                        return None
    return None

def api_call(prompt, max_tokens=512):
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
        return result['choices'][0]['message'].get('content', '')

def main():
    with open(META_JSON) as f:
        meta = json.load(f)

    texts = [m.get("question") or "(empty)" for m in meta]
    print(f"Scoring {len(texts)} questions in batches of {BATCH_SIZE}...")

    all_scores = []
    n_batches = (len(texts) + BATCH_SIZE - 1) // BATCH_SIZE

    for batch_idx, batch in enumerate(chunk(texts, BATCH_SIZE)):
        prompt = PROMPT_TEMPLATE.format(questions="\n".join(f"{i+1}. {q}" for i, q in enumerate(batch)))

        for attempt in range(3):
            try:
                raw = api_call(prompt)
                scores = extract_json(raw)
                if scores and len(scores) == len(batch):
                    all_scores.extend(scores)
                    break
                elif scores:
                    print(f"  Batch {batch_idx+1}/{n_batches}: got {len(scores)} expected {len(batch)} -- retry {attempt+1}")
                else:
                    print(f"  Batch {batch_idx+1}/{n_batches}: no JSON found (raw: {raw[:80]}) -- retry {attempt+1}")
            except Exception as e:
                print(f"  Batch {batch_idx+1}/{n_batches} error: {str(e)[:80]} -- attempt {attempt+1}")
                time.sleep(3)
        else:
            print(f"  Batch {batch_idx+1}/{n_batches}: FAILED, filling nulls")
            all_scores.extend([{"interest": None, "difficulty": None, "novelty": None}] * len(batch))

        if (batch_idx + 1) % 20 == 0:
            print(f"  Progress: {batch_idx+1}/{n_batches}")

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

    valid = [r for r in all_scores if r.get("interest") is not None]
    avg_i = avg_d = avg_n = 0
    if valid:
        avg_i = sum(r["interest"] for r in valid) / len(valid)
        avg_d = sum(r["difficulty"] for r in valid) / len(valid)
        avg_n = sum(r["novelty"] for r in valid) / len(valid)

    print(f"\nScored {len(valid)}/{len(texts)} questions. Avg I={avg_i:.2f} D={avg_d:.2f} N={avg_n:.2f}")

    with open(OUT, "w") as f:
        json.dump({"scores": records, "summary": {"avg_interest": round(avg_i,2), "avg_difficulty": round(avg_d,2), "avg_novelty": round(avg_n,2), "n_scored": len(valid)}}, f, indent=2)
    print(f"Saved -> {OUT}")

if __name__ == "__main__":
    main()