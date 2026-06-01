/**
 * CallerNetwork.js — "Caller Expertise Network"
 * Shows repeat expert callers as an interactive network graph.
 * Nodes = callers (size = episodes), edges = shared episodes.
 */
import { loadJSON } from '../lib/data.js'

function escHtml(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function pct(n, d) {
  return d ? `${Math.round(n / d * 100)}%` : '—'
}

export async function renderCallerNetworkPage(container, store) {
  container.innerHTML = `<div class="loading"><div class="spinner"></div>Loading caller network...</div>`
  try {
    const data = await loadJSON('caller_network.json')
    renderPage(container, data)
  } catch (e) {
    container.innerHTML = `<div class="loading"><div class="spinner"></div><p style="color:#e74c3c">Could not load network data.</p></div>`
    console.error(e)
  }
}

function renderPage(container, data) {
  const nodes = data.nodes || []
  const edges = data.edges || []

  // Assign force-directed positions in-browser (simple spring layout)
  const positions = {}
  const W = 800, H = 600
  const K = 80 // repulsion constant

  // Init random positions
  nodes.forEach((n, i) => {
    positions[i] = { x: Math.random() * W, y: Math.random() * H, vx: 0, vy: 0 }
  })

  // Run simple force simulation
  for (let iter = 0; iter < 200; iter++) {
    // Repulsion between all nodes
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const dx = positions[j].x - positions[i].x
        const dy = positions[j].y - positions[i].y
        const dist = Math.sqrt(dx * dx + dy * dy) + 0.1
        const force = (K * K) / dist
        const fx = (dx / dist) * force
        const fy = (dy / dist) * force
        positions[i].vx -= fx / 50
        positions[i].vy -= fy / 50
        positions[j].vx += fx / 50
        positions[j].vy += fy / 50
      }
    }
    // Attraction along edges
    for (const e of edges) {
      const dx = positions[e.target].x - positions[e.source].x
      const dy = positions[e.target].y - positions[e.source].y
      const dist = Math.sqrt(dx * dx + dy * dy) + 0.1
      const force = dist / 50
      positions[e.source].vx += (dx / dist) * force
      positions[e.source].vy += (dy / dist) * force
      positions[e.target].vx -= (dx / dist) * force
      positions[e.target].vy -= (dy / dist) * force
    }
    // Center gravity
    for (const i in positions) {
      positions[i].vx += (W / 2 - positions[i].x) / 200
      positions[i].vy += (H / 2 - positions[i].y) / 200
    }
    // Apply velocity with damping
    for (const i in positions) {
      positions[i].x += positions[i].vx
      positions[i].y += positions[i].vy
      positions[i].vx *= 0.8
      positions[i].vy *= 0.8
    }
  }

  // Normalise to viewBox
  const xs = nodes.map((_, i) => positions[i].x)
  const ys = nodes.map((_, i) => positions[i].y)
  const minX = Math.min(...xs), maxX = Math.max(...xs)
  const minY = Math.min(...ys), maxY = Math.max(...ys)
  const pad = 40
  const scaleX = (W - 2 * pad) / (maxX - minX || 1)
  const scaleY = (H - 2 * pad) / (maxY - minY || 1)

  const nodeMap = {}
  nodes.forEach((n, i) => { nodeMap[n.id] = i })

  const nodeDegree = {}
  edges.forEach(e => {
    nodeDegree[e.source] = (nodeDegree[e.source] || 0) + 1
    nodeDegree[e.target] = (nodeDegree[e.target] || 0) + 1
  })

  const selectedNode = { id: null }

  container.innerHTML = `
    <div class="page-header">
      <h1>🔗 Caller Expertise Network</h1>
      <p>Repeat callers connected by shared episodes. The more callers share an episode, the stronger the link.</p>
    </div>

    <div class="stats-grid" style="--cols: 3;margin-bottom:24px">
      <div class="stat-card">
        <div class="stat-value">${nodes.length}</div>
        <div class="stat-label">Expert Callers (2+ eps)</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">${edges.length}</div>
        <div class="stat-label">Connections</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">${Math.max(...nodes.map((n, i) => nodeDegree[i] || 0))}</div>
        <div class="stat-label">Most Connected Caller</div>
      </div>
    </div>

    <div class="card" style="margin-bottom:24px">
      <h2>Network Graph</h2>
      <div style="overflow:auto">
        <svg id="networkSvg" viewBox="0 0 ${W} ${H}" style="max-width:100%;background:#0d1b2a;border-radius:8px;display:block;margin:0 auto">
          <defs>
            <filter id="glow"><feGaussianBlur stdDeviation="2" result="blur"/><feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
          </defs>
          ${edges.map(e => {
            const s = positions[e.source], t = positions[e.target]
            const x1 = pad + (s.x - minX) * scaleX, y1 = pad + (s.y - minY) * scaleY
            const x2 = pad + (t.x - minX) * scaleX, y2 = pad + (t.y - minY) * scaleY
            return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="rgba(59,130,246,0.3)" stroke-width="${Math.sqrt(e.weight)}"/>`
          }).join('')}
          ${nodes.map((n, i) => {
            const x = pad + (positions[i].x - minX) * scaleX
            const y = pad + (positions[i].y - minY) * scaleY
            const r = 6 + (n.n_eps || 1) * 2
            const deg = nodeDegree[i] || 0
            const color = deg >= 5 ? '#f87171' : deg >= 3 ? '#fbbf24' : '#60a5fa'
            return `<g class="network-node" data-id="${escHtml(n.id)}" style="cursor:pointer">
              <circle cx="${x}" cy="${y}" r="${r}" fill="${color}" opacity="0.85" filter="url(#glow)"/>
              <text x="${x}" y="${y + r + 12}" text-anchor="middle" fill="#94a3b8" font-size="10" font-family="inherit">${escHtml(n.name.split(' from ')[0])}</text>
            </g>`
          }).join('')}
        </svg>
      </div>
      <div style="display:flex;gap:16px;margin-top:12px;flex-wrap:wrap">
        <div style="display:flex;align-items:center;gap:6px"><div style="width:12px;height:12px;border-radius:50%;background:#f87171"></div> 5+ connections</div>
        <div style="display:flex;align-items:center;gap:6px"><div style="width:12px;height:12px;border-radius:50%;background:#fbbf24"></div> 3-4 connections</div>
        <div style="display:flex;align-items:center;gap:6px"><div style="width:12px;height:12px;border-radius:50%;background:#60a5fa"></div> 1-2 connections</div>
        <div style="display:flex;align-items:center;gap:6px"><div style="width:12px;height:12px;border-radius:50%;background:#34d399"></div> Node size = episodes</div>
      </div>
    </div>

    <!-- Detail panel -->
    <div id="nodeDetail" class="card" style="display:none"></div>

    <!-- Expert table -->
    <div class="card">
      <h2>All Expert Callers</h2>
      <input type="text" id="netSearch" placeholder="Search callers..." style="margin-bottom:12px;padding:8px;border-radius:6px;border:1px solid var(--color-border);width:100%;max-width:300px;background:var(--color-bg);color:var(--color-text)">
      <div id="netTable" style="max-height:400px;overflow-y:auto"></div>
    </div>
  `

  const svg = container.querySelector('#networkSvg')
  const detailEl = container.querySelector('#nodeDetail')

  svg.querySelectorAll('.network-node').forEach(g => {
    g.addEventListener('click', () => {
      const id = g.dataset.id
      selectedNode.id = id
      showNodeDetail(id, nodes, edges, nodeMap, detailEl)
    })
  })

  const table = container.querySelector('#netTable')
  function renderTable(filter = '') {
    const q = filter.toLowerCase()
    const rows = nodes.filter(n => !q || n.name.toLowerCase().includes(q) || n.id.toLowerCase().includes(q))
    table.innerHTML = `
      <table style="width:100%;border-collapse:collapse;font-size:13px">
        <thead style="position:sticky;top:0;background:var(--color-surface)">
          <tr style="text-align:left;color:var(--color-muted)">
            <th style="padding:8px">Caller</th>
            <th style="padding:8px;text-align:right">Episodes</th>
            <th style="padding:8px;text-align:right">Connections</th>
            <th style="padding:8px">Expertise</th>
          </tr>
        </thead>
        <tbody>
          ${rows.sort((a, b) => (nodeDegree[nodeMap[a.id]] || 0) - (nodeDegree[nodeMap[b.id]] || 0)).reverse().map(n => {
            const deg = nodeDegree[nodeMap[n.id]] || 0
            const color = deg >= 5 ? 'var(--color-red)' : deg >= 3 ? 'var(--color-yellow)' : 'var(--color-primary)'
            return `
            <tr style="border-top:1px solid var(--color-border);cursor:pointer" class="net-row" data-id="${escHtml(n.id)}">
              <td style="padding:8px;font-weight:600">${escHtml(n.name)}</td>
              <td style="padding:8px;text-align:right">${n.n_eps}</td>
              <td style="padding:8px;text-align:right;color:${color};font-weight:700">${deg}</td>
              <td style="padding:8px;color:var(--color-muted)">${(n.expertise || []).slice(0, 3).map(t => `<span class="topic-tag">${escHtml(t)}</span>`).join('')}</td>
            </tr>`
          }).join('')}
        </tbody>
      </table>`
    table.querySelectorAll('.net-row').forEach(row => {
      row.addEventListener('click', () => {
        selectedNode.id = row.dataset.id
        showNodeDetail(row.dataset.id, nodes, edges, nodeMap, detailEl)
        row.scrollIntoView()
      })
    })
  }
  renderTable()
  container.querySelector('#netSearch').addEventListener('input', e => renderTable(e.target.value))
}

function showNodeDetail(id, nodes, edges, nodeMap, detailEl) {
  const n = nodes.find(x => x.id === id)
  if (!n) return
  const ei = nodeMap[id]
  const connected = edges.filter(e => e.source === ei || e.target === ei)
    .map(e => { const other = e.source === ei ? e.target : e.source; return nodes[other] })
  detailEl.style.display = 'block'
  detailEl.innerHTML = `
    <h2>${id}</h2>
    <div style="display:flex;gap:24px;margin-bottom:12px;flex-wrap:wrap">
      <div><strong>Episodes:</strong> ${(n.episodes || []).join(', ')}</div>
    </div>
    ${n.expertise && n.expertise.length ? `<div style="margin-bottom:12px">${n.expertise.map(t => `<span class="topic-tag">${t}</span>`).join('')}</div>` : ''}
    <div><strong>${connected.length}</strong> callers also appeared in shared episodes:</div>
    <div style="display:flex;flex-wrap:wrap;gap:8px;margin-top:8px">
      ${connected.map(c => `<span class="topic-tag" style="background:var(--color-primary)">${escHtml(c.name)} (${c.n_eps} eps)</span>`).join('')}
    </div>
  `
  detailEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
}
