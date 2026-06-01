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
    const terms = (c.keywords || c.top_terms || c.terms || []).slice(0, 6)
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

  // Pre-group points by cluster (every 3rd point, matching original sampling)
  const pointsByCluster = {}
  for (let i = 0; i < points.length; i++) {
    if (i % 3 !== 0) continue
    const p = points[i]
    if (!pointsByCluster[p.label]) pointsByCluster[p.label] = []
    pointsByCluster[p.label].push(p)
  }

  // Cluster stats for sorting
  const clusterSizes = {}
  const clusterResolved = {}
  const clusterAvgAnswers = {}
  for (const c of clusters) {
    const id = c.cluster_id ?? c.cluster
    clusterSizes[id] = c.size || 0
    clusterResolved[id] = c.resolved_rate ?? 0
    clusterAvgAnswers[id] = c.avg_answers ?? 0
  }

  // Animation state
  const animState = {
    mode: 'most-elements',
    speed: 4,
    currentIndex: 0,
    isPlaying: false,
    timer: null,
    sortedLabels: [],
  }

  function computeSortedLabels() {
    const labels = [...uniqueLabels]
    if (animState.mode === 'most-elements') {
      labels.sort((a, b) => (clusterSizes[b] || 0) - (clusterSizes[a] || 0))
    } else {
      // best-clustering: highest resolved_rate, tiebreak by size desc
      labels.sort((a, b) => {
        const rd = (clusterResolved[b] || 0) - (clusterResolved[a] || 0)
        if (Math.abs(rd) > 1e-6) return rd
        return (clusterSizes[b] || 0) - (clusterSizes[a] || 0)
      })
    }
    return labels
  }
  animState.sortedLabels = computeSortedLabels()

  // Selected cluster state
  const selectedCluster = { id: null }

  container.innerHTML = `
    <div class="page-header">
      <h1>🌀 Topic Universe</h1>
      <p>6,097 questions positioned by semantic similarity. Press play to watch the clusters bloom, or click any cluster to explore.</p>
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

    <!-- Cluster reveal animation -->
    <div class="card" id="animCard" style="margin-bottom:24px">
      <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:16px;margin-bottom:14px">
        <div>
          <h2 style="margin:0 0 4px 0;font-size:18px">Cluster Reveal</h2>
          <div style="color:var(--color-muted);font-size:13px">Watch the ${uniqueLabels.length} clusters appear one by one. Pick the order that interests you.</div>
        </div>
        <div style="display:flex;gap:8px;align-items:center">
          <button id="animPlay" class="anim-btn anim-btn-primary" type="button" aria-label="Play">▶ Play</button>
          <button id="animReset" class="anim-btn" type="button" aria-label="Reset">↺ Reset</button>
        </div>
      </div>

      <div style="display:flex;flex-wrap:wrap;gap:24px;align-items:center;margin-bottom:14px">
        <div>
          <div style="font-size:12px;color:var(--color-muted);margin-bottom:6px;text-transform:uppercase;letter-spacing:0.06em;font-weight:600">Sort by</div>
          <div role="tablist" style="display:inline-flex;background:var(--color-bg);border:1px solid var(--color-border);border-radius:10px;padding:3px;gap:2px">
            <button class="anim-mode-btn anim-mode-active" data-mode="most-elements" type="button" role="tab" aria-selected="true">Most Elements</button>
            <button class="anim-mode-btn" data-mode="best-clustering" type="button" role="tab" aria-selected="false" title="Clusters whose questions are most often resolved (best=highest resolved rate)">Best Clustering</button>
          </div>
        </div>
        <div>
          <div style="font-size:12px;color:var(--color-muted);margin-bottom:6px;text-transform:uppercase;letter-spacing:0.06em;font-weight:600">Speed <span id="animSpeedVal" style="color:var(--color-text)">${animState.speed}/s</span></div>
          <input id="animSpeed" type="range" min="1" max="12" step="1" value="${animState.speed}" style="width:160px;vertical-align:middle">
        </div>
        <div style="flex:1;min-width:200px">
          <div style="font-size:12px;color:var(--color-muted);margin-bottom:6px;text-transform:uppercase;letter-spacing:0.06em;font-weight:600">Progress</div>
          <div style="height:8px;background:var(--color-bg);border:1px solid var(--color-border);border-radius:999px;overflow:hidden">
            <div id="animProgressBar" style="height:100%;width:0%;background:linear-gradient(90deg,#8B5CF6,#FF7A1A);transition:width 250ms ease-out"></div>
          </div>
          <div id="animProgress" style="font-size:13px;color:var(--color-text);margin-top:6px">0 / ${uniqueLabels.length} clusters · 0 / 6,097 questions revealed</div>
        </div>
      </div>

      <div>
        <div style="font-size:12px;color:var(--color-muted);margin-bottom:8px;text-transform:uppercase;letter-spacing:0.06em;font-weight:600">Reveal order</div>
        <div id="animRevealList" class="anim-reveal-list"></div>
      </div>
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
          <!-- Centroid labels: grouped by cluster for animation reveal -->
          ${uniqueLabels.map(l => {
            const c = centroids[l]
            if (!c) return ''
            const cx = toSvgX(c.x), cy = toSvgY(c.y)
            const terms = clusterTerms[l] || []
            return `
            <g class="cluster-group umap-cluster-label" data-cluster="${l}" style="cursor:pointer">
              <circle cx="${cx}" cy="${cy}" r="20" fill="${colorMap[l] || '#60a5fa'}" opacity="0.2"/>
              <text x="${cx}" y="${cy - 26}" text-anchor="middle" fill="${colorMap[l] || '#60a5fa'}" font-size="11" font-weight="700" filter="url(#umap-glow)">${l}</text>
              ${terms.slice(0, 2).map((t, ti) => `
                <text x="${cx}" y="${cy - 12 + ti * 12}" text-anchor="middle" fill="rgba(255,255,255,0.6)" font-size="9">${escHtml(t.length > 15 ? t.slice(0, 15) + '…' : t)}</text>
              `).join('')}
            </g>`
          }).join('')}
          <!-- Points: grouped by cluster for animation reveal -->
          ${uniqueLabels.map(l => {
            const pts = pointsByCluster[l] || []
            return `
            <g class="cluster-group" data-cluster="${l}">
              ${pts.map(p => `
                <circle cx="${toSvgX(p.x)}" cy="${toSvgY(p.y)}" r="2.5"
                  fill="${colorMap[p.label] || '#60a5fa'}"
                  opacity="0.7"
                  class="umap-point"
                  data-meta-index="${meta.indexOf(p.meta)}"
                  data-cluster="${p.label}"
                />
              `).join('')}
            </g>`
          }).join('')}
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

  // ============= Cluster reveal animation =============

  // Inject styles for cluster groups + controls (only once)
  if (!document.getElementById('umap-anim-styles')) {
    const style = document.createElement('style')
    style.id = 'umap-anim-styles'
    style.textContent = `
      .cluster-group { opacity: 0; transition: opacity 600ms ease-out; }
      .cluster-group.revealed { opacity: 1; }
      .cluster-group.reveal-flash circle:first-child { animation: umapFlash 900ms ease-out; transform-origin: center; }
      @keyframes umapFlash {
        0%   { opacity: 0.2; }
        40%  { opacity: 1; }
        100% { opacity: 0.2; }
      }
      .anim-btn {
        background: white;
        border: 1px solid var(--color-border);
        color: var(--color-text);
        padding: 8px 14px;
        border-radius: 10px;
        font-size: 14px;
        font-weight: 500;
        cursor: pointer;
        transition: background 120ms, border-color 120ms;
      }
      .anim-btn:hover { background: var(--color-bg); }
      .anim-btn-primary {
        background: #8B5CF6;
        color: white;
        border-color: #8B5CF6;
      }
      .anim-btn-primary:hover { background: #7c4ee0; }
      .anim-mode-btn {
        background: transparent;
        border: none;
        color: var(--color-text);
        padding: 7px 14px;
        font-size: 13px;
        font-weight: 500;
        cursor: pointer;
        border-radius: 8px;
        transition: background 120ms, color 120ms;
      }
      .anim-mode-btn:hover { background: rgba(0,0,0,0.04); }
      .anim-mode-btn.anim-mode-active {
        background: white;
        color: var(--color-text);
        box-shadow: 0 1px 3px rgba(20,18,14,0.08);
      }
      .anim-reveal-list {
        max-height: 220px;
        overflow-y: auto;
        border: 1px solid var(--color-border);
        border-radius: 10px;
        background: var(--color-bg);
      }
      .anim-reveal-row {
        display: grid;
        grid-template-columns: 36px 80px 1fr 80px 60px;
        gap: 12px;
        align-items: center;
        padding: 8px 12px;
        font-size: 13px;
        border-bottom: 1px solid var(--color-border);
      }
      .anim-reveal-row:last-child { border-bottom: none; }
      .anim-reveal-row.anim-reveal-fresh {
        animation: rowFlash 1200ms ease-out;
      }
      @keyframes rowFlash {
        0%   { background: rgba(139, 92, 246, 0.18); }
        100% { background: transparent; }
      }
      .anim-reveal-rank { color: var(--color-muted); font-variant-numeric: tabular-nums; }
      .anim-reveal-id { font-weight: 700; }
      .anim-reveal-label {
        color: var(--color-text);
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .anim-reveal-size { color: var(--color-muted); font-variant-numeric: tabular-nums; text-align: right; }
      .anim-reveal-resolved {
        font-variant-numeric: tabular-nums;
        text-align: right;
        font-weight: 600;
      }
      .anim-reveal-empty {
        padding: 16px;
        text-align: center;
        color: var(--color-muted);
        font-size: 13px;
      }
    `
    document.head.appendChild(style)
  }

  const playBtn = container.querySelector('#animPlay')
  const resetBtn = container.querySelector('#animReset')
  const speedInput = container.querySelector('#animSpeed')
  const speedValEl = container.querySelector('#animSpeedVal')
  const progressBar = container.querySelector('#animProgressBar')
  const progressText = container.querySelector('#animProgress')
  const revealListEl = container.querySelector('#animRevealList')
  const modeBtns = container.querySelectorAll('.anim-mode-btn')

  const totalQuestions = points.length

  function formatPct(x) {
    return Math.round((x || 0) * 100) + '%'
  }

  function updateProgress() {
    const n = animState.sortedLabels.length
    const idx = animState.currentIndex
    const revealedQuestions = animState.sortedLabels
      .slice(0, idx)
      .reduce((sum, l) => sum + (clusterSizes[l] || 0), 0)
    const pct = n ? Math.round((idx / n) * 100) : 0
    progressBar.style.width = pct + '%'
    progressText.textContent = `${idx} / ${n} clusters · ${revealedQuestions.toLocaleString()} / ${totalQuestions.toLocaleString()} questions revealed`
  }

  function appendRevealRow(idx, cid) {
    if (!revealListEl) return
    if (idx === 0 && revealListEl.querySelector('.anim-reveal-empty')) {
      revealListEl.innerHTML = ''
    }
    const size = clusterSizes[cid] || 0
    const resolved = clusterResolved[cid] || 0
    const terms = (clusterTerms[cid] || []).slice(0, 4).join(', ')
    const color = colorMap[cid] || '#60a5fa'
    const row = document.createElement('div')
    row.className = 'anim-reveal-row anim-reveal-fresh'
    row.style.borderLeft = `3px solid ${color}`
    row.innerHTML = `
      <div class="anim-reveal-rank">#${idx + 1}</div>
      <div class="anim-reveal-id" style="color:${color}">Cluster ${cid}</div>
      <div class="anim-reveal-label" title="${escHtml(terms)}">${escHtml(terms || '—')}</div>
      <div class="anim-reveal-size">${size.toLocaleString()} Q</div>
      <div class="anim-reveal-resolved" style="color:${resolved >= 0.7 ? '#34D399' : resolved >= 0.5 ? '#f59e0b' : '#ef4444'}">${formatPct(resolved)}</div>
    `
    revealListEl.appendChild(row)
    // Auto-scroll the list to keep the latest row visible
    revealListEl.scrollTop = revealListEl.scrollHeight
  }

  function clearRevealList() {
    if (!revealListEl) return
    revealListEl.innerHTML = `<div class="anim-reveal-empty">Press <strong>Play</strong> to reveal clusters. They'll appear here in the chosen order.</div>`
  }
  clearRevealList()

  function revealClusterAt(idx) {
    const cid = animState.sortedLabels[idx]
    if (cid === undefined) return
    svg.querySelectorAll(`.cluster-group[data-cluster="${cid}"]`).forEach(g => {
      g.classList.add('revealed', 'reveal-flash')
      setTimeout(() => g.classList.remove('reveal-flash'), 950)
    })
    appendRevealRow(idx, cid)
  }

  function hideAllClusterGroups() {
    svg.querySelectorAll('.cluster-group.revealed').forEach(g => g.classList.remove('revealed'))
  }

  function updatePlayLabel() {
    if (!playBtn) return
    if (animState.isPlaying) {
      playBtn.textContent = '⏸ Pause'
      playBtn.setAttribute('aria-label', 'Pause')
    } else if (animState.currentIndex >= animState.sortedLabels.length && animState.sortedLabels.length > 0) {
      playBtn.textContent = '↻ Replay'
      playBtn.setAttribute('aria-label', 'Replay')
    } else {
      playBtn.textContent = '▶ Play'
      playBtn.setAttribute('aria-label', 'Play')
    }
  }

  function tick() {
    if (animState.currentIndex >= animState.sortedLabels.length) {
      pauseAnimation()
      return
    }
    revealClusterAt(animState.currentIndex)
    animState.currentIndex++
    updateProgress()
  }

  function playAnimation() {
    if (animState.currentIndex >= animState.sortedLabels.length) {
      // Replay: reset first
      resetAnimation()
    }
    if (animState.sortedLabels.length === 0) return
    animState.isPlaying = true
    updatePlayLabel()
    const intervalMs = 1000 / animState.speed
    // Run one tick immediately so the user sees movement
    tick()
    if (animState.currentIndex < animState.sortedLabels.length) {
      animState.timer = setInterval(tick, intervalMs)
    } else {
      animState.isPlaying = false
      updatePlayLabel()
    }
  }

  function pauseAnimation() {
    if (animState.timer) {
      clearInterval(animState.timer)
      animState.timer = null
    }
    animState.isPlaying = false
    updatePlayLabel()
  }

  function resetAnimation() {
    pauseAnimation()
    animState.currentIndex = 0
    hideAllClusterGroups()
    clearRevealList()
    updateProgress()
  }

  function setMode(mode) {
    if (mode === animState.mode) return
    animState.mode = mode
    animState.sortedLabels = computeSortedLabels()
    modeBtns.forEach(b => {
      const active = b.dataset.mode === mode
      b.classList.toggle('anim-mode-active', active)
      b.setAttribute('aria-selected', active ? 'true' : 'false')
    })
    resetAnimation()
  }

  function setSpeed(s) {
    animState.speed = s
    if (speedValEl) speedValEl.textContent = `${s}/s`
    if (animState.isPlaying) {
      // Restart timer with new interval
      if (animState.timer) clearInterval(animState.timer)
      const intervalMs = 1000 / s
      animState.timer = setInterval(tick, intervalMs)
    }
  }

  playBtn.addEventListener('click', () => {
    if (animState.isPlaying) pauseAnimation()
    else playAnimation()
  })
  resetBtn.addEventListener('click', resetAnimation)
  speedInput.addEventListener('input', e => setSpeed(parseInt(e.target.value, 10)))
  modeBtns.forEach(b => {
    b.addEventListener('click', () => setMode(b.dataset.mode))
  })

  // Show all clusters by default, but auto-play the reveal once on page load
  // so the animation feature is immediately visible. Users can hit Reset to
  // replay.
  function revealAllInstant() {
    svg.querySelectorAll('.cluster-group').forEach(g => g.classList.add('revealed'))
    animState.currentIndex = animState.sortedLabels.length
    updateProgress()
  }
  revealAllInstant()
  // Start the animation so the page demonstrates its headline feature.
  setTimeout(() => { resetAnimation(); playAnimation() }, 400)

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
