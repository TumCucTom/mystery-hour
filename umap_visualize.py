#!/usr/bin/env /home/b5av/alinelena.b5av/mace-lammps-torch-2.6.0/bin/python3
import sys
sys.path.insert(0, '/scratch/b6ar/trvbale.b6ar/.local/lib/python3.11/site-packages')
"""
UMAP 2D visualization of Mystery Hour question clusters.
Outputs an HTML scatter plot with cluster coloring.

Usage:
  /home/b5av/.../python3 umap_visualize.py
"""
import json, numpy as np, os
from pathlib import Path

OUT_DIR = Path("/scratch/b6ar/trvbale.b6ar/embeddings")

# Check if umap_2d_coords.npz exists, if not compute it
coords_path = OUT_DIR / "umap_2d_coords.npz"

if not coords_path.exists():
    print("Computing UMAP 2D (this takes ~3-5 min)...")
    try:
        import umap
    except:
        os.system("/home/b5av/alinelena.b5av/mace-lammps-torch-2.6.0/bin/pip install --target=/scratch/b6ar/trvbale.b6ar/.local/lib/python3.11/site-packages umap-learn")
        import umap

    emb = np.load(OUT_DIR / "question_embeddings.npz")["embeddings"]
    from sklearn.preprocessing import normalize
    emb_norm = normalize(emb, axis=1)

    reducer = umap.UMAP(n_neighbors=20, n_components=2, min_dist=0.2,
                        metric='euclidean', random_state=42, verbose=False)
    coords = reducer.fit_transform(emb_norm)

    # Load k=80 labels
    labels = np.load(OUT_DIR / "kmeans_k80_labels.npz")["labels"]
    np.savez(coords_path, coords=coords, labels=labels)
    print(f"Saved UMAP coords: {coords.shape}")
else:
    print("Loading cached UMAP coords...")
    data = np.load(coords_path)
    coords = data["coords"]
    labels = data["labels"]
    print(f"Loaded: {coords.shape}")

with open(OUT_DIR / "kmeans_k80_stats.json") as f:
    cluster_stats = json.load(f)["clusters"]
with open(OUT_DIR / "question_meta.json") as f:
    meta = json.load(f)

print(f"UMAP: {coords.shape}, labels: {labels.shape}, clusters: {len(cluster_stats)}")

# Cluster ID → topic label
cluster_label = {c["cluster_id"]: c.get("topic_label", c.get("keywords", ["?"])[0] if c.get("keywords") else "?")
                  for c in cluster_stats}

# Build HTML
html = """<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>UMAP — Mystery Hour Questions</title>
  <script src="https://cdn.jsdelivr.net/npm/chart.js@4"></script>
  <script src="https://cdn.jsdelivr.net/npm/chartjs-plugin-scatter@1.1.0"></script>
  <style>
    body { margin: 0; font-family: sans-serif; background: #fafafa; }
    h1 { padding: 1rem; margin: 0; background: #6c5ce7; color: white; font-size: 1.3rem; }
    #chart-wrap { position: relative; height: 80vh; padding: 0 1rem; }
    #tooltip { position: absolute; background: white; border: 1px solid #aaa; border-radius: 6px; padding: 0.6rem; font-size: 0.82rem; max-width: 350px; pointer-events: none; display: none; z-index: 10; box-shadow: 0 4px 16px rgba(0,0,0,0.2); }
    .t-episode { font-size: 0.7rem; color: #888; }
    .t-question { margin: 0.3rem 0; font-weight: 600; }
    .t-meta { font-size: 0.7rem; color: #666; }
    #cluster-legend { display: flex; flex-wrap: wrap; gap: 0.4rem; padding: 0.75rem 1rem; border-bottom: 1px solid #eee; background: white; }
    .legend-item { font-size: 0.72rem; padding: 0.15rem 0.5rem; border-radius: 4px; cursor: pointer; opacity: 0.85; }
    .legend-item:hover { opacity: 1; }
  </style>
</head>
<body>
<h1>🔮 Mystery Hour — Question Map (UMAP · BAAI/bge-base-en-v1.5)</h1>
<div id="cluster-legend"></div>
<div id="chart-wrap">
  <canvas id="scatterChart"></canvas>
</div>
<div id="tooltip"></div>
<script>
const CLUSTER_COLORS = [
  '#6c5ce7','#00b894','#e17055','#0984e3','#fdcb6e','#e84393',
  '#74b9ff','#a29bfe','#55efc4','#fab1a0','#ff7675','#ffeaa7',
  '#dfe6e9','#63b3ed','#9fd36a','#f0a6c8','#48dbfb','#ff9ff3',
  '#feca57','#5f27cd','#01a3a4','#ff6b6b','#c8d6e5','#222f3e',
  '#341f97','#0abde3','#10ac84','#ee5a24','#f36817','#0fbcf9',
  '#00d2d3','#ff9f43','#54a0ff','#2e86de','#5f27cd','#c44569',
  '#576574','#222f3e','#1e272e','#8344a4','#a855f7','#d946ef',
  '#0ea5e9','#22c55e','#eab308','#ef4444','#84cc16','#06b6d4'
];
"""

