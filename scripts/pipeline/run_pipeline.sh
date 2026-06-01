#!/bin/bash
#===============================================================================
# Master pipeline script: bootstrap + submit SLURM array job
#
# Usage:
#   ./run_pipeline.sh [--dry-run]
#===============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "${SCRIPT_DIR}"

DRY_RUN=false
if [[ "${1:-}" == "--dry-run" ]]; then
    DRY_RUN=true
    echo "[dry-run] Would run bootstrap and submit SLURM job"
    exit 0
fi

# --- Bootstrap phase ---
echo "=== Phase 1: Bootstrap ==="
python3 bootstrap.py

NUM_EPISODES=$(wc -l < episode_urls.txt)
echo "Found ${NUM_EPISODES} episodes"

# --- Create output directory ---
mkdir -p transcripts

# --- Submit SLURM array job ---
echo "=== Phase 2: Submitting SLURM array job ==="

SBATCH_ARGS=(
    --array=0-603
    --partition=workq
    --nodes=1
    --tasks-per-node=1
    --gres=gpu:1
    --time=00:10:00
    --job-name=mystery-transcribe
    --export=SCRIPT_DIR="${SCRIPT_DIR}"
)
sbatch "${SBATCH_ARGS[@]}" transcribe.sh

echo "SLURM job submitted."
echo ""
echo "Monitor with: squeue -u \$USER -n mystery-transcribe"
echo "Check outputs: ls -la transcripts/"
