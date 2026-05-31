#!/bin/bash
#===============================================================================
# SLURM task script: extract Q&A from one Mystery Hour transcript
#
# Usage:
#   sbatch --array=0-603 --partition=workq --nodes=1 \
#          --tasks-per-node=1 --time=00:05:00 \
#          --job-name=mystery-extract \
#          extract_qa.sh
#===============================================================================

set -euo pipefail

SCRIPT_DIR="${SCRIPT_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)}"
TASK_ID="${SLURM_ARRAY_TASK_ID:-0}"

# Source environment (API key, paths)
export MINIMAX_API_KEY="${MINIMAX_API_KEY:-}"
export QA_DIR="${QA_DIR:-${SCRATCH:-.}/qa}"
export TRANSCRIPT_DIR="${TRANSCRIPT_DIR:-${SCRATCH:-.}/transcripts}"

mkdir -p "${QA_DIR}"

echo "[$(date)] Task ${TASK_ID}: Starting Q&A extraction..."

python3 "${SCRIPT_DIR}/extract_qa.py" "${TASK_ID}"

echo "[$(date)] Task ${TASK_ID}: Done"