# Encode data inline
import json as js
coords_list = coords.tolist()
labels_list = labels.tolist()
meta_serializable = [{"question": (m.get("question") or "")[:150], "episode": m.get("episode",""), "caller": m.get("caller","")} for m in meta]

html += f"""
const COORDS = JSON.parse('{js.dumps(coords_list)}');
const LABELS = JSON.parse('{js.dumps(labels_list)}');
const META = JSON.parse('{js.dumps(meta_serializable)}');
const CLUSTER_LABEL = {js.dumps({str(k): v for k, v in {c["cluster_id"]: c.get("topic_label","?") for c in cluster_stats}.items()})};

// Build datasets per cluster
const clusters = [...new Set(LABELS)];
const datasets = clusters.map(c => {{
  const pts = COORDS.map(([x,y], i) => LABELS[i] === c ? {{x, y, idx: i}} : null).filter(Boolean);
  return {{
    label: CLUSTER_LABEL[String(c)] || `Cluster ${{c}}`,
    data: pts,
    backgroundColor: CLUSTER_COLORS[c % CLUSTER_COLORS.length] + '88',
    borderColor: CLUSTER_COLORS[c % CLUSTER_COLORS.length],
    pointRadius: 2.5,
    pointHoverRadius: 5,
  }};
}});

const chart = new Chart(document.getElementById('scatterChart'), {{
  type: 'scatter',
  data: {{ datasets }},
  options: {{
    responsive: true,
    maintainAspectRatio: false,
    plugins: {{
      legend: {{ display: false }},
      tooltip: {{
        enabled: false,
        external: function(context) {{
          const t = document.getElementById('tooltip');
          if (!context.tooltip || !context.tooltip.dataPoints || !context.tooltip.dataPoints.length) {{
            t.style.display = 'none'; return;
          }}
          const pt = context.tooltip.dataPoints[0];
          const idx = pt.raw.idx;
          const m = META[idx];
          t.innerHTML = `<div class='t-episode'>${{m.episode}}</div><div class='t-question'>${{m.question}}</div><div class='t-meta'>Cluster ${{LABELS[idx]}} · ${{m.caller || ''}}</div>`;
          t.style.display = 'block';
          t.style.left = (context.event.x + 12) + 'px';
          t.style.top = (context.event.y - 12) + 'px';
        }}
      }}
    }},
    scales: {{
      x: {{ title: {{ display: false }}, ticks: {{ display: false }},
             grid: {{ color: '#f0f0f0' }} }},
      y: {{ title: {{ display: false }}, ticks: {{ display: false }},
             grid: {{ color: '#f0f0f0' }} }}
    }}
  }}
}});

// Build legend
const legendEl = document.getElementById('cluster-legend');
datasets.forEach((ds, ci) => {{
  const item = document.createElement('span');
  item.className = 'legend-item';
  item.style.background = ds.borderColor + '33';
  item.style.border = '1px solid ' + ds.borderColor;
  item.textContent = `[${{ci+1}}] ${{ds.label.substring(0, 30)}}`;
  item.onclick = () => {{
    const meta = chart.getDatasetMeta(ci);
    meta.hidden = !meta.hidden;
    item.style.opacity = meta.hidden ? '0.3' : '0.85';
    chart.update();
  }};
  legendEl.appendChild(item);
}});
</script>
</body>
</html>"""

out_path = Path("/home/b6ar/trvbale.b6ar/scratch/mystery-hour/dashboard/templates/umap.html")
with open(out_path, "w") as f:
    f.write(html)
print(f"Saved: {out_path}")
print(f"Open in browser: http://localhost:5000/umap")