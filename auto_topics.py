#!/usr/bin/env python3
"""
auto_topics.py — Fine-grained topic tags per question via MiniMax M2.7.
Uses direct API calls (urllib).
"""

import json, time, urllib.request, re
from pathlib import Path
from collections import Counter

SCRATCH   = Path("/scratch/b6ar/trvbale.b6ar")
META_JSON = SCRATCH / "embeddings" / "question_meta.json"
OUT       = SCRATCH / "embeddings" / "question_topics.json"

BATCH_SIZE = 10
TOPIC_TAXONOMY = """Topics (select all that apply): etymology, language, history, geography, science,
biology, physics, chemistry, maths, medicine, health, psychology, philosophy,
food, drink, cooking, animals, plants, nature, weather, climate, transport,
trains, planes, cars, roads, cities, countries, UK, Europe, world,
politics, law, crime, war, religion, culture, art, music, film, TV, literature,
sports, football, cricket, golf, tennis, unexplained, conspiracy, trivia,
accents, dialects, words, phrases, idioms, names, celebrity,
royalty, monarchy, social, relationships, education, work, money,
finance, business, technology, internet, phones, computers, space, astronomy"""

PROMPT = (
    "For each question below, assign topic tags from this taxonomy:\n"
    "{taxonomy}\n\n"
    "Return ONLY a valid JSON array (no markdown, no thinking): "
    '[{{"topics": ["tag1", "tag2", ...]}}, ...]\n\n'
    "Questions:\n{questions}"
)

def chunk(lst, n):
    for i in range(0, len(lst), n):
        yield lst[i:i+n]

def strip_thinking(text):
    text = re.sub(r'<think>.*?', '', text, flags=re.DOTALL).strip()
    return text

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
        raw = strip_thinking(result['choices'][0]['message'].get('content', ''))
        return raw

def main():
    with open(META_JSON) as f:
        meta = json.load(f)

    texts = [m.get("question") or "(empty)" for m in meta]
    print(f"Tagging {len(texts)} questions in batches of {BATCH_SIZE}...")
    n_batches = (len(texts) + BATCH_SIZE - 1) // BATCH_SIZE

    all_tags = []
    for batch_idx, batch in enumerate(chunk(texts, BATCH_SIZE)):
        prompt = PROMPT.format(taxonomy=TOPIC_TAXONOMY, questions="\n".join(f"{i+1}. {q}" for i, q in enumerate(batch)))

        for attempt in range(3):
            try:
                raw = api_call(prompt)
                if raw.startswith("```"):
                    raw = raw.split("```")[1]
                    if raw.startswith("json"):
                        raw = raw[4:]
                tags_batch = json.loads(raw.strip())
                if len(tags_batch) == len(batch):
                    all_tags.extend(tags_batch)
                    break
                else:
                    print(f"  Batch {batch_idx+1}/{n_batches}: expected {len(batch)}, got {len(tags_batch)}")
            except Exception as e:
                print(f"  Batch {batch_idx+1}/{n_batches} error: {str(e)[:80]} — attempt {attempt+1}")
                time.sleep(3)
        else:
            all_tags.extend([{"topics": []}] * len(batch))

        if (batch_idx + 1) % 20 == 0:
            print(f"  Progress: {batch_idx+1}/{n_batches} batches done...")

    records = []
    for i, m in enumerate(meta):
        t = all_tags[i]["topics"] if i < len(all_tags) else []
        records.append({
            "episode": m.get("episode", "?"),
            "question": m.get("question", ""),
            "topics": t,
        })

    topic_counts = Counter()
    for r in records:
        for t in r.get("topics", []):
            topic_counts[t] += 1

    print(f"\nTagged {len(records)} questions")
    print(f"  Top topics: {topic_counts.most_common(10)}")

    with open(OUT, "w") as f:
        json.dump({"questions": records, "topic_counts": dict(topic_counts.most_common(50))}, f, indent=2)
    print(f"Saved -> {OUT}")

if __name__ == "__main__":
    main()