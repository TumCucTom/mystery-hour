#!/usr/bin/env python3
"""
auto_topics.py — Fine-grained 50+ topic tags per question via MiniMax M2.7.

Each question is tagged with one or more topics from a predefined taxonomy.
Uses MiniMax to classify/tag each question batch.
Output: question_topics.json
"""

import json, time
from pathlib import Path
from minimax import MiniMax

SCRATCH  = Path("/scratch/b6ar/trvbale.b6ar")
META_JSON = SCRATCH / "embeddings" / "question_meta.json"
OUT      = SCRATCH / "embeddings" / "question_topics.json"

TOPIC_TAXONOMY = """Topics (select all that apply): etymology, language, history, geography, science,
biology, physics, chemistry, maths, medicine, health, psychology, philosophy,
food, drink, cooking, animals, plants, nature, weather, climate, transport,
trains, planes, cars, roads, geography, cities, countries, UK, Europe, world,
politics, law, crime, war, religion, culture, art, music, film, TV, literature,
sports, football, cricket, golf, tennis, unexplained, conspiracy, trivia,
language, accents, dialects, words, phrases, idioms, names, celebrity,
royalty, monarchy, social, relationships, psychology, education, work, money,
finance, business, technology, internet, phones, computers, space, astronomy,
earth, planets, dinosaurs, evolution, genetics, environment, gardening"""

PROMPT = """For each question below, assign topic tags from this taxonomy:
{taxonomy}

Return ONLY a valid JSON array (no markdown):
[
  {{"topics": ["tag1", "tag2", ...]}},
  ...
]

Questions:
{questions}"""

def chunk(lst, n):
    for i in range(0, len(lst), n):
        yield lst[i:i+n]

def main():
    with open(META_JSON) as f:
        meta = json.load(f)

    texts = [m.get("question", "(empty)") for m in meta]
    print(f"Tagging {len(texts)} questions in batches of 10...")

    api_key = open("/home/b6ar/trvbale.b6ar/.minimax_token").read().strip()
    client = MiniMax(api_key=api_key)

    all_tags = []
    for batch_idx, batch in enumerate(chunk(texts, 10)):
        prompt = PROMPT.format(taxonomy=TOPIC_TAXONOMY, questions="\n".join(f"{i+1}. {q}" for i, q in enumerate(batch)))
        for attempt in range(3):
            try:
                resp = client.chat.completions.create(
                    model="MiniMax-Embedding-Large",
                    messages=[{"role": "user", "content": prompt}],
                    max_tokens=512,
                )
                raw = resp.choices[0].message.content.strip()
                if raw.startswith("```"):
                    raw = raw.split("```")[1]
                    if raw.startswith("json"):
                        raw = raw[4:]
                tags_batch = json.loads(raw)
                if len(tags_batch) == len(batch):
                    all_tags.extend(tags_batch)
                    break
                else:
                    print(f"  Batch {batch_idx}: expected {len(batch)}, got {len(tags_batch)}")
            except Exception as e:
                print(f"  Batch {batch_idx} error: {e} — attempt {attempt+1}")
                time.sleep(2)
        else:
            all_tags.extend([{"topics": []}] * len(batch))

        if (batch_idx + 1) % 50 == 0:
            print(f"  Processed {batch_idx + 1}/{len(texts)//10 + 1} batches...")

    # Build output
    records = []
    for i, m in enumerate(meta):
        t = all_tags[i]["topics"] if i < len(all_tags) else []
        records.append({
            "episode": m.get("episode", "?"),
            "question": m.get("question", ""),
            "topics": t,
        })

    # Count topics
    from collections import Counter
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