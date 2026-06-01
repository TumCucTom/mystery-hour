/**
 * Geographic.js — "Your Town in Mystery Hour" + Geographic Patterns
 * Interactive UK town search + location stats and regional breakdown.
 */
import { loadJSON } from '../lib/data.js'

const BASE = '/data'

function escHtml(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function pct(n, d) {
  return d ? `${(n/d*100).toFixed(1)}%` : '—'
}

export async function renderGeographicPage(container, store) {
  container.innerHTML = `<div class="loading"><div class="spinner"></div>Loading geographic data...</div>`
  try {
    const [geo, allQa] = await Promise.all([
      loadJSON('geographic_data.json'),
      loadJSON('all_qa.json'),
    ])
    renderPage(container, geo, allQa)
  } catch (e) {
    container.innerHTML = `<div class="loading"><div class="spinner"></div><p style="color:#e74c3c">Could not load geographic data.</p></div>`
    console.error(e)
  }
}

function renderPage(container, geo, allQa) {
  const s = geo.summary
  const locations = geo.top_locations || []

  // Build a fast town lookup from all_qa
  const townData = {}
  for (const ep of allQa.episodes) {
    for (const q of (ep.questions || [])) {
      const caller = q.caller || ''
      if (!caller.includes(' from ')) continue
      const loc = caller.split(' from ').pop().trim()
      const town = (loc.split(',').pop().trim())
      if (!town || town.length < 2) continue
      if (!townData[town]) {
        townData[town] = { count: 0, resolved: 0, questions: [], episodes: [], topics: new Set() }
      }
      townData[town].count++
      if (q.resolved) townData[town].resolved++
      townData[town].questions.push({ q: q.question, ep: ep.episode })
      townData[town].episodes.push(ep.episode)
      for (const t of (q.topics || [])) townData[town].topics.add(t)
    }
  }
  for (const t in townData) townData[t].topics = Array.from(townData[t].topics)
  const townNames = Object.keys(townData).sort((a, b) => townData[b].count - townData[a].count)

  container.innerHTML = `
    <div class="page-header">
      <h1>📍 Your Town in Mystery Hour</h1>
      <p>Search any UK town or city to see its Mystery Hour callers, topics, and win rate.</p>
    </div>

    <!-- Town search -->
    <div class="card" style="margin-bottom:24px;background:linear-gradient(135deg,#1a1a2e,#16213e);border:1px solid #0f3460">
      <input type="text" id="townSearch" placeholder="Type a town or city: London, Manchester, Croydon..." autofocus
        style="width:100%;padding:14px;font-size:16px;border-radius:8px;border:1px solid #0f3460;background:#0d1b2a;color:#fff;box-sizing:border-box;outline:none">
      <div id="townHint" style="margin-top:10px;font-size:14px;color:#94a3b8">
        Start typing to search ${townNames.length} UK towns and cities…
      </div>
      <div id="townResult"></div>
    </div>

    <!-- Summary stats -->
    <div class="stats-grid" style="--cols:4">
      <div class="stat-card">
        <div class="stat-value">${s.total_geolocated.toLocaleString()}</div>
        <div class="stat-label">Geolocated Callers</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">${s.unique_locations}</div>
        <div class="stat-label">Unique Locations</div>
      </div>
      <div class="stat-card">
        <div class="stat-value" style="color:var(--color-primary)">${pct(s.urban_calls, s.urban_calls + s.rural_calls)}</div>
        <div class="stat-label">Urban Calls</div>
      </div>
      <div class="stat-card">
        <div class="stat-value" style="color:var(--color-green)">${pct(s.urban_resolved_rate, 1)}</div>
        <div class="stat-label">Urban Resolution Rate</div>
      </div>
    </div>

    <!-- Urban vs Rural -->
    <div class="card">
      <h2>🏙️ Urban vs Rural</h2>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:24px">
        <div>
          <div style="font-size:36px;font-weight:700;color:var(--color-primary)">${pct(s.urban_calls, s.urban_calls + s.rural_calls)}</div>
          <div style="font-size:14px;color:var(--color-muted);margin-top:4px">of calls are from major cities</div>
          <div style="margin-top:16px;font-size:14px">Urban resolved rate: <strong>${pct(s.urban_resolved_rate, 1)}</strong></div>
        </div>
        <div>
          <div style="font-size:36px;font-weight:700;color:var(--color-green)">${pct(s.rural_calls, s.urban_calls + s.rural_calls)}</div>
          <div style="font-size:14px;color:var(--color-muted);margin-top:4px">of calls are from towns/villages</div>
          <div style="margin-top:16px;font-size:14px">Rural resolved rate: <strong>${pct(s.rural_resolved_rate, 1)}</strong></div>
        </div>
      </div>
    </div>

    <!-- Top locations table -->
    <div class="card">
      <h2>🏆 Top Locations</h2>
      <input type="text" id="locSearch" placeholder="Filter locations…" style="margin-bottom:12px;padding:8px;border-radius:6px;border:1px solid var(--color-border);width:100%;max-width:300px;background:var(--color-bg);color:var(--color-text)">
      <div id="locTable" style="max-height:500px;overflow-y:auto"></div>
    </div>

    <!-- Region breakdown -->
    <div class="card">
      <h2>🗺️ Calls by Region</h2>
      <div style="display:flex;flex-wrap:wrap;gap:12px">
        ${Object.entries(geo.region_counts || {}).sort((a,b) => b[1]-a[1]).map(([region, count]) => `
          <div style="background:var(--color-surface);border-radius:8px;padding:12px 16px;border:1px solid var(--color-border);min-width:140px">
            <div style="font-weight:700;font-size:20px">${count.toLocaleString()}</div>
            <div style="font-size:13px;color:var(--color-muted)">${escHtml(region)}</div>
          </div>
        `).join('')}
      </div>
    </div>
  `

  // Town search logic
  const townSearchEl = container.querySelector('#townSearch')
  const townHintEl = container.querySelector('#townHint')
  const townResultEl = container.querySelector('#townResult')

  function renderTown(town) {
    const d = townData[town]
    if (!d) return
    const rate = pct(d.resolved, d.count)
    townResultEl.innerHTML = `
      <div style="margin-top:16px">
        <div style="display:flex;align-items:center;gap:12px;margin-bottom:12px">
          <h2 style="margin:0;font-size:22px">📍 ${escHtml(town)}</h2>
          <span style="background:var(--color-primary);color:#fff;padding:4px 12px;border-radius:20px;font-size:14px;font-weight:700">${d.count} caller${d.count !== 1 ? 's' : ''}</span>
        </div>
        <div style="display:flex;gap:24px;margin-bottom:16px">
          <div><span style="font-size:24px;font-weight:700;color:var(--color-green)">${rate}</span><span style="color:var(--color-muted)"> resolved</span></div>
          <div><span style="font-size:24px;font-weight:700">${d.episodes.length}</span><span style="color:var(--color-muted)"> episodes</span></div>
          <div><span style="font-size:24px;font-weight:700">${[...new Set(d.episodes)].length}</span><span style="color:var(--color-muted)"> unique eps</span></div>
        </div>
        ${d.topics.length ? `<div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:16px">${d.topics.slice(0, 12).map(t => `<span class="topic-tag">${escHtml(t)}</span>`).join('')}</div>` : ''}
        <div style="max-height:200px;overflow-y:auto">
          ${d.questions.slice(0, 6).map(item => `
            <div style="padding:8px 0;border-bottom:1px solid #1e3a5f;font-size:13px;color:#cbd5e1">
              <a href="/episodes?ep=${item.ep}" class="nav-link" data-link style="color:var(--color-primary)">${item.ep}</a>
              — ${escHtml(item.q.length > 100 ? item.q.slice(0, 100) + '…' : item.q)}
            </div>
          `).join('')}
        </div>
      </div>
    `
    townResultEl.querySelectorAll('a[data-link]').forEach(a => {
      a.addEventListener('click', e => { e.preventDefault(); history.pushState(null, '', a.href); window.dispatchEvent(new PopStateEvent('popstate')) })
    })
  }

  let debounceTimer = null
  townSearchEl.addEventListener('input', () => {
    clearTimeout(debounceTimer)
    const q = townSearchEl.value.trim()
    if (!q) { townResultEl.innerHTML = ''; townHintEl.textContent = `Search across ${townNames.length} UK towns and cities…`; return }
    townHintEl.textContent = 'Searching…'
    debounceTimer = setTimeout(() => {
      const qLower = q.toLowerCase()
      const matches = townNames.filter(t => t.toLowerCase().includes(qLower))
      if (!matches.length) {
        townResultEl.innerHTML = `<div style="padding:16px 0;color:#94a3b8">No callers from <strong>${escHtml(q)}</strong> yet. Try a different spelling.</div>`
        townHintEl.textContent = `0 results for "${q}"`
        return
      }
      const exact = matches.find(t => t.toLowerCase() === qLower)
      if (exact) { renderTown(exact); townHintEl.textContent = `Found ${townData[exact].count} callers from ${exact}!` }
      else {
        townResultEl.innerHTML = `<div style="padding:12px 0">
          <div style="font-size:13px;color:#94a3b8;margin-bottom:8px">${matches.length} matches — click one:</div>
          <div style="display:flex;flex-wrap:wrap;gap:8px">
            ${matches.slice(0, 20).map(t => `
              <button class="topic-tag" style="cursor:pointer;padding:6px 14px;font-size:13px" data-town="${escHtml(t)}">${escHtml(t)} <span style="opacity:0.7">(${townData[t].count})</span></button>
            `).join('')}
          </div>
        </div>`
        townResultEl.querySelectorAll('[data-town]').forEach(btn => btn.addEventListener('click', () => {
          townSearchEl.value = btn.dataset.town
          renderTown(btn.dataset.town)
        }))
        townHintEl.textContent = `${matches.length} matches for "${q}"`
      }
    }, 150)
  })

  // Location table
  const table = container.querySelector('#locTable')
  function renderTable(filter) {
    const rows = locations.filter(l => !filter || l.location.toLowerCase().includes(filter.toLowerCase()))
    table.innerHTML = `
      <table style="width:100%;border-collapse:collapse;font-size:13px">
        <thead style="position:sticky;top:0;background:var(--color-surface)">
          <tr style="text-align:left;color:var(--color-muted)">
            <th style="padding:8px">#</th>
            <th style="padding:8px">Location</th>
            <th style="padding:8px">Region</th>
            <th style="padding:8px;text-align:right">Calls</th>
            <th style="padding:8px;text-align:right">Resolved Rate</th>
            <th style="padding:8px">Bar</th>
          </tr>
        </thead>
        <tbody>
          ${rows.slice(0, 60).map((l, i) => `
            <tr style="border-top:1px solid var(--color-border)">
              <td style="padding:8px;color:var(--color-muted)">${i+1}</td>
              <td style="padding:8px;font-weight:600;cursor:pointer" class="loc-row" data-loc="${escHtml(l.location)}">${escHtml(l.location)}</td>
              <td style="padding:8px;color:var(--color-muted)">${escHtml(l.region || '')}</td>
              <td style="padding:8px;text-align:right">${l.count.toLocaleString()}</td>
              <td style="padding:8px;text-align:right;font-weight:600">${pct(l.resolved_rate, 1)}</td>
              <td style="padding:8px;width:100px"><div style="background:var(--color-primary);height:6px;border-radius:3px;width:${pct(l.resolved_rate, 1)}"></div></td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `
    table.querySelectorAll('.loc-row').forEach(row => {
      row.addEventListener('click', () => {
        townSearchEl.value = row.dataset.loc
        renderTown(row.dataset.loc)
        townResultEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
      })
    })
  }
  renderTable('')
  container.querySelector('#locSearch').addEventListener('input', e => renderTable(e.target.value))
}
