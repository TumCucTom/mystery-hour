/**
 * Geographic.js — UK map of caller locations.
 * Shows top locations by call volume and resolution rate.
 */
import { loadJSON } from '../lib/data.js'

const BASE = './data'

function escHtml(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function pct(n, d) {
  return d ? `${(n/d*100).toFixed(1)}%` : '—'
}

export async function renderGeographicPage(container, store) {
  container.innerHTML = `<div class="loading"><div class="spinner"></div>Loading geographic data...</div>`
  try {
    const geo = await loadJSON(`${BASE}/geographic_data.json`)
    renderPage(container, geo)
  } catch (e) {
    container.innerHTML = `<div class="loading"><div class="spinner"></div><p style="color:#e74c3c">Could not load geographic data.</p></div>`
    console.error(e)
  }
}

function renderPage(container, geo) {
  const s = geo.summary
  const locations = geo.top_locations || []

  container.innerHTML = `
    <div class="page-header">
      <h1>📍 Geographic Patterns</h1>
      <p>Where do Mystery Hour callers come from? ${s.total_geolocated.toLocaleString()} callers across ${s.unique_locations} UK locations.</p>
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
      <h2>🏆 Top 60 Locations</h2>
      <input type="text" id="locSearch" placeholder="Filter locations…" style="margin-bottom:12px;padding:8px;border-radius:6px;border:1px solid var(--color-border);width:100%;max-width:300px">
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
              <td style="padding:8px;font-weight:600">${escHtml(l.location)}</td>
              <td style="padding:8px;color:var(--color-muted)">${escHtml(l.region)}</td>
              <td style="padding:8px;text-align:right">${l.count.toLocaleString()}</td>
              <td style="padding:8px;text-align:right;font-weight:600">${pct(l.resolved_rate, 1)}</td>
              <td style="padding:8px;width:100px">
                <div style="background:var(--color-primary);height:6px;border-radius:3px;width:${pct(l.resolved_rate, 1)}"></div>
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `
  }
  renderTable('')
  container.querySelector('#locSearch').addEventListener('input', e => renderTable(e.target.value))
}