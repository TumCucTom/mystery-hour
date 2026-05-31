#!/bin/bash
#===============================================================================
# SLURM task script: download + transcribe one Mystery Hour episode
#
# Expected environment variables:
#   SLURM_ARRAY_TASK_ID  - episode index (0-based)
#   TRANSCRIPT_DIR        - output directory for transcripts
#   EPISODE_URLS_FILE     - path to episode_urls.txt
#
# Notes:
#   - Uses openai-whisper with mace-lammps torch (CUDA-enabled GH200)
#   - Python packages installed to SCRATCH/whisper_no_torch
#   - Whisper model cached at ~/.cache/whisper — reused across tasks
#===============================================================================

set -euo pipefail

# --- Paths ---
SCRIPT_DIR="${SCRIPT_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)}"
TASK_ID="${SLURM_ARRAY_TASK_ID:-0}"
TRANSCRIPT_DIR="${TRANSCRIPT_DIR:-${SCRATCH:-.}/transcripts}"
EPISODE_URLS_FILE="${EPISODE_URLS_FILE:-${SCRIPT_DIR}/episode_urls.txt}"
SCRATCH_DIR="${SCRATCH:-/scratch/b6ar/trvbale.b6ar}"
WHISPER_DIR="${SCRATCH_DIR}/whisper_no_torch"
MACE_PYTHON="/home/b5av/alinelena.b5av/mace-lammps-torch-2.6.0/bin/python3"

# Whisper / HF cache — store in scratch, not home
export HF_HOME="${SCRATCH_DIR}/cache/hf"
export WHISPER_CACHE="${SCRATCH_DIR}/cache/whisper"
export XDG_CACHE_HOME="${SCRATCH_DIR}/.cache"
export TRANSFORMERS_CACHE="${SCRATCH_DIR}/cache/transformers"
MP3_FILE="${SCRATCH_DIR}/ep_${TASK_ID}.mp3"
OUTPUT_TXT="${TRANSCRIPT_DIR}/ep_$(printf '%03d' "${TASK_ID}").txt"
FAILED_FILE="${TRANSCRIPT_DIR}/ep_${TASK_ID}_failed.txt"
MODEL="${MODEL:-large}"

# Prepend mace-lammps torch path so it wins over any bundled torch
export PYTHONPATH="${WHISPER_DIR}:${MACE_PYTHON}/../lib/python3.11/site-packages"

# --- Setup ---
mkdir -p "${TRANSCRIPT_DIR}"
mkdir -p "${WHISPER_DIR}"

# --- Cleanup MP3 on exit ---
cleanup() {
    rm -f "${MP3_FILE}"
}
trap cleanup EXIT

# --- Fail helper ---
fail() {
    echo "[$(date)] FAILED: $*" >&2
    touch "${FAILED_FILE}"
    exit 0
}

# --- Get episode URL ---
if [[ ! -f "${EPISODE_URLS_FILE}" ]]; then
    fail "episode_urls.txt not found at ${EPISODE_URLS_FILE}"
fi

URL=$(sed -n "$((TASK_ID + 1))p" "${EPISODE_URLS_FILE}")
if [[ -z "${URL}" ]]; then
    fail "No URL found for episode index ${TASK_ID}"
fi

echo "[$(date)] Task ${TASK_ID}: Downloading ${URL}"

# --- Download with retry ---
if ! curl -s -L --fail --retry 1 --retry-delay 5 -o "${MP3_FILE}" "${URL}"; then
    fail "Download failed after retries"
fi

if [[ ! -s "${MP3_FILE}" ]]; then
    fail "Downloaded file is empty"
fi

echo "[$(date)] Task ${TASK_ID}: Transcribing..."

# --- Transcribe via openai-whisper Python API ---
${MACE_PYTHON} - <<PYEOF
import sys
import os
import torch
import av
import numpy as np

# Ensure mace-lammps torch is used (CUDA support)
assert torch.cuda.is_available(), "CUDA not available"

sys.path.insert(0, "${WHISPER_DIR}")
import whisper

# Monkey-patch: use PyAV instead of ffmpeg for audio loading
import whisper.audio as _audio

def _patched_load_audio(file, sr=16000):
    import io
    with open(file, 'rb') as f:
        mp3_data = f.read()
    bio = io.BytesIO(mp3_data)
    container = av.open(bio)
    audio_stream = container.streams.audio[0]
    orig_sr = audio_stream.rate
    all_samples = []
    for packet in container.demux(audio_stream):
        for frame in packet.decode():
            arr = frame.to_ndarray()
            all_samples.append(arr.T.flatten())
    audio = np.concatenate(all_samples).astype(np.float32)
    if audio_stream.channels > 1:
        audio = audio.reshape(-1, audio_stream.channels).mean(axis=1)
    waveform = torch.from_numpy(audio).float().unsqueeze(0)
    if orig_sr != sr:
        import torchaudio.functional as F
        waveform = F.resample(waveform, orig_sr, sr)
    return waveform.squeeze(0).numpy()

_audio.load_audio = _patched_load_audio

print(f"[${TASK_ID}] Loading model ${MODEL}...")
model = whisper.load_model("${MODEL}", device="cuda")

print(f"[${TASK_ID}] Running transcription...")
result = model.transcribe("${MP3_FILE}", language="en")

with open("${OUTPUT_TXT}", "w") as f:
    f.write(result["text"] + "\n")

print(f"[${TASK_ID}] Written to ${OUTPUT_TXT}")
PYEOF

# --- Verify output ---
if [[ ! -s "${OUTPUT_TXT}" ]]; then
    fail "Transcript file not created or empty"
fi

echo "[$(date)] Task ${TASK_ID}: Done → ${OUTPUT_TXT}"
