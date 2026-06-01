/**
 * UKMap.js — "UK Heatmap"
 * Interactive SVG map of UK showing caller density and resolution rates by town.
 */
import { loadJSON } from '../lib/data.js'
import { loadAll } from '../lib/data.js'

function escHtml(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function pct(n, d) {
  return d ? `${(n/d*100).toFixed(1)}%` : '—'
}

export async function renderUKMapPage(container, store) {
  container.innerHTML = `<div class="loading"><div class="spinner"></div>Loading map data...</div>`
  try {
    const [svgData, allQa] = await Promise.all([
      fetch('/data/uk_heatmap.svg').then(r => r.text()),
      loadJSON('all_qa.json'),
    ])
    renderPage(container, svgData, allQa)
  } catch (e) {
    container.innerHTML = `<div class="loading"><div class="spinner"></div><p style="color:#e74c3c">Could not load map data.</p></div>`
    console.error(e)
  }
}

function renderPage(container, svgData, allQa) {
  // Build full town lookup from all_qa
  const townData = {}
  for (const ep of allQa.episodes) {
    for (const q of (ep['questions'] || [])) {
      const caller = q.caller || ''
      if (!caller.includes(' from ')) continue
      const loc = caller.split(' from ').pop().trim()
      const town = (loc.split(',').pop().trim())
      if (!town || town.length < 2) continue
      if (!townData[town]) {
        townData[town] = { count: 0, resolved: 0, questions: [], episodes: new Set(), topics: new Set() }
      }
      townData[town].count++
      if (q.resolved) townData[town].resolved++
      townData[town].questions.push({ q: q.question, ep: ep.episode })
      townData[town].episodes.add(ep.episode)
      for (const t of (q.topics || [])) townData[town].topics.add(t)
    }
  }
  for (const t in townData) {
    townData[t].episodes = Array.from(townData[t].episodes)
    townData[t].topics = Array.from(townData[t].topics)
  }

  container.innerHTML = `
    <div class="page-header">
      <h1>UK Caller Heatmap</h1>
      <p>Where in the UK do Mystery Hour callers come from? Circle size = call volume, colour = resolution rate.</p>
    </div>

    <div class="map-layout">
      <div class="map-container">
        <div class="map-svg-wrap" id="mapWrap">
          ${svgData}
          <div class="map-legend" id="mapLegend">
            <div class="legend-section">
              <div class="legend-title">Call count</div>
              <div class="legend-row">
                <span class="legend-circle" style="width:10px;height:10px"></span>
                <span>4+</span>
              </div>
              <div class="legend-row">
                <span class="legend-circle" style="width:18px;height:18px"></span>
                <span>10+</span>
              </div>
              <div class="legend-row">
                <span class="legend-circle" style="width:24px;height:24px"></span>
                <span>18</span>
              </div>
            </div>
            <div class="legend-section">
              <div class="legend-title">Resolution rate</div>
              <div class="legend-row">
                <span class="legend-swatch" style="background:#4ade80"></span>
                <span>80%+</span>
              </div>
              <div class="legend-row">
                <span class="legend-swatch" style="background:#fbbf24"></span>
                <span>60–79%</span>
              </div>
              <div class="legend-row">
                <span class="legend-swatch" style="background:#f87171"></span>
                <span>&lt;60%</span>
              </div>
            </div>
          </div>
        </div>
      </div>
      <div class="map-sidebar" id="mapSidebar">
        <div class="card" style="margin-bottom:16px">
          <h3 style="margin:0 0 8px">Town Lookup</h3>
          <input type="text" id="mapTownSearch" placeholder="Type a town name..." autofocus
            style="width:100%;padding:10px;border-radius:8px;border:1px solid var(--color-border);background:var(--color-bg);color:var(--color-text);box-sizing:border-box">
        </div>
        <div id="mapTownResult"></div>
      </div>
    </div>

    <style>
    .map-layout { display: grid; grid-template-columns: 1fr 320px; gap: 20px; align-items: start; }
    @media (max-width: 900px) { .map-layout { grid-template-columns: 1fr; } }
    .map-svg-wrap { position: relative; background: #0d1b2a; border-radius: 12px; overflow: hidden; }
    .map-svg-wrap svg { display: block; width: 100%; height: auto; }
    .heat-circle { transition: fill-opacity 0.15s, r 0.15s; }
    .heat-circle:hover { fill-opacity: 1 !important; r: attr(r * 1.3); }
    .map-sidebar { position: sticky; top: 80px; }
    .map-town-card { padding: 14px; background: var(--color-surface); border: 1px solid var(--color-border); border-radius: 10px; }
    .map-stat-row { display: flex; gap: 16px; margin-bottom: 10px; }
    .map-stat { display: flex; flex-direction: column; }
    .map-stat-val { font-size: 20px; font-weight: 700; }
    .map-stat-lbl { font-size: 11px; color: var(--color-muted); text-transform: uppercase; }
    .map-legend {
      position: absolute;
      top: 12px;
      left: 12px;
      background: rgba(13, 27, 42, 0.96);
      border: 1px solid rgba(255,255,255,0.12);
      border-radius: 8px;
      padding: 10px 12px;
      display: flex;
      flex-direction: column;
      gap: 10px;
      font-size: 11px;
      color: #cbd5e1;
      z-index: 5;
      box-shadow: 0 4px 12px rgba(0,0,0,0.4);
    }
    .legend-section { display: flex; flex-direction: column; gap: 4px; }
    .legend-title { font-weight: 600; text-transform: uppercase; font-size: 10px; color: #94a3b8; letter-spacing: 0.5px; margin-bottom: 2px; }
    .legend-row { display: flex; align-items: center; gap: 10px; min-height: 18px; }
    .legend-circle {
      display: inline-block;
      background: #60a5fa;
      opacity: 0.7;
      border-radius: 50%;
      flex-shrink: 0;
    }
    .legend-swatch { display: inline-block; width: 12px; height: 12px; border-radius: 2px; flex-shrink: 0; }
    </style>
  `

  const mapWrap = container.querySelector('#mapWrap')
  const sidebar = container.querySelector('#mapSidebar')
  const searchEl = container.querySelector('#mapTownSearch')
  const resultEl = container.querySelector('#mapTownResult')

  // Add hover interactivity to circles
  mapWrap.querySelectorAll('.heat-circle').forEach(circle => {
    circle.addEventListener('mouseenter', () => {
      const town = circle.dataset.town
      const count = circle.dataset.count
      const rate = circle.dataset.rate
      const d = townData[town]
      if (d) {
        showTownCard(town, d)
      }
    })
    circle.addEventListener('click', () => {
      const town = circle.dataset.town
      const d = townData[town]
      if (d) {
        searchEl.value = town
        showTownCard(town, d)
      }
    })
  })

  function showTownCard(town, d) {
    const rate = d.count ? pct(d.resolved, d.count) : '—'
    resultEl.innerHTML = `
      <div class="map-town-card">
        <div style="display:flex;align-items:center;gap:10px;margin-bottom:10px">
          <h3 style="margin:0;font-size:18px">📍 ${escHtml(town)}</h3>
        </div>
        <div class="map-stat-row">
          <div class="map-stat">
            <span class="map-stat-val">${d.count}</span>
            <span class="map-stat-lbl">Callers</span>
          </div>
          <div class="map-stat">
            <span class="map-stat-val" style="color:${parseFloat(rate) >= 80 ? 'var(--color-green)' : parseFloat(rate) >= 60 ? 'var(--color-yellow)' : 'var(--color-red)'}">${rate}</span>
            <span class="map-stat-lbl">Resolved</span>
          </div>
          <div class="map-stat">
            <span class="map-stat-val">${d.episodes.length}</span>
            <span class="map-stat-lbl">Episodes</span>
          </div>
        </div>
        ${d.topics.length ? `
          <div style="margin-bottom:10px">${d.topics.slice(0, 8).map(t => `<span class="topic-tag">${escHtml(t)}</span>`).join('')}</div>
        ` : ''}
        <div style="font-size:12px;color:var(--color-muted)">Click a circle on the map or search above</div>
      </div>
    `
  }

  // Town search
  const townNames = Object.keys(townData).sort((a, b) => townData[b].count - townData[a].count)

  let debounceTimer = null
  searchEl.addEventListener('input', () => {
    clearTimeout(debounceTimer)
    const q = searchEl.value.trim()
    if (!q) { resultEl.innerHTML = ''; return }
    debounceTimer = setTimeout(() => {
      const qLower = q.toLowerCase()
      const matches = townNames.filter(t => t.toLowerCase().includes(qLower))
      if (!matches.length) {
        resultEl.innerHTML = `<div class="map-town-card" style="text-align:center;color:var(--color-muted);padding:24px">No callers from <strong>${escHtml(q)}</strong></div>`
        return
      }
      // Highlight matching circles on map
      mapWrap.querySelectorAll('.heat-circle').forEach(c => {
        const match = matches.includes(c.dataset.town)
        c.setAttribute('fill-opacity', match ? '1' : '0.15')
      })
      // Show top match
      const exact = matches.find(t => t.toLowerCase() === qLower)
      const show = exact || matches[0]
      showTownCard(show, townData[show])
      resultEl.innerHTML += `
        <div style="margin-top:8px;font-size:12px;color:var(--color-muted)">
          ${matches.length > 1 ? `${matches.length} matches: ${matches.slice(0, 5).map(t => `<button class="topic-tag" style="cursor:pointer;margin:2px" data-t="${escHtml(t)}">${escHtml(t)}</button>`).join('')}` : ''}
        </div>
      `
      resultEl.querySelectorAll('[data-t]').forEach(btn => {
        btn.addEventListener('click', () => {
          searchEl.value = btn.dataset.t
          showTownCard(btn.dataset.t, townData[btn.dataset.t])
        })
      })
    }, 150)
  })
}
