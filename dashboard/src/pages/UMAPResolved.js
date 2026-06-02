/**
 * UMAPResolved.js — "UMAP Resolved vs Unresolved"
 * UMAP scatter coloured by resolved/unresolved status.
 * Also shows separate centroids for each class.
 */
import { loadJSON } from '../lib/data.js'

function escHtml(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

export async function renderUMAPResolvedPage(container) {
  container.innerHTML = `<div class="loading"><div class="spinner"></div>Loading UMAP data...</div>`
  try {
    const data = await loadJSON('umap_resolved.json')
    renderPage(container, data)
  } catch (e) {
    container.innerHTML = `<div class="loading"><div class="spinner"></div><p style="color:#e74c3c">${e.message}</p></div>`
    console.error(e)
  }
}

function renderPage(container, data) {
  const pts = data.points || []
  const [rcx, rcy] = data.resolved_centroid || []
  const [ucx, ucy] = data.unresolved_centroid || []

  // Bounds
  const xs = pts.map(p => p.x)
  const ys = pts.map(p => p.y)
  const minX = Math.min(...xs), maxX = Math.max(...xs)
  const minY = Math.min(...ys), maxY = Math.max(...ys)
  const VW = 900, VH = 600, PAD = 40

  function sx(x) { return PAD + (x - minX) / (maxX - minX || 1) * (VW - 2 * PAD) }
  function sy(y) { return PAD + (y - minY) / (maxY - minY || 1) * (VH - 2 * PAD) }

  // Colour each point by resolved status
  const showResolved = { current: true }
  const showUnresolved = { current: true }

  container.innerHTML = `
    <div class="page-header">
      <h1>🌀 Resolved vs Unresolved in UMAP Space</h1>
      <p>6,134 questions in 2D UMAP projection — coloured by resolved status. Do resolved questions cluster separately?</p>
    </div>

    <div class="card" style="margin-bottom:24px;background:linear-gradient(135deg,#1a1a2e,#16213e);border:1px solid #0f3460">
      <p style="color:#94a3b8;margin:0;font-size:14px">
        <span style="color:#4ade80">●</span> Resolved centroid (${rcx?.toFixed(1)}, ${rcy?.toFixed(1)}) ·
        <span style="color:#f87171">●</span> Unresolved centroid (${ucx?.toFixed(1)}, ${ucy?.toFixed(1)})
      </p>
      <div style="margin-top:10px;display:flex;gap:16px">
        <label style="display:flex;align-items:center;gap:6px;cursor:pointer;font-size:14px;color:#94a3b8">
          <input type="checkbox" id="showResolved" checked style="width:16px;height:16px">Show resolved (${pts.filter(p=>p.resolved).length})
        </label>
        <label style="display:flex;align-items:center;gap:6px;cursor:pointer;font-size:14px;color:#94a3b8">
          <input type="checkbox" id="showUnresolved" checked style="width:16px;height:16px">Show unresolved (${pts.filter(p=>!p.resolved).length})
        </label>
      </div>
    </div>

    <div class="card" style="margin-bottom:24px">
      <div style="overflow:auto;border-radius:8px;background:#0d1b2a">
        <svg viewBox="0 0 ${VW} ${VH}" style="width:100%;display:block;max-width:${VW}px">
          <defs>
            <filter id="umap-g2"><feGaussianBlur stdDeviation="1" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
          </defs>
          <!-- Grid -->
          ${[0.25, 0.5, 0.75].map(t => `
            <line x1="${PAD}" y1="${PAD + t*(VH-2*PAD)}" x2="${VW-PAD}" y2="${PAD + t*(VH-2*PAD)}" stroke="rgba(255,255,255,0.04)" stroke-dasharray="4,4"/>
            <line x1="${PAD + t*(VW-2*PAD)}" y1="${PAD}" x2="${PAD + t*(VW-2*PAD)}" y2="${VH-PAD}" stroke="rgba(255,255,255,0.04)" stroke-dasharray="4,4"/>
          `).join('')}
          <!-- Points -->
          <g id="umapPts">
            ${pts.filter((_, i) => i % 2 === 0).map(p => `
              <circle cx="${sx(p.x).toFixed(1)}" cy="${sy(p.y).toFixed(1)}" r="2.5"
                fill="${p.resolved ? '#4ade80' : '#f87171'}"
                fill-opacity="0.5"
                class="umap-pt"
                data-ep="${p.episode}"
                data-q="${(p.question||'').slice(0,60)}"
                data-resolved="${p.resolved}"
                data-answers="${p.n_answers}"
              />
            `).join('')}
          </g>
          <!-- Centroids -->
          <circle cx="${sx(rcx).toFixed(1)}" cy="${sy(rcy).toFixed(1)}" r="12" fill="#4ade80" fill-opacity="0.8" filter="url(#umap-g2)"/>
          <circle cx="${sx(ucx).toFixed(1)}" cy="${sy(ucy).toFixed(1)}" r="12" fill="#f87171" fill-opacity="0.8" filter="url(#umap-g2)"/>
          <text x="${sx(rcx).toFixed(1)}" y="${(sy(rcy)-16).toFixed(1)}" text-anchor="middle" fill="#4ade80" font-size="11" font-weight="700">Resolved</text>
          <text x="${sx(ucx).toFixed(1)}" y="${(sy(ucy)+20).toFixed(1)}" text-anchor="middle" fill="#f87171" font-size="11" font-weight="700">Unresolved</text>
        </svg>
      </div>
    </div>

    <!-- Hover tooltip -->
    <div id="umapTip" style="display:none;position:fixed;background:#1e293b;border:1px solid #334155;border-radius:8px;padding:10px 14px;font-size:13px;color:#e2e8f0;max-width:320px;pointer-events:none;z-index:200;box-shadow:0 8px 24px rgba(0,0,0,0.4)"></div>
  `

  const svg = container.querySelector('svg')
  const tip = container.querySelector('#umapTip')
  const showResEl = container.querySelector('#showResolved')
  const showUnresEl = container.querySelector('#showUnresolved')

  function updateVisibility() {
    svg.querySelectorAll('.umap-pt').forEach(c => {
      const resolved = c.dataset.resolved === 'true'
      const show = (resolved && showResolved.current) || (!resolved && showUnresolved.current)
      c.setAttribute('fill-opacity', show ? '0.6' : '0')
    })
  }

  showResEl.addEventListener('change', e => { showResolved.current = e.target.checked; updateVisibility() })
  showUnresEl.addEventListener('change', e => { showUnresolved.current = e.target.checked; updateVisibility() })

  svg.addEventListener('mousemove', e => {
    const pt = e.target.closest('.umap-pt')
    if (!pt) { tip.style.display = 'none'; return }
    tip.style.display = 'block'
    tip.style.left = (e.clientX + 16) + 'px'
    tip.style.top = (e.clientY + 16) + 'px'
    tip.innerHTML = `
      <div style="font-weight:700;margin-bottom:4px">${escHtml(pt.dataset.q)}…</div>
      <div style="font-size:11px;color:#94a3b8">
        <a href="/episodes?ep=${pt.dataset.ep}" class="nav-link" data-link style="color:#60a5fa">${pt.dataset.ep}</a>
        · ${pt.dataset.resolved === 'true' ? '<span style="color:#4ade80">✓ Resolved</span>' : '<span style="color:#f87171">✗ Unresolved</span>'}
        · ${pt.dataset.answers} answers
      </div>
    `
    tip.querySelectorAll('a[data-link]').forEach(a => {
      a.addEventListener('click', ev => { ev.preventDefault(); history.pushState(null,'',a.href); window.dispatchEvent(new PopStateEvent('popstate')) })
    })
  })
  svg.addEventListener('mouseleave', () => { tip.style.display = 'none' })
}
