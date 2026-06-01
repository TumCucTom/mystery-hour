#!/usr/bin/env python3
"""Extract only genuine Ray Liotta award grants — where James actually gives one."""
import os, re, json

transcripts_dir = "/scratch/b6ar/trvbale.b6ar/transcripts/"
files = sorted(os.listdir(transcripts_dir))

awards = []

GRANT_PATTERNS = [
    r"it's a Ray Liotta for you",
    r"you get a Ray Liotta",
    r"you've got a Ray Liotta",
    r"she got a Ray Liotta",
    r"he got a Ray Liotta",
    r"they got a Ray Liotta",
    r"that's a Ray Liotta for you",
    r"giving you a Ray Liotta",
    r"get a Ray Liotta",
    r"awarding a Ray Liotta",
    r"Ray Liotta[,!?]\s+[A-Z]",  # "Ray Liotta, Linda"
]

for fname in sorted(files):
    if not fname.endswith(".txt"):
        continue
    ep_num = fname.replace(".txt", "")
    with open(os.path.join(transcripts_dir, fname)) as f:
        full_text = f.read()

    lower = full_text.lower()
    idx = 0

    while True:
        idx = lower.find("if you build it", idx)
        if idx == -1:
            break

        # Check if this "if you build it" is preceded by actual grant evidence (within ~800 chars)
        pre = full_text[max(0, idx-800):idx].lower()

        # Check if any grant pattern exists in the pre-award window
        is_grant = any(re.search(p, pre) for p in GRANT_PATTERNS)

        if not is_grant:
            idx += 1
            continue

        # Extract context: up to 5000 chars before "if you build it"
        ctx = full_text[max(0, idx-5000):idx]

        # Find the specific grant pattern text
        grant_line = ""
        for p in GRANT_PATTERNS:
            m = re.search(p, ctx, re.IGNORECASE)
            if m:
                # Grab surrounding text for the grant
                start = max(0, m.start()-60)
                end = min(len(ctx), m.end()+60)
                grant_line = ctx[start:end].strip()
                break

        # Caller name from grant pattern
        caller_match = re.search(r"Ray Liotta[,\s!?]+([A-Z][a-z]+)", ctx, re.IGNORECASE)
        if not caller_match:
            caller_match = re.search(r"(?:for you|to you|give you)\s*,?\s*([A-Z][a-z]+)", ctx, re.IGNORECASE)
        caller_name = caller_match.group(1).strip() if caller_match else "Unknown"

        # Find question: last sentence ending in ? in context (excluding station id)
        sentences = re.split(r'(?<=[.?!])\s+', ctx)
        q_lines = []
        for sent in sentences:
            stripped = sent.strip()
            if stripped.endswith("?") and len(stripped) > 15:
                skip = any(k in stripped.lower() for k in ["lbc", "97.3", "mystery hour",
                    "you're listening", "global", "this is lbc", "the time is"])
                if not skip:
                    q_lines.append(stripped)
        question_text = q_lines[-1] if q_lines else ""

        # Answer: text after the question mark
        if question_text:
            q_pos = ctx.rfind(question_text)
            after = ctx[q_pos + len(question_text):]
            # Take first substantive answer lines
            ans_lines = []
            for line in after.split("\n")[:6]:
                stripped = line.strip()
                if not stripped:
                    continue
                if any(k in stripped.lower() for k in ["lbc", "97.3", "mystery hour",
                    "you're listening", "global", "ray liotta", "if you build", "james"]):
                    continue
                if stripped.lower().startswith("james"):
                    continue
                ans_lines.append(stripped)
            answer_text = " ".join(ans_lines[:4]).strip()
        else:
            answer_text = ""

        # Qualification reason: find sentence just before the question
        if q_lines and len(sentences) > len(q_lines):
            qual_idx = sentences.index(q_lines[-1])
            if qual_idx > 0:
                qual_sent = sentences[qual_idx - 1].strip()
                if qual_sent and len(qual_sent) > 15:
                    question_word = qual_sent.lower().split()[0] if qual_sent.split() else ""
                    if question_word not in ["james", "right", "ok", "yes", "no", "but"]:
                        question_text = qual_sent + " " + question_text
                    else:
                        question_text = qual_sent + " " + question_text

        awards.append({
            "episode": ep_num,
            "question": question_text[-500:] if question_text else "",
            "answer": answer_text[-400:] if answer_text else "",
            "caller": caller_name,
            "grant_line": grant_line[-200:] if grant_line else "",
        })

        idx += 1

by_ep = {}
for a in awards:
    by_ep.setdefault(a["episode"], []).append(a)

print(f"Total genuine Ray Liotta awards: {len(awards)}")
print(f"Episodes: {len(by_ep)}")

for ep in sorted(by_ep.keys())[:5]:
    print(f"\n=== {ep} ===")
    for a in by_ep[ep]:
        print(f"  Q: {a['question'][:120]}")
        print(f"  A: {a['answer'][:120]}")
        print(f"  Caller: {a['caller']} | Grant: {a['grant_line'][:100]}")

with open("/scratch/b6ar/trvbale.b6ar/embeddings/ray_liotta_awards.json", "w") as f:
    json.dump({
        "total_awards": len(awards),
        "episodes_count": len(by_ep),
        "awards": awards,
    }, f, indent=2, ensure_ascii=False)
print("\nSaved -> /scratch/b6ar/trvbale.b6ar/embeddings/ray_liotta_awards.json")