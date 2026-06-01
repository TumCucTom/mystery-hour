/**
 * Accuracy.js — "How did James (and callers) do?"
 * Split accuracy: James O'Brien vs expert callers vs all answers.
 * Era trend chart shows James's personal accuracy over time.
 */
import { loadJSON } from '../lib/data.js'

const ERA_LABELS = [
  'Era 1\n(0–99)', 'Era 2\n(100–199)', 'Era 3\n(200–299)',
  'Era 4\n(300–399)', 'Era 5\n(400–499)', 'Era 6\n(500–600)',
]

function escHtml(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}
function pct(n, d) { return d ? `${(n/d*100).toFixed(1)}%` : '—' }

export async function renderAccuracyPage(container, store) {
  container.innerHTML = `<div class="loading"><div class="spinner"></div>Loading accuracy data...</div>`
  loadJSON('james_accuracy.json').then(acc => {
    renderPage(container, acc)
  }).catch(e => {
    container.innerHTML = `<div class="loading"><div class="spinner"></div><p style="color:#e74c3c">Failed to load: ${e.message}</p></div>`
  })
}

function renderPage(container, acc) {
  const s = acc.summary

  container.innerHTML = `
    <div class="page-header">
      <h1>Accuracy Scorecard</h1>
      <p>Who gets things wrong — James O'Brien vs expert callers vs everyone?</p>
    </div>

    <!-- Overall summary cards -->
    <div class="stats-grid" style="--cols:3;margin-bottom:24px">
      <div class="stat-card">
        <div class="stat-value">${pct(s.all_wrong, s.all_total)}</div>
        <div class="stat-label">All Answers Wrong Rate</div>
        <div style="font-size:11px;color:var(--color-muted);margin-top:2px">${s.all_wrong.toLocaleString()} / ${s.all_total.toLocaleString()}</div>
      </div>
      <div class="stat-card">
        <div class="stat-value" style="color:var(--color-red)">${pct(s.james_wrong, s.james_total)}</div>
        <div class="stat-label">James O'Brien Wrong Rate</div>
        <div style="font-size:11px;color:var(--color-muted);margin-top:2px">${s.james_wrong.toLocaleString()} / ${s.james_total.toLocaleString()} answers</div>
      </div>
      <div class="stat-card">
        <div class="stat-value" style="color:var(--color-green)">${pct(s.caller_wrong, s.caller_total)}</div>
        <div class="stat-label">Expert Callers Wrong Rate</div>
        <div style="font-size:11px;color:var(--color-muted);margin-top:2px">${s.caller_wrong.toLocaleString()} / ${s.caller_total.toLocaleString()} answers</div>
      </div>
    </div>

    <!-- James era trend chart -->
    <div class="card" style="margin-bottom:24px">
      <h2 style="margin-bottom:16px">James's Accuracy Over Time</h2>
      <div id="eraChart" style="display:flex;align-items:flex-end;gap:12px;height:200px;padding-bottom:40px;position:relative">
        ${Object.entries(acc.era_breakdown || {}).sort((a,b) => parseInt(a[0])-parseInt(b[0])).map(([k, ed]) => {
          const jRate = ed.james.total ? (ed.james.wrong / ed.james.total * 100) : 0
          const barH = Math.max(jRate, 1.5)
          const color = jRate > 18 ? 'var(--color-red)' : jRate > 14 ? 'var(--color-yellow)' : 'var(--color-green)'
          return `<div style="flex:1;text-align:center;position:relative">
            <div style="position:absolute;bottom:40px;left:0;right:0;text-align:center">
              <div style="height:${barH}%;background:${color};border-radius:4px 4px 0 0;min-height:16px;display:flex;align-items:flex-start;justify-content:center;padding-top:4px">
                <span style="font-size:12px;font-weight:700;color:#fff">${jRate.toFixed(1)}%</span>
              </div>
            </div>
            <div style="position:absolute;bottom:0;left:0;right:0;font-size:11px;color:var(--color-muted)">${ERA_LABELS[parseInt(k)]?.split('\n')[0] || 'Era '+(parseInt(k)+1)}</div>
          </div>`
        }).join('')}
      </div>
      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:8px;font-size:12px;color:var(--color-muted)">
        ${Object.entries(acc.era_breakdown || {}).sort((a,b) => parseInt(a[0])-parseInt(b[0])).map(([k, ed]) =>
          `<span>${ERA_LABELS[parseInt(k)]?.split('\n')[0]}: ${ed.james.total} J answers</span>`
        ).join(' · ')}
      </div>
    </div>

    <!-- Side-by-side: James vs Callers per era -->
    <div class="card" style="margin-bottom:24px">
      <h2 style="margin-bottom:16px">James vs Callers — Who Is More Reliable?</h2>
      <div id="vsChart" style="display:flex;gap:4px;align-items:flex-end;height:180px;padding-bottom:36px;position:relative">
        ${Object.entries(acc.era_breakdown || {}).sort((a,b) => parseInt(a[0])-parseInt(b[0])).map(([k, ed]) => {
          const jRate = ed.james.total ? (ed.james.wrong / ed.james.total * 100) : 0
          const cRate = ed.caller.total ? (ed.caller.wrong / ed.caller.total * 100) : null
          const maxH = 25
          return `<div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:3px;position:relative">
            <div style="position:absolute;bottom:36px;left:0;right:0;display:flex;flex-direction:column;align-items:center;gap:2px">
              <div style="width:18px;background:rgba(239,68,60,0.8);border-radius:3px 3px 0 0;height:${Math.max(jRate, 2)}%;min-height:10px"></div>
              ${cRate !== null ? `<div style="width:18px;background:rgba(34,197,94,0.8);border-radius:3px 3px 0 0;height:${Math.max(cRate, 2)}%;min-height:10px"></div>` : ''}
            </div>
            <div style="position:absolute;bottom:0;left:0;right:0;text-align:center;font-size:10px;color:var(--color-muted)">${ERA_LABELS[parseInt(k)]?.split('\n')[0]}</div>
          </div>`
        }).join('')}
      </div>
      <div style="display:flex;gap:16px;margin-top:4px;font-size:12px">
        <div style="display:flex;align-items:center;gap:6px"><div style="width:12px;height:12px;background:rgba(239,68,60,0.8);border-radius:2px"></div> James O'Brien</div>
        <div style="display:flex;align-items:center;gap:6px"><div style="width:12px;height:12px;background:rgba(34,197,94,0.8);border-radius:2px"></div> Expert callers</div>
      </div>
    </div>

    <!-- Top speakers by wrong rate (min 10 answers) -->
    <div class="card" style="margin-bottom:24px">
      <h2>Speaker Leaderboard — Most Wrong (min 10 answers)</h2>
      <div id="speakerBoard"></div>
    </div>

    <!-- Per-episode table -->
    <div class="card">
      <h2>All Episodes — James vs Callers Breakdown</h2>
      <div style="display:flex;gap:12px;margin-bottom:12px;flex-wrap:wrap">
        <select id="accEraFilter" style="padding:8px;border-radius:6px;background:var(--color-bg);color:var(--color-text);border:1px solid var(--color-border)">
          <option value="">All eras</option>
          ${ERA_LABELS.map((l, i) => `<option value="${i}">${l.split('\n')[0]}</option>`).join('')}
        </select>
        <input type="text" id="accSearch" placeholder="Filter episode…" style="padding:8px;border-radius:6px;border:1px solid var(--color-border);background:var(--color-bg);color:var(--color-text)">
      </div>
      <div id="episodeTable" style="max-height:500px;overflow-y:auto"></div>
    </div>
  `

  // Speaker leaderboard
  const sb = container.querySelector('#speakerBoard')
  const speakers = (acc.speaker_leaderboard || []).filter(s => s.total >= 10).slice(0, 20)
  sb.innerHTML = `
    <table style="width:100%;border-collapse:collapse;font-size:13px">
      <thead>
        <tr style="text-align:left;color:var(--color-muted);border-bottom:1px solid var(--color-border)">
          <th style="padding:8px">Speaker</th>
          <th style="padding:8px;text-align:right">Answers</th>
          <th style="padding:8px;text-align:right">Wrong</th>
          <th style="padding:8px;text-align:right">Rate</th>
          <th style="padding:8px">Bar</th>
        </tr>
      </thead>
      <tbody>
        ${speakers.map(sp => `
          <tr style="border-top:1px solid var(--color-border)">
            <td style="padding:8px;font-weight:600">${escHtml(sp.speaker)}</td>
            <td style="padding:8px;text-align:right;color:var(--color-muted)">${sp.total}</td>
            <td style="padding:8px;text-align:right;color:var(--color-red)">${sp.wrong}</td>
            <td style="padding:8px;text-align:right;font-weight:700;color:${sp.rate>0.2?'var(--color-red)':sp.rate>0.1?'var(--color-yellow)':'var(--color-green)'}">${(sp.rate*100).toFixed(1)}%</td>
            <td style="padding:8px;width:100px"><div style="background:var(--color-red);height:6px;border-radius:3px;width:${(sp.rate*100).toFixed(1)}%"></div></td>
          </tr>`).join('')}
      </tbody>
    </table>`

  // Episode table
  const table = container.querySelector('#episodeTable')
  const eraFilter = container.querySelector('#accEraFilter')
  const searchEl = container.querySelector('#accSearch')

  function renderTable() {
    const era = eraFilter.value
    const q = searchEl.value.trim().toLowerCase()
    let rows = acc.episode_stats || []

    if (era !== '') rows = rows.filter(r => r.idx >= parseInt(era)*100 && r.idx < (parseInt(era)+1)*100)
    if (q) rows = rows.filter(r => r.episode.toLowerCase().includes(q))

    table.innerHTML = `
      <table style="width:100%;border-collapse:collapse;font-size:12px">
        <thead style="position:sticky;top:0;background:var(--color-surface);z-index:1">
          <tr style="text-align:left;color:var(--color-muted);font-size:11px">
            <th style="padding:6px 8px">Episode</th>
            <th style="padding:6px 8px;text-align:right">All Q</th>
            <th style="padding:6px 8px;text-align:right">All Wrong</th>
            <th style="padding:6px 8px;text-align:right">All Rate</th>
            <th style="padding:6px 8px;text-align:right">James Q</th>
            <th style="padding:6px 8px;text-align:right">James Wrong</th>
            <th style="padding:6px 8px;text-align:right">James Rate</th>
            <th style="padding:6px 8px;text-align:right">Caller Q</th>
            <th style="padding:6px 8px;text-align:right">Caller Wrong</th>
            <th style="padding:6px 8px;text-align:right">Caller Rate</th>
          </tr>
        </thead>
        <tbody>
          ${rows.map(e => {
            const jRate = e.james_rate != null ? e.james_rate * 100 : null
            const cRate = e.caller_rate != null ? e.caller_rate * 100 : null
            return `<tr style="border-top:1px solid var(--color-border)">
              <td style="padding:6px 8px">
                <a href="/episodes?ep=${e.episode}" class="nav-link" data-link>${escHtml(e.episode)}</a>
              </td>
              <td style="padding:6px 8px;text-align:right">${e.total}</td>
              <td style="padding:6px 8px;text-align:right;color:var(--color-red)">${e.wrong}</td>
              <td style="padding:6px 8px;text-align:right;font-weight:600">${pct(e.wrong, e.total)}</td>
              <td style="padding:6px 8px;text-align:right;color:var(--color-muted)">${e.james_total}</td>
              <td style="padding:6px 8px;text-align:right;color:var(--color-red)">${e.james_wrong}</td>
              <td style="padding:6px 8px;text-align:right;font-weight:${jRate>15?'700':'400'};color:${jRate>18?'var(--color-red)':jRate>12?'var(--color-yellow)':'var(--color-green)'}">${jRate !== null ? jRate.toFixed(1)+'%' : '—'}</td>
              <td style="padding:6px 8px;text-align:right;color:var(--color-muted)">${e.caller_total}</td>
              <td style="padding:6px 8px;text-align:right;color:var(--color-red)">${e.caller_wrong}</td>
              <td style="padding:6px 8px;text-align:right;font-weight:${cRate>10?'700':'400'};color:${cRate>15?'var(--color-red)':cRate>5?'var(--color-yellow)':'var(--color-green)'}">${cRate !== null ? cRate.toFixed(1)+'%' : '—'}</td>
            </tr>`
          }).join('')}
        </tbody>
      </table>`
  }

  renderTable()
  eraFilter.addEventListener('change', renderTable)
  searchEl.addEventListener('input', renderTable)
}