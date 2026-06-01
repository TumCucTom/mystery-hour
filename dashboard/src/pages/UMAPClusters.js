/**
 * UMAPClusters.js — "Topic Universe"
 * Enhanced UMAP visualization with per-cluster topic labels and question browsing.
 * Uses pre-computed UMAP coordinates and KMeans cluster labels.
 */
import { loadJSON } from '../lib/data.js'

function escHtml(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

export async function renderUMAPClustersPage(container, store) {
  container.innerHTML = `<div class="loading"><div class="spinner"></div>Loading 6,097 question embeddings...</div>`
  try {
    const [umap, meta, k80] = await Promise.all([
      loadJSON('umap_coords.json'),
      loadJSON('question_meta.json'),
      loadJSON('kmeans_k80_stats.json'),
    ])
    renderPage(container, umap, meta, k80)
  } catch (e) {
    container.innerHTML = `<div class="loading"><div class="spinner"></div><p style="color:#e74c3c">Could not load UMAP data.</p></div>`
    console.error(e)
  }
}

function renderPage(container, umap, meta, k80) {
  const coords = umap.coords || []
  const labels = umap.labels || []
  const clusters = k80.clusters || []

  // Cluster summary: top terms per cluster
  const clusterTerms = {}
  for (const c of clusters) {
    const terms = ((c.top_terms || c.terms || []).slice(0, 6))
    clusterTerms[c.cluster_id ?? c.cluster] = terms
  }

  // Build points data
  const points = coords.map((c, i) => ({
    x: c[0], y: c[1],
    label: labels[i],
    meta: meta[i],
  }))

  // Compute bounds for viewBox
  const xs = points.map(p => p.x)
  const ys = points.map(p => p.y)
  const minX = Math.min(...xs), maxX = Math.max(...xs)
  const minY = Math.min(...ys), maxY = Math.max(...ys)

  const VW = 900, VH = 650
  const pad = 30

  function toSvgX(x) { return pad + ((x - minX) / (maxX - minX || 1)) * (VW - 2 * pad) }
  function toSvgY(y) { return pad + ((y - minY) / (maxY - minY || 1)) * (VH - 2 * pad) }

  // Get unique labels for coloring
  const uniqueLabels = [...new Set(labels)]
  const colorMap = {}
  const palette = [
    '#f87171','#fb923c','#fbbf24','#a3e635','#34d399','#22d3ee',
    '#60a5fa','#a78bfa','#f472b6','#e879f9','#94a3b8','#f87171',
    '#4ade80','#2dd4bf','#818cf8','#c084fc','#fb7185','#facc15',
  ]
  uniqueLabels.forEach((l, i) => { colorMap[l] = palette[i % palette.length] })

  // Centroid of each cluster
  const centroids = {}
  for (const p of points) {
    if (!centroids[p.label]) centroids[p.label] = { x: 0, y: 0, count: 0 }
    centroids[p.label].x += p.x
    centroids[p.label].y += p.y
    centroids[p.label].count++
  }
  for (const l in centroids) {
    const c = centroids[l]
    c.x /= c.count
    c.y /= c.count
  }

  // Selected cluster state
  const selectedCluster = { id: null }

  container.innerHTML = `
    <div class="page-header">
      <h1>🌀 Topic Universe</h1>
      <p>6,097 questions positioned by semantic similarity. Hover clusters for topic labels. Click to explore.</p>
    </div>

    <div class="card" style="margin-bottom:24px">
      <div style="display:flex;align-items:center;gap:16px;flex-wrap:wrap;margin-bottom:12px">
        <div style="font-weight:600">Jump to cluster:</div>
        ${uniqueLabels.slice(0, 30).map(l => `
          <button class="topic-tag cluster-jump-btn" data-cluster="${l}" style="cursor:pointer;background:${colorMap[l] || '#60a5fa'};color:#fff;border:none">${l}</button>
        `).join('')}
      </div>
      ${uniqueLabels.length > 30 ? `<div style="color:var(--color-muted);font-size:13px">Showing 30 of ${uniqueLabels.length} clusters. Use search to filter.</div>` : ''}
    </div>

    <div class="card" style="margin-bottom:24px">
      <div style="overflow:auto;border-radius:8px;background:#0d1b2a">
        <svg id="umapSvg" viewBox="0 0 ${VW} ${VH}" style="width:100%;max-width:${VW}px;display:block;margin:0 auto;cursor:crosshair">
          <defs>
            <filter id="umap-glow"><feGaussianBlur stdDeviation="1.5" result="blur"/><feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
          </defs>
          <!-- Grid lines -->
          ${[0.25, 0.5, 0.75].map(t => `
            <line x1="${pad}" y1="${pad + t * (VH - 2 * pad)}" x2="${VW - pad}" y2="${pad + t * (VH - 2 * pad)}" stroke="rgba(255,255,255,0.05)" stroke-dasharray="4,4"/>
            <line x1="${pad + t * (VW - 2 * pad)}" y1="${pad}" x2="${pad + t * (VW - 2 * pad)}" y2="${VH - pad}" stroke="rgba(255,255,255,0.05)" stroke-dasharray="4,4"/>
          `).join('')}
          <!-- Centroid labels -->
          ${uniqueLabels.map(l => {
            const c = centroids[l]
            if (!c) return ''
            const cx = toSvgX(c.x), cy = toSvgY(c.y)
            const terms = clusterTerms[l] || []
            return `
            <g class="umap-cluster-label" data-cluster="${l}" style="cursor:pointer">
              <circle cx="${cx}" cy="${cy}" r="20" fill="${colorMap[l] || '#60a5fa'}" opacity="0.2"/>
              <text x="${cx}" y="${cy - 26}" text-anchor="middle" fill="${colorMap[l] || '#60a5fa'}" font-size="11" font-weight="700" filter="url(#umap-glow)">${l}</text>
              ${terms.slice(0, 2).map((t, ti) => `
                <text x="${cx}" y="${cy - 12 + ti * 12}" text-anchor="middle" fill="rgba(255,255,255,0.6)" font-size="9">${escHtml(t.length > 15 ? t.slice(0, 15) + '…' : t)}</text>
              `).join('')}
            </g>`
          }).join('')}
          <!-- Points: render only a subset for performance (every 3rd point + selected cluster) -->
          ${points.filter((p, i) => i % 3 === 0 || (selectedCluster.id !== null && p.label === selectedCluster.id)).map(p => `
            <circle cx="${toSvgX(p.x)}" cy="${toSvgY(p.y)}" r="2.5"
              fill="${colorMap[p.label] || '#60a5fa'}"
              opacity="0.7"
              class="umap-point"
              data-meta-index="${meta.indexOf(p.meta)}"
              data-cluster="${p.label}"
            />
          `).join('')}
        </svg>
      </div>
    </div>

    <!-- Cluster detail -->
    <div id="clusterDetail" class="card" style="display:none;margin-bottom:24px"></div>

    <!-- Cluster browser -->
    <div class="card">
      <h2>Browse Clusters</h2>
      <input type="text" id="clusterSearch" placeholder="Filter by cluster ID or topic term…" style="margin-bottom:16px;padding:10px;border-radius:8px;border:1px solid var(--color-border);width:100%;max-width:400px;background:var(--color-bg);color:var(--color-text)">
      <div id="clusterBrowser" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:16px"></div>
    </div>
  `

  const svg = container.querySelector('#umapSvg')
  const detailEl = container.querySelector('#clusterDetail')
  const browserEl = container.querySelector('#clusterBrowser')

  // Cluster labels click
  svg.querySelectorAll('.umap-cluster-label').forEach(g => {
    g.addEventListener('click', () => {
      const l = parseInt(g.dataset.cluster)
      selectedCluster.id = l
      showClusterDetail(l, points, meta, clusterTerms, colorMap, detailEl)
      highlightCluster(l, svg)
    })
  })

  // Cluster jump buttons
  container.querySelectorAll('.cluster-jump-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const l = parseInt(btn.dataset.cluster)
      selectedCluster.id = l
      showClusterDetail(l, points, meta, clusterTerms, colorMap, detailEl)
      highlightCluster(l, svg)
    })
  })

  // Point hover tooltip
  svg.addEventListener('mousemove', e => {
    const rect = svg.getBoundingClientRect()
    const mx = (e.clientX - rect.left) / rect.width * VW
    const my = (e.clientY - rect.top) / rect.height * VH
    // Find nearest point
    let nearest = null, nearestDist = Infinity
    for (const p of points) {
      const dx = toSvgX(p.x) - mx, dy = toSvgY(p.y) - my
      const d = Math.sqrt(dx*dx + dy*dy)
      if (d < nearestDist && d < 20) { nearestDist = d; nearest = p }
    }
    // Simple title approach
    svg.title = nearest ? `${nearest.meta?.caller || ''}\n${nearest.meta?.question?.slice(0, 80) || ''}` : ''
  })

  // Cluster browser
  function renderBrowser(filter = '') {
    const q = filter.toLowerCase()
    const filtered = uniqueLabels.filter(l => {
      if (!q) return true
      const terms = (clusterTerms[l] || []).join(' ').toLowerCase()
      return String(l).includes(q) || terms.includes(q)
    })

    browserEl.innerHTML = filtered.sort((a, b) => a - b).map(l => {
      const terms = (clusterTerms[l] || []).join(', ')
      const count = points.filter(p => p.label === l).length
      const resolved = points.filter(p => p.label === l && p.meta?.resolved).length
      const rate = count ? Math.round(resolved / count * 100) : 0
      return `
      <div class="cluster-card" data-cluster="${l}" style="border-left:4px solid ${colorMap[l] || '#60a5fa'}">
        <div class="cluster-card-header">
          <span class="cluster-id" style="color:${colorMap[l] || '#60a5fa'};font-weight:700">Cluster ${l}</span>
          <span class="cluster-count">${count} Q · ${rate}% ✓</span>
        </div>
        <div class="cluster-terms">${terms}</div>
        <div style="margin-top:8px">
          <button class="topic-tag browse-detail-btn" data-cluster="${l}" style="cursor:pointer;font-size:12px">Explore →</button>
        </div>
      </div>`
    }).join('')

    browserEl.querySelectorAll('.browse-detail-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const l = parseInt(btn.dataset.cluster)
        selectedCluster.id = l
        showClusterDetail(l, points, meta, clusterTerms, colorMap, detailEl)
        detailEl.scrollIntoView({ behavior: 'smooth' })
      })
    })
  }
  renderBrowser()
  container.querySelector('#clusterSearch').addEventListener('input', e => renderBrowser(e.target.value))
}

