/**
 * UMAP.js — interactive 2D scatter plot of all questions
 */
import { Chart, CategoryScale, LinearScale, ScatterController, PointElement, Tooltip, Legend } from 'chart.js'

Chart.register(CategoryScale, LinearScale, ScatterController, PointElement, Tooltip, Legend)

const COLORS = [
  '#6c5ce7','#00b894','#e17055','#0984e3','#fdcb6e','#e84393',
  '#74b9ff','#a29bfe','#55efc4','#fab1a0','#ff7675','#ffeaa7',
  '#dfe6e9','#63b3ed','#9fd36a','#f0a6c8','#48dbfb','#ff9ff3',
  '#feca57','#5f27cd','#01a3a4','#ff6b6b','#c8d6e5','#222f3e',
  '#341f97','#0abde3','#10ac84','#ee5a24','#f36817','#0fbcf9',
  '#00d2d3','#ff9f43','#54a0ff','#2e86de','#c44569','#576574',
]

export function renderUMAP(page, store) {
  page.innerHTML = `
    <div class="page-header">
      <h1>Question Map</h1>
      <p>6,097 questions projected to 2D using UMAP — colored by topic cluster. Hover for question.</p>
    </div>
    <div id="umap-legend" style="display:flex;flex-wrap:wrap;gap:0.4rem;padding:0.75rem 0;border-bottom:1px solid var(--border);margin-bottom:1rem"></div>
    <div id="scatter-wrap" style="position:relative;height:70vh;background:var(--surface);border:1px solid var(--border);border-radius:8px;overflow:hidden">
      <canvas id="scatterChart"></canvas>
    </div>
    <div id="tooltip" style="position:absolute;background:white;border:1px solid #aaa;border-radius:6px;padding:0.6rem;font-size:0.82rem;max-width:350px;pointer-events:none;display:none;z-index:10;box-shadow:0 4px 16px rgba(0,0,0,0.15)"></div>
  `
  loadUMAP()
}

async function loadUMAP() {
  const wrap = document.getElementById('scatter-wrap')
  const tooltip = document.getElementById('tooltip')

  const res = await fetch('/data/umap_coords.json')
  const { coords, labels } = await res.json()

  const n = coords.length
  // Group by cluster label
  const byCluster = {}
  for (let i = 0; i < n; i++) {
    const l = labels[i]
    if (!byCluster[l]) byCluster[l] = []
    byCluster[l].push(i)
  }
  const clusterIds = Object.keys(byCluster).map(Number).sort((a, b) => a - b)

  // Build datasets (one per cluster, sampled if > 200 points)
  const MAX_PTS = 200
  const datasets = clusterIds.map(cid => {
    const indices = byCluster[cid]
    // Subsample if too many
    const pts = indices.length > MAX_PTS
      ? indices.sort(() => Math.random() - 0.5).slice(0, MAX_PTS)
      : indices
    const color = COLORS[Math.abs(cid) % COLORS.length]
    return {
      label: `Cluster ${cid}`,
      cid,
      color,
      data: pts.map(i => ({ x: coords[i][0], y: coords[i][1], idx: i })),
      backgroundColor: color + '66',
      borderColor: color,
      pointRadius: 2,
      pointHoverRadius: 5,
    }
  })

  // Load metadata for tooltips
  const metaRes = await fetch('/data/question_meta.json')
  const meta = await metaRes.json()

  // Cluster label map
  const clusterRes = await fetch('/data/kmeans_k80_stats.json')
  const cStats = await clusterRes.json()
  const clusterLabel = {}
  ;(cStats.clusters || []).forEach(c => { clusterLabel[c.cluster_id] = c.topic_label || c.keywords ? c.keywords[0] : `Cluster ${c.cluster_id}` })

  // Legend
  const legendEl = document.getElementById('umap-legend')
  const hiddenClusters = new Set()
  const legendItems = {}
  datasets.forEach(ds => {
    const item = document.createElement('span')
    item.className = 'cluster-id'
    item.textContent = `${ds.cid}: ${clusterLabel[ds.cid] || `Cluster ${ds.cid}`}`
    item.style.background = ds.color + '33'
    item.style.border = `1px solid ${ds.color}`
    item.style.padding = '0.15rem 0.5rem'
    item.style.borderRadius = '4px'
    item.style.fontSize = '0.72rem'
    item.style.cursor = 'pointer'
    item.style.opacity = '0.85'
    item.onclick = () => {
      const chart = Chart.getChart('scatterChart')
      const idx = datasets.indexOf(ds)
      const meta2 = chart.getDatasetMeta(idx)
      meta2.hidden = !meta2.hidden
      item.style.opacity = meta2.hidden ? '0.3' : '0.85'
      chart.update()
    }
    legendEl.appendChild(item)
    legendItems[ds.cid] = item
  })

  // Build chart
  const chartEl = document.getElementById('scatterChart')
  new Chart(chartEl, {
    type: 'scatter',
    data: { datasets },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          enabled: false,
          mode: 'nearest',
          external: function(context) {
            if (!context.tooltip || !context.tooltip.dataPoints || !context.tooltip.dataPoints.length) {
              tooltip.style.display = 'none'
              return
            }
            const pt = context.tooltip.dataPoints[0]
            const idx = pt.raw.idx
            const m = meta[idx]
            const lbl = clusterLabel[labels[idx]] || `Cluster ${labels[idx]}`
            tooltip.innerHTML = `
              <div style="font-size:0.7rem;color:#888">${m ? m.episode : ''} · ${lbl}</div>
              <div style="margin:0.25rem 0;font-weight:600;font-size:0.88rem">${m ? escHtml(m.question || '') : ''}</div>
              <div style="font-size:0.72rem;color:#888">${m ? escHtml(m.caller || '') : ''}</div>
            `
            tooltip.style.display = 'block'
            tooltip.style.left = (context.event.x + 12) + 'px'
            tooltip.style.top = (context.event.y - 12) + 'px'
          }
        }
      },
      scales: {
        x: {
          display: false,
          grid: { color: '#f0f0f0' },
          title: { display: false }
        },
        y: {
          display: false,
          grid: { color: '#f0f0f0' },
          title: { display: false }
        }
      }
    }
  })
}

function escHtml(s) {
  if (!s) return ''
  return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;')
}
