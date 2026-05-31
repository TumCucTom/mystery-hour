#!/usr/bin/env /home/b5av/alinelena.b5av/mace-lammps-torch-2.6.0/bin/python3
"""
Convert NPZ cluster data to JSON for browser consumption.
Run after building embeddings.
"""
import sys
sys.path.insert(0, '/scratch/b6ar/trvbale.b6ar/.local/lib/python3.11/site-packages')
import json, numpy as np
from pathlib import Path

BASE = Path('/scratch/b6ar/trvbale.b6ar/embeddings')
OUT = Path('/home/b6ar/trvbale.b6ar/scratch/mystery-hour/dashboard/public/data')
OUT.mkdir(parents=True, exist_ok=True)

# Copy JSON files
for name in ['kmeans_k80_stats.json', 'kmeans_k120_stats.json',
             'question_meta.json', 'all_qa.json',
             'recurring_questions.json', 'duplicates.json']:
    src = BASE / name
    dst = OUT / name
    if src.exists():
        import shutil
        shutil.copy(src, dst)
        print(f'Copied {name}')

# Convert UMAP NPZ to JSON
npz = BASE / 'umap_2d_coords.npz'
if npz.exists():
    data = np.load(npz)
    coords = data['coords'].tolist()
    labels = data['labels'].tolist()
    out = {'coords': coords, 'labels': labels}
    with open(OUT / 'umap_coords.json', 'w') as f:
        json.dump(out, f)
    print(f'Converted umap_coords.json ({len(coords)} points)')
else:
    print('umap_2d_coords.npz not found — run umap_visualize.py first')

print('Done!')