function showClusterDetail(l, points, meta, clusterTerms, colorMap, detailEl) {
  const clusterPoints = points.filter(p => p.label === l).slice(0, 20)
  const clusterMeta = clusterPoints.map(p => p.meta).filter(Boolean)
  const terms = (clusterTerms[l] || []).join(', ')

  detailEl.style.display = 'block'
  detailEl.innerHTML = `
    <div style="display:flex;align-items:center;gap:12px;margin-bottom:12px">
      <h2 style="margin:0">Cluster ${l}</h2>
      <span class="topic-tag" style="background:${colorMap[l] || '#60a5fa'};color:#fff;font-size:13px">${clusterPoints.length} questions</span>
    </div>
    <div style="margin-bottom:12px;font-size:14px;color:var(--color-muted)">${escHtml(terms)}</div>
    <div class="results-list">
      ${clusterMeta.map((m, i) => `
        <div class="result-item card" style="margin:4px 0">
          <div class="result-rank">#${i + 1}</div>
          <div class="result-body">
            <div class="result-question">${escHtml(m.question?.slice(0, 180) || '')}</div>
            <div class="result-meta">
              <a href="/episodes?ep=${m.episode}" class="nav-link" data-link>${m.episode}</a>
              ${m.caller ? ` · ${escHtml(m.caller)}` : ''}
              · ${m.resolved ? '✓ Resolved' : '✗ Unresolved'}
            </div>
          </div>
        </div>
      `).join('')}
    </div>
  `
  detailEl.querySelectorAll('a[data-link]').forEach(a => {
    a.addEventListener('click', e => { e.preventDefault(); history.pushState(null, '', a.href); window.dispatchEvent(new PopStateEvent('popstate')) })
  })
}

function highlightCluster(l, svg) {
  svg.querySelectorAll('.umap-point').forEach(circle => {
    const isSelected = circle.dataset.cluster === String(l)
    circle.setAttribute('r', isSelected ? '5' : '2.5')
    circle.setAttribute('opacity', isSelected ? '1' : '0.3')
  })
}
