#!/bin/bash
#SBATCH --job-name=mystery_llm_qq      # question quality scorer
#SBATCH --nodes=1
#SBATCH --ntasks-per-node=1
#SBATCH --time=04:00:00
#SBATCH --output=/scratch/b6ar/trvbale.b6ar/slurm_logs/qq_%J.out
#SBATCH --error=/scratch/b6ar/trvbale.b6ar/slurm_logs/qq_%J.err

module load python/3.11
export PATH="/scratch/b6ar/trvbale.b6ar/miniforge3/bin:$PATH"
export PYTHONPATH="/scratch/b6ar/trvbale.b6ar/.local/lib/python3.11/site-packages:$PYTHONPATH"

cd /home/b6ar/trvbale.b6ar/scratch/mystery-hour

echo "Starting question_quality_scorer.py at $(date)"
/home/b5av/alinelena.b5av/mace-lammps-torch-2.6.0/bin/python3 question_quality_scorer.py
echo "Done at $(date)"