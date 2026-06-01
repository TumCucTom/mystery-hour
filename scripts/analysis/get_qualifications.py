#!/usr/bin/env python3
"""Extract Ray Liotta awards with Q, A, and qualification reason from transcripts."""
import re, json

RAY_EPS = [
    'ep_003','ep_006','ep_008','ep_018','ep_039','ep_040','ep_066',
    'ep_075','ep_112','ep_116','ep_133','ep_169','ep_176','ep_184','ep_201',
    'ep_210','ep_273','ep_306','ep_318','ep_345','ep_351','ep_399',
    'ep_400','ep_401','ep_402','ep_420',
]
TXT = "/scratch/b6ar/trvbale.b6ar/transcripts/"

results = []

for ep_id in RAY_EPS:
    fname = f"{TXT}{ep_id}.txt"
    try:
        with open(fname) as f:
            text = f.read()
    except:
        results.append({"episode": ep_id, "error": "file not found"})
        continue

    ibi = text.lower().find("if you build it")
    if ibi == -1:
        results.append({"episode": ep_id, "error": "no if-you-build-it"})
        continue

    # 5000 chars before "if you build it"
    chunk = text[max(0, ibi - 5000):ibi]

    # Find caller name near "Ray Liotta"
    rl_pos = chunk.lower().rfind("ray liotta")
    name_ctx = chunk[max(0, rl_pos - 400):rl_pos + 200] if rl_pos != -1 else chunk[-600:]

    caller = "Unknown"
    nm = re.search(r"(?:to|for|give it to|you,?\s+)([A-Z][a-z]+)(?:\s|$|,|\.|!|\?|:)", name_ctx, re.IGNORECASE)
    if not nm:
        nm = re.search(r"(?:this is|hi|hello|it's|caller)\s+([A-Z][a-z]+)", name_ctx, re.IGNORECASE)
    if not nm:
        nm = re.search(r"([A-Z][a-z]+)\s*,?\s*(?:you get a Ray Liotta)", chunk, re.IGNORECASE)
    if nm:
        caller = nm.group(1).strip()

    # Find qualification: look for sentences with because/qualification/expertise near the grant
    qual = ""
    qual_patterns = [
        r"because[^.?!]{10,200}[.?!]",
        r"qualification[^.?!]{5,100}[.?!]",
        r"expertise[^.?!]{5,100}[.?!]",
        r"you'?ve? (?:done|studied|made|got|have a|got a)[^.?!]{10,150}[.?!]",
        r"(?:I'?m a|he'?s a|she'?s a|they'?re a)[^.?!]{10,150}[.?!]",
        r"(?:what a|superb|magnificent|sensational)[^.?!]{5,100}[.?!]",
    ]
    for qpat in qual_patterns:
        qm = re.search(qpat, chunk[-2000:], re.IGNORECASE)
        if qm:
            qual = qm.group(0).strip()
            break

    # Find question: last sentence ending in ? in chunk
    sents = re.split(r'(?<=[.?!])\s+', chunk)
    q_candidates = []
    for s in sents:
        s2 = s.strip()
        if s2.endswith('?') and len(s2) > 15:
            skip = any(k in s2.lower() for k in ["lbc","97.3","mystery hour","global","the time is","you are listening"])
            if not skip:
                q_candidates.append(s2)
    question = q_candidates[-1] if q_candidates else ""

    # Answer: text after question mark, before grant
    answer = ""
    if question:
        qp = chunk.rfind(question)
        if qp != -1:
            after_q = chunk[qp + len(question):qp + len(question) + 500]
            alines = []
            for l in after_q.split('\n')[:6]:
                ls = l.strip()
                if ls and len(ls) > 3:
                    skip_a = any(k in ls.lower() for k in ["lbc","97.3","mystery hour","global","ray liotta","if you build","james"])
                    if not skip_a:
                        alines.append(ls)
            answer = " ".join(alines[:4])

    results.append({
        "episode": ep_id,
        "caller": caller,
        "qualification": qual[-300:] if qual else "",
        "question": question[-400:] if question else "",
        "answer": answer[-400:] if answer else "",
    })

for r in results:
    print(f"\n=== {r['episode']} | {r['caller']} ===")
    if "error" in r:
        print(f"  ERROR: {r['error']}")
        continue
    print(f"  QUAL: {r['qualification'][:200]}")
    print(f"  Q: {r['question'][:150]}")
    print(f"  A: {r['answer'][:200]}")

with open("/scratch/b6ar/trvbale.b6ar/embeddings/ray_liotta_qualifications.json","w") as f:
    json.dump(results, f, indent=2, ensure_ascii=False)
print("\n\nSaved -> /scratch/b6ar/trvbale.b6ar/embeddings/ray_liotta_qualifications.json")