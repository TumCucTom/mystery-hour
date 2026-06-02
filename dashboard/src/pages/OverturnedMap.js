/**
 * OverturnedMap.js — "The Overturned Map"
 * UK heatmap showing which towns produced the most overturned answers.
 * Same SVG as the UK heatmap but coloured by overturned rate instead of resolution rate.
 */
import { loadJSON } from '../lib/data.js'

function escHtml(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function pct(n, d) {
  return d ? `${(n/d*100).toFixed(1)}%` : '—'
}

export async function renderOverturnedMapPage(container, store) {
  container.innerHTML = `<div class="loading"><div class="spinner"></div>Loading map data...</div>`
  try {
    const [svgData, townData] = await Promise.all([
      fetch('/data/uk_heatmap.svg').then(r => r.text()),
      loadJSON('town_overturned.json'),
    ])
    renderPage(container, svgData, townData)
  } catch (e) {
    container.innerHTML = `<div class="loading"><div class="spinner"></div><p style="color:#e74c3c">Could not load data.</p></div>`
    console.error(e)
  }
}

function renderPage(container, svgData, townData) {
  const towns = Object.entries(townData).sort((a, b) => b[1].overturned_rate - a[1].overturned_rate)
  const maxOver = Math.max(...towns.map(([, v]) => v.overturned_rate), 0.001)

  container.innerHTML = `
    <div class="page-header">
      <h1>⚠️ The Overturned Map</h1>
      <p>UK heatmap of towns whose callers caught James getting it wrong. Colour = how often James was overturned in calls from that town.</p>
    </div>

    <div class="stats-grid" style="--cols:3;margin-bottom:24px">
      <div class="stat-card">
        <div class="stat-value" style="color:var(--color-red)">${pct(towns.reduce((s,[,v])=>s+v.overturned,0), towns.reduce((s,[,v])=>s+v.total,0))}</div>
        <div class="stat-label">Overall Overturn Rate</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">${towns.filter(([,v])=>v.overturned>0).length}</div>
        <div class="stat-label">Towns with Overturned Answers</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">${towns[0]?.[1]?.overturned || 0}/${towns[0]?.[1]?.total || 0}</div>
        <div class="stat-label">Worst Town (Overturned/Total)</div>
      </div>
    </div>

    <div class="card" style="margin-bottom:24px;background:linear-gradient(135deg,#1a1a2e,#16213e);border:1px solid #0f3460">
      <p style="color:#94a3b8;margin:0;font-size:14px">
        <strong style="color:#f87171">Red = high overturn rate</strong> — callers from these towns are experts at catching James out.
        <strong style="color:#fbbf24">Yellow = moderate</strong>.
        Hover or click any circle for details.
      </p>
    </div>

    <div class="map-layout">
      <div class="map-container">
        <div class="map-svg-wrap" id="mapWrap">
          ${svgData.replace(/data-town="([^"]*)"/g, (match, town) => {
            const d = townData[town]
            if (!d) return match
            return `data-town="${town}" data-over="${d.overturned_rate.toFixed(3)}" data-count="${d.total}" data-overturned="${d.overturned}"`
          })}
        </div>
      </div>
      <div class="map-sidebar" id="mapSidebar">
        <div class="card" style="margin-bottom:12px">
          <h3 style="margin:0 0 8px">Worst Towns</h3>
          <p style="font-size:12px;color:var(--color-muted);margin:0">Most overturned answers per caller town</p>
        </div>
        <div id="worstList"></div>
      </div>
    </div>
  `

  const mapWrap = container.querySelector('#mapWrap')
  const worstList = container.querySelector('#worstList')

  // Render worst towns list
  worstList.innerHTML = towns.filter(([, v]) => v.overturned > 0).slice(0, 20).map(([town, d]) => `
    <div class="ov-town-card" style="padding:10px 12px;border-bottom:1px solid var(--color-border);cursor:pointer" data-town="${escHtml(town)}">
      <div style="display:flex;justify-content:space-between;align-items:center">
        <strong style="font-size:13px">${escHtml(town)}</strong>
        <span style="font-size:13px;font-weight:700;color:#f87171">${pct(d.overturned, d.total)}</span>
      </div>
      <div style="font-size:11px;color:var(--color-muted)">${d.overturned} overturned / ${d.total} questions</div>
    </div>
  `).join('')

  worstList.querySelectorAll('[data-town]').forEach(row => {
    row.addEventListener('click', () => {
      const town = row.dataset.town
      // Highlight on map
      mapWrap.querySelectorAll('.heat-circle').forEach(c => {
        const match = c.dataset.town === town
        c.setAttribute('fill-opacity', match ? '1' : '0.1')
      })
      // Show detail
      const d = townData[town]
      if (d) {
        const rate = pct(d.overturned, d.total)
        const resolvedRate = pct(d.resolved, d.total)
        // Remove any existing detail panel for this town before adding the new one
        const existing = row.parentNode.querySelector('.ov-detail[data-town="'+town+'"]')
        if (existing) existing.remove()
        const detail = document.createElement('div')
        detail.className = 'ov-detail'
        detail.dataset.town = town
        detail.style.cssText = 'padding:12px;background:rgba(248,113,113,0.1);border-bottom:1px solid var(--color-border)'
        detail.innerHTML = `
            <div style="font-size:12px;margin-bottom:6px;color:#f87171;font-weight:700">Overturned: ${rate} (${d.overturned}/${d.total})</div>
            <div style="font-size:12px;color:#4ade80;margin-bottom:6px">Resolved: ${resolvedRate}</div>
            <div style="font-size:11px;color:var(--color-muted)">Questions:</div>
            ${(d.qs || []).filter(q => q.over).map(q => `
              <div style="font-size:11px;padding:4px 0;border-bottom:1px solid rgba(255,255,255,0.05)">
                <a href="/episodes?ep=${q.ep}" class="nav-link" data-link style="font-size:11px">${q.ep}</a>
                ${escHtml(q.q)}…
              </div>
            `).join('')}
        `
        row.insertAdjacentElement('afterend', detail)
        detail.scrollIntoView()
      }
    })
  })

  // Map circle interactivity
  mapWrap.querySelectorAll('.heat-circle').forEach(circle => {
    const town = circle.dataset.town
    const d = townData[town]
    if (!d) return

    // Recolor circles by overturned rate instead of resolved rate
    const rate = d.overturned_rate || 0
    // Color: high overturned = red, medium = yellow, low = green (inverted from normal)
    let color
    if (rate >= 0.3) color = '#ef4444'
    else if (rate >= 0.15) color = '#f97316'
    else if (rate >= 0.05) color = '#eab308'
    else color = '#4ade80'

    // Keep opacity based on count
    const count = d.total
    const opacity = 0.5 + 0.3 * (count / 20)
    circle.setAttribute('fill', color)
    circle.setAttribute('fill-opacity', opacity.toFixed(2))
    circle.setAttribute('stroke', color)
  })

  // Hover shows town
  mapWrap.addEventListener('mousemove', e => {
    const target = e.target.closest('.heat-circle')
    if (target) {
      const town = target.dataset.town
      const d = townData[town]
      if (d) mapWrap.title = `${town}: ${pct(d.overturned, d.total)} overturned (${d.overturned}/${d.total})`
    }
  })
}
