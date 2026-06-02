/**
 * Anomalies.js — "Anomaly Detection"
 * Questions furthest from their cluster centroid in UMAP space — the weirdest questions.
 */
import { loadJSON } from '../lib/data.js'

function escHtml(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

export async function renderAnomaliesPage(container) {
  container.innerHTML = `<div class="loading"><div class="spinner"></div>Loading anomaly detection...</div>`
  try {
    const [anomalies, clusterWorst] = await Promise.all([
      loadJSON('anomalies.json'),
      loadJSON('cluster_worst.json'),
    ])
    renderPage(container, anomalies, clusterWorst)
  } catch (e) {
    container.innerHTML = `<div class="loading"><div class="spinner"></div><p style="color:#e74c3c">${e.message}</p></div>`
    console.error(e)
  }
}

function renderPage(container, data, clusterWorst) {
  const anomalies = data.most_anomalous || []
  const cluster_info = {}
  for (const c of (clusterWorst.ranked_clusters || [])) {
    cluster_info[c.cluster] = c
  }

  // Generate 80 visually distinct HSL colours, deterministic per cluster id.
  // Golden-angle hue rotation gives good separation across the wheel.
  const colour = (cid) => {
    const id = (cid || 0) % 80
    const hue = (id * 137.508) % 360 // golden angle
    const sat = 65 + (id % 3) * 5    // 65-75%
    const light = 55 + ((id >> 1) % 3) * 4 // 55-63%
    return `hsl(${hue.toFixed(0)}, ${sat}%, ${light}%)`
  }

  container.innerHTML = `
    <div class="page-header">
      <h1>🌀 Anomaly Detection</h1>
      <p>Questions furthest from their cluster centroid in UMAP space — the weirdest, most off-topic questions in the show's history.</p>
    </div>

    <div class="card" style="margin-bottom:24px;background:linear-gradient(135deg,#1a1a2e,#16213e);border:1px solid #0f3460">
      <p style="color:#94a3b8;margin:0;font-size:14px">
        Mean distance: <strong style="color:#fff">${(data.summary?.mean_dist||0).toFixed(3)}</strong>.
        These questions sit on the edges of their topic clusters — either brilliantly niche or just strange.
      </p>
    </div>

    <div class="card">
      <h2>Top 80 Anomalies</h2>
      <div style="display:flex;flex-wrap:wrap;gap:8px;margin-bottom:16px">
        <input type="text" id="anSearch" placeholder="Filter questions…" style="padding:8px;border-radius:6px;border:1px solid var(--color-border);background:var(--color-bg);color:var(--color-text);flex:1;min-width:200px">
        <select id="anFilter" style="padding:8px;border-radius:6px;background:var(--color-bg);color:var(--color-text)">
          <option value="all">All</option>
          <option value="unresolved">Unresolved only</option>
          <option value="overturned">Overturned only</option>
        </select>
      </div>
      <div class="an-list" id="anList"></div>
    </div>
  `

  const listEl = container.querySelector('#anList')
  const searchEl = container.querySelector('#anSearch')
  const filterEl = container.querySelector('#anFilter')

  function render(filter = 'all', q = '') {
    const ql = q.toLowerCase()
    const filtered = anomalies.filter(a => {
      if (filter === 'unresolved' && a.resolved) return false
      if (filter === 'overturned' && !a.overturned) return false
      if (ql && !(a.question||'').toLowerCase().includes(ql) && !String(a.cluster).includes(ql)) return false
      return true
    })

    listEl.innerHTML = filtered.slice(0, 80).map(a => {
      const ci = cluster_info[a.cluster] || {}
      const label = ci.label || `Cluster ${a.cluster}`
      return `
      <div class="an-item">
        <div class="an-dist-bar">
          <div class="an-dist-fill" style="width:${Math.min((a.dist / anomalies[0].dist) * 100, 100).toFixed(1)}%"></div>
        </div>
        <div class="an-body">
          <div class="an-q">${escHtml(a.question.slice(0, 160))}…</div>
          <div class="an-meta">
            <a href="/episodes?ep=${a.ep}" class="nav-link" data-link>${a.ep}</a>
            <span class="topic-tag" style="background:${colour(a.cluster)};color:#fff;font-size:9px">${escHtml(label.slice(0,20))}</span>
            <span style="font-size:11px;color:var(--color-muted)">dist=${a.dist.toFixed(3)}</span>
            ${a.overturned ? '<span style="font-size:11px;color:var(--color-red)">☠ overturned</span>' : ''}
            ${!a.resolved ? '<span style="font-size:11px;color:var(--color-yellow)">✗ unresolved</span>' : ''}
          </div>
        </div>
      </div>`
    }).join('')

    listEl.querySelectorAll('a[data-link]').forEach(a => {
      a.addEventListener('click', e => { e.preventDefault(); history.pushState(null,'',a.href); window.dispatchEvent(new PopStateEvent('popstate')) })
    })
  }

  render()
  searchEl.addEventListener('input', () => render(filterEl.value, searchEl.value))
  filterEl.addEventListener('change', () => render(filterEl.value, searchEl.value))
}
