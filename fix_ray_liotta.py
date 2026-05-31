#!/usr/bin/env python3
import re, os, json

transcripts_dir = "/scratch/b6ar/trvbale.b6ar/transcripts/"

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
    r"you've got one now",           # genuine grants
    r"for (?:jack| linda| [A-Z][a-z]+),? you're getting",   # "for Linda, you're getting a Ray Liotta"
    r"for (?:jack| linda| [A-Z][a-z]+)\s+i'?m ray",   # "for Jack I'm Ray Liotta"
    r"ray leota",                  # misspelling of "ray liotta" in transcripts
]

SKIP_WORDS = ["lbc", "97.3", "mystery hour", "you are listening", "global", "the time is", "gigaclear", "eero", "amazon", "switch to", "faster broadband", "cosmic quasars"]

awards = []

for fname in sorted(os.listdir(transcripts_dir)):
    if not fname.endswith(".txt"):
        continue
    ep_num = fname.replace(".txt", "")
    with open(os.path.join(transcripts_dir, fname)) as f:
        text = f.read()

    lower = text.lower()

    # Find all "if you build it" occurrences
    search_from = 0
    while True:
        ibi_pos = lower.find("if you build it", search_from)
        if ibi_pos == -1:
            break

        # Check a window of 2000 chars before "if you build it"
        window_start = max(0, ibi_pos - 2000)
        window = text[window_start:ibi_pos]
        window_lower = window.lower()

        # Is there a grant pattern in this window?
        found_grant = False
        for pat in GRANT_PATTERNS:
            if re.search(pat, window, re.IGNORECASE):
                found_grant = True
                break

        if not found_grant:
            search_from = ibi_pos + 1
            continue

        # Caller name from window
        cm = re.search(r"Ray Liotta[,\s]+([A-Z][a-z]+)", window, re.IGNORECASE)
        caller = cm.group(1) if cm else "Unknown"

        # Question: last sentence ending in ? in window
        sents = re.split(r'(?<=[.?!])\s+', window)
        q_candidates = []
        for s in sents:
            s2 = s.strip()
            if s2.endswith('?') and len(s2) > 15:
                skip = any(k in s2.lower() for k in SKIP_WORDS)
                if not skip:
                    q_candidates.append(s2)
        question = q_candidates[-1] if q_candidates else ""

        # Answer: after the question mark, before the grant
        answer = ""
        if question:
            qpos = window.rfind(question)
            if qpos != -1:
                after = window[qpos + len(question):qpos + len(question) + 500]
                alines = []
                for l in after.split('\n')[:6]:
                    ls = l.strip()
                    if ls and not any(k in ls.lower() for k in SKIP_WORDS + ["ray liotta", "james"]):
                        alines.append(ls)
                answer = " ".join(alines[:4])

        awards.append({
            "episode": ep_num,
            "question": question[-300:],
            "answer": answer[-300:],
            "caller": caller,
        })

        search_from = ibi_pos + 1

print(f"Total genuine awards: {len(awards)}")
for a in awards[:5]:
    print(f"  [{a['episode']}] {a['caller']}: Q={a['question'][:80]}")
    if a['answer']:
        print(f"    A: {a['answer'][:80]}")

with open("/scratch/b6ar/trvbale.b6ar/embeddings/ray_liotta_awards.json","w") as f:
    json.dump({
        "total_awards": len(awards),
        "episodes_count": len({a['episode'] for a in awards}),
        "awards": awards,
    }, f, indent=2, ensure_ascii=False)
print("Saved")