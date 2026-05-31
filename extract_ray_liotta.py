#!/usr/bin/env python3
"""Extract all Ray Liotta awards from transcripts."""
import os, re, json

transcripts_dir = "/scratch/b6ar/trvbale.b6ar/transcripts/"
files = sorted(os.listdir(transcripts_dir))

awards = []

for fname in files:
    if not fname.endswith(".txt"):
        continue
    ep_num = fname.replace(".txt", "")
    with open(os.path.join(transcripts_dir, fname)) as f:
        full_text = f.read()

    # Look for the grant line pattern in the full text
    # "it's a Ray Liotta for you, Linda" / "you get a Ray Liotta" / "Ray Liotta, Linda"
    # The pattern goes: question -> answer -> James grants -> "I'm Ray Liotta..." -> "If you build it..."

    # Strategy: find all "I'm Ray Liotta" occurrences (the award announcement)
    # then go backwards to find the grant
    lower = full_text.lower()

    pos = 0
    while True:
        pos = lower.find("i'm ray liotta", pos)
        if pos == -1:
            break

        # Get a chunk before this announcement
        chunk_before = full_text[max(0, pos - 6000):pos]

        # Find the spoken line
        rl_m = re.search(r"I'm Ray Liotta And you're listening to James O'Brien On LBC[^.]*\.", chunk_before, re.IGNORECASE)
        ray_liotta_line = re.sub(r"\s+", " ", rl_m.group(0)).strip() if rl_m else ""

        # Find the grant: go backwards from "I'm Ray Liotta" to find "Ray Liotta for you [Name]"
        grant_chunk = chunk_before[-2000:]
        grant_m = re.search(
            r"(?:it's a Ray Liotta for you|you get a Ray Liotta|you've got a Ray Liotta|that's a Ray Liotta for you|get a Ray Liotta)\s*,?\s*([A-Z][a-z]+)",
            grant_chunk, re.IGNORECASE
        )
        caller_name = grant_m.group(1).strip() if grant_m else "Unknown"

        # Look backwards to find the caller's question (ends with ?)
        # Get last 3000 chars before the announcement
        recent = chunk_before[-3000:]
        # Split into sentences (by period or line breaks)
        sentences = re.split(r'(?<=[.?!])\s+', recent)
        question_text = ""
        answer_text = ""
        qual_reason = ""

        # Find the last sentence ending in ?
        for i, sent in enumerate(reversed(sentences)):
            stripped = sent.strip()
            if stripped.endswith("?"):
                question_text = stripped
                # Answer is the sentence after this question (before the grant)
                if i > 0:
                    answer_sent = sentences[len(sentences) - i]
                    answer_text = answer_sent.strip()
                # Qualification reason is the sentence before the question
                if i > 1:
                    qual_sent = sentences[len(sentences) - i - 1]
                    qual_reason = qual_sent.strip()
                break

        # Fallback: if no sentence ending in ?, try last 300 chars
        if not question_text:
            last_q_idx = recent.rfind("?")
            if last_q_idx != -1:
                question_text = recent[last_q_idx-300:last_q_idx+1].strip()
                answer_text = recent[last_q_idx+1:last_q_idx+400].strip()

        awards.append({
            "episode": ep_num,
            "question": question_text[-500:] if question_text else "",
            "answer": answer_text[-500:] if answer_text else "",
            "caller": caller_name,
            "qualification_reason": qual_reason[-300:] if qual_reason else "",
            "ray_liotta_line": ray_liotta_line[:250] if ray_liotta_line else "",
        })

        pos += 1

by_episode = {}
for a in awards:
    by_episode.setdefault(a["episode"], []).append(a)

print(f"Total Ray Liotta awards: {len(awards)}")
print(f"Episodes with awards: {len(by_episode)}")

for ep in sorted(by_episode.keys())[:5]:
    print(f"\n=== {ep} ({len(by_episode[ep])} awards) ===")
    for a in by_episode[ep]:
        print(f"  Q: {a['question'][:120]}")
        print(f"  A: {a['answer'][:120]}")
        print(f"  Caller: {a['caller']} | Reason: {a['qualification_reason'][:100]}")

with open("/scratch/b6ar/trvbale.b6ar/embeddings/ray_liotta_awards.json", "w") as f:
    json.dump({
        "total_awards": len(awards),
        "episodes_count": len(by_episode),
        "awards": awards,
    }, f, indent=2, ensure_ascii=False)
print("\nSaved -> /scratch/b6ar/trvbale.b6ar/embeddings/ray_liotta_awards.json")