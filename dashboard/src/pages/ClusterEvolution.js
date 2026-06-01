/**
 * ClusterEvolution.js — "Cluster Evolution"
 * Topic cluster rise and fall across 6 episode eras.
 * Shows which topics grew and which declined over the show's history.
 */
import { loadJSON } from '../lib/data.js'

function escHtml(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function pct(n, d) {
  return d ? `${(n/d*100).toFixed(1)}%` : '—'
}

export async function renderClusterEvolutionPage(container, store) {
  container.innerHTML = `<div class="loading"><div class="spinner"></div>Loading cluster evolution...</div>`
  try {
    const data = await loadJSON('cluster_evolution.json')
    renderPage(container, data)
  } catch (e) {
    container.innerHTML = `<div class="loading"><div class="spinner"></div><p style="color:#e74c3c">Could not load data.</p></div>`
    console.error(e)
  }
}

function renderPage(container, data) {
  const { era_labels, evolution } = data
  const rising = evolution.filter(r => r.delta > 0.001).sort((a, b) => b.delta - a.delta)
  const falling = evolution.filter(r => r.delta < -0.001).sort((a, b) => a.delta - b.delta)

  const maxVal = Math.max(...evolution.flatMap(r => [r.early, r.late]), 0.001)
  const allClusters = [...rising.slice(0, 8), ...falling.slice(-8).reverse()]

  container.innerHTML = `
    <div class="page-header">
      <h1>📈 Cluster Evolution</h1>
      <p>How have Mystery Hour's topic clusters risen and fallen across 6 episode eras?</p>
    </div>

    <div class="card" style="margin-bottom:24px;background:linear-gradient(135deg,#1a1a2e,#16213e);border:1px solid #0f3460">
      <p style="color:#94a3b8;margin:0;font-size:14px">
        Topics are tracked using KMeans clustering on question embeddings.
        <strong style="color:#fff">Rising</strong> clusters appear more in recent episodes;
        <strong style="color:#fff">falling</strong> clusters have faded over time.
      </p>
    </div>

    <!-- Stacked bar overview: era x top clusters -->
    <div class="card" style="margin-bottom:24px">
      <h2>All Tracked Clusters by Era</h2>
      <div class="evo-stacked">
        ${era_labels.map((label, ei) => {
          const eraVals = {}
          for (const r of evolution) {
            eraVals[r.label] = r.values[ei] || 0
          }
          const sorted = Object.entries(eraVals).sort((a, b) => b[1] - a[1])
          const total = sorted.reduce((s, [, v]) => s + v, 0)
          return `
          <div class="evo-era-col">
            <div class="evo-era-name">${label.split('(')[0].trim()}</div>
            <div class="evo-stacked-bar">
              ${sorted.map(([lbl, v]) => {
                const pct = total > 0 ? v / total : 0
                const terms = lbl
                return `<div class="evo-seg" style="width:${(pct*100).toFixed(1)}%;background:${rising.some(r=>r.label===lbl) ? '#4ade80' : '#f87171'};opacity:${0.4+pct*0.6}" title="${escHtml(terms)}: ${(pct*100).toFixed(1)}%"></div>`
              }).join('')}
            </div>
          </div>`
        }).join('')}
      </div>
      <div style="display:flex;gap:16px;margin-top:8px;font-size:12px">
        <div style="display:flex;align-items:center;gap:6px"><div style="width:12px;height:12px;border-radius:2px;background:#4ade80"></div> Rising</div>
        <div style="display:flex;align-items:center;gap:6px"><div style="width:12px;height:12px;border-radius:2px;background:#f87171"></div> Falling</div>
      </div>
    </div>

    <!-- Rising topics -->
    <div class="card" style="margin-bottom:24px;border-left:4px solid #4ade80">
      <h2>📈 Rising Topics</h2>
      <div class="evo-bars">
        ${rising.slice(0, 10).map(r => `
          <div class="evo-row">
            <div class="evo-label" title="${escHtml(r.label)}">${escHtml(r.label.length > 28 ? r.label.slice(0, 28) + '…' : r.label)}</div>
            <div class="evo-spark">
              <div class="evo-spark-bar evo-start" style="height:${(r.early / maxVal * 100).toFixed(1)}%"></div>
              <div class="evo-spark-bar evo-end" style="height:${(r.late / maxVal * 100).toFixed(1)}%"></div>
            </div>
            <div class="evo-pcts">
              <span style="color:var(--color-muted)">${(r.early*100).toFixed(1)}%</span>
              <span style="color:#4ade80;font-weight:700">+${(r.delta*100).toFixed(1)}%</span>
              <span style="color:var(--color-muted)">${(r.late*100).toFixed(1)}%</span>
            </div>
            <div class="evo-keywords">${(r.keywords || []).slice(0, 3).map(k => `<span class="topic-tag">${escHtml(k)}</span>`).join('')}</div>
          </div>
        `).join('')}
      </div>
    </div>

    <!-- Falling topics -->
    <div class="card" style="margin-bottom:24px;border-left:4px solid #f87171">
      <h2>📉 Declining Topics</h2>
      <div class="evo-bars">
        ${falling.slice(-10).reverse().map(r => `
          <div class="evo-row">
            <div class="evo-label" title="${escHtml(r.label)}">${escHtml(r.label.length > 28 ? r.label.slice(0, 28) + '…' : r.label)}</div>
            <div class="evo-spark">
              <div class="evo-spark-bar evo-start" style="height:${(r.early / maxVal * 100).toFixed(1)}%"></div>
              <div class="evo-spark-bar evo-end" style="height:${(r.late / maxVal * 100).toFixed(1)}%"></div>
            </div>
            <div class="evo-pcts">
              <span style="color:var(--color-muted)">${(r.early*100).toFixed(1)}%</span>
              <span style="color:#f87171;font-weight:700">${(r.delta*100).toFixed(1)}%</span>
              <span style="color:var(--color-muted)">${(r.late*100).toFixed(1)}%</span>
            </div>
            <div class="evo-keywords">${(r.keywords || []).slice(0, 3).map(k => `<span class="topic-tag">${escHtml(k)}</span>`).join('')}</div>
          </div>
        `).join('')}
      </div>
    </div>
  `
}
