#!/usr/bin/env python3
"""
Extract Q&A pairs from Mystery Hour transcripts using MiniMax API.
"""

import os
import sys
import json
import time
import subprocess
from pathlib import Path
from typing import Optional, Dict, Any

# ── Config ────────────────────────────────────────────────────────────────────
SCRIPT_DIR = Path(__file__).parent
TRANSCRIPT_DIR = os.environ.get("TRANSCRIPT_DIR", str(SCRIPT_DIR.parent / "transcripts"))
QA_DIR = os.environ.get("QA_DIR", str(SCRIPT_DIR / "qa"))
API_KEY = os.environ.get("MINIMAX_API_KEY", "")
BASE_URL = "https://api.minimax.io/v1"
MODEL = "MiniMax-M2.7"
TIMEOUT = 300  # 5 min per transcript

os.makedirs(QA_DIR, exist_ok=True)

# ── Prompt ─────────────────────────────────────────────────────────────────────
SYSTEM_PROMPT = """You are an expert analyst of radio call-in transcripts.
Extract ALL questions and answers from this Mystery Hour episode.

For each question, record:
- caller: string (name and location if given, e.g. "Neil from Farnham")
- question: string (the full question asked)
- context: string (any important context from the caller)

For each answer to that question, record:
- caller: string (who gave the answer)
- answer: string (the full answer text)
- overturned: bool (was this answer later corrected/overturned by another caller or James?)
- final: bool (is this the final/correct answer?)

Also note:
- resolved: bool (did they reach a satisfying answer?)
- topics: list[string] (brief topic tags)

Return ONLY valid JSON in this exact format, no markdown or commentary:
{
  "episode": "ep_XXX",
  "topics": ["topic1", "topic2"],
  "questions": [
    {
      "caller": "Name (Location)",
      "question": "The question text",
      "context": "Any context the caller gave",
      "answers": [
        {"caller": "Name", "answer": "Answer text", "overturned": false, "final": true}
      ],
      "resolved": true
    }
  ]
}
"""

USER_PROMPT_TEMPLATE = """Extract ALL questions and answers from this Mystery Hour transcript. There may be MANY questions in this transcript - do not stop after finding just 2 or 3. List every single question caller asked and every answer given. Return valid JSON with all Q&A pairs.

Transcript:
{transcript}
"""

# ── API call ─────────────────────────────────────────────────────────────────
def extract_with_minimax(transcript: str, episode: str) -> Dict[str, Any]:
    """Call MiniMax API to extract Q&A from transcript."""
    if not API_KEY:
        raise ValueError("MINIMAX_API_KEY not set")

    url = f"{BASE_URL}/chat/completions"
    payload = {
        "model": MODEL,
        "messages": [
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": USER_PROMPT_TEMPLATE.format(transcript=transcript)},
        ],
        "temperature": 0.1,
    }

    curl_cmd = [
        "curl", "-s", "-X", "POST", url,
        "-H", f"Authorization: Bearer {API_KEY}",
        "-H", "Content-Type: application/json",
        "-d", json.dumps(payload),
        "--max-time", str(TIMEOUT),
    ]

    proc = subprocess.run(curl_cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, timeout=TIMEOUT + 10)
    stdout = proc.stdout.decode("utf-8") if isinstance(proc.stdout, bytes) else proc.stdout
    stderr = proc.stderr.decode("utf-8") if isinstance(proc.stderr, bytes) else proc.stderr

    if proc.returncode != 0:
        raise RuntimeError(f"curl failed: {stderr}")

    try:
        resp = json.loads(stdout)
    except json.JSONDecodeError:
        raise RuntimeError(f"Invalid JSON response: {stdout[:500]}")

    if "error" in resp:
        raise RuntimeError(f"API error: {resp['error']}")

    # Navigate to the content
    content = resp["choices"][0]["message"]["content"]

    # Strip <think>...</think> thinking tags if present
    # The actual answer comes after the last </think>
    think_end = "</think>"
    if think_end in content:
        text = content.split(think_end)[-1].strip()
    else:
        text = content.strip()

    # Strip markdown code fences
    if text.startswith("```"):
        lines = text.split("\n")
        text = "\n".join(lines[1:-1] if lines[-1].strip() == "```" else lines[1:])

    return json.loads(text)


# ── Main ──────────────────────────────────────────────────────────────────────
def process_episode(episode_num: int) -> Optional[Dict[str, Any]]:
    """Process a single episode. Returns the result dict or None on failure."""
    ep_str = f"ep_{episode_num:03d}"
    transcript_path = Path(TRANSCRIPT_DIR) / f"{ep_str}.txt"
    qa_path = Path(QA_DIR) / f"{ep_str}_qa.json"

    if not transcript_path.exists():
        print(f"[{ep_str}] Transcript not found, skipping")
        return None

    if qa_path.exists():
        print(f"[{ep_str}] QA already extracted, skipping")
        with open(qa_path) as f:
            return json.load(f)

    print(f"[{ep_str}] Reading transcript...")
    with open(transcript_path) as f:
        transcript = f.read().strip()

    if not transcript:
        print(f"[{ep_str}] Empty transcript, skipping")
        return None

    print(f"[{ep_str}] Extracting Q&A ({len(transcript)} chars)...")
    for attempt in range(3):
        try:
            result = extract_with_minimax(transcript, ep_str)
            result["episode"] = ep_str
            with open(qa_path, "w") as f:
                json.dump(result, f, indent=2)
            print(f"[{ep_str}] Saved -> {qa_path} ({len(result.get('questions', []))} Qs)")
            return result
        except Exception as e:
            print(f"[{ep_str}] Attempt {attempt+1} failed: {e}")
            time.sleep(5 * (attempt + 1))

    print(f"[{ep_str}] FAILED after 3 attempts")
    return None


def main():
    if len(sys.argv) < 2:
        print("Usage: extract_qa.py <episode_num>")
        sys.exit(1)

    episode_num = int(sys.argv[1])
    result = process_episode(episode_num)
    if result is None:
        sys.exit(1)


if __name__ == "__main__":
    main()
