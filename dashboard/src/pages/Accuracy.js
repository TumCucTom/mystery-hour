/**
 * Accuracy.js — "How did James (and callers) do?"
 * Split accuracy: James O'Brien vs expert callers vs all answers.
 * Rolling-average line chart shows James's personal wrong rate over time,
 * with a slider to control the window size.
 */
import { Chart, CategoryScale, LinearScale, LineController, LineElement, PointElement, BarController, BarElement, Title, Tooltip, Legend, Filler } from 'chart.js'
import { loadJSON } from '../lib/data.js'

Chart.register(CategoryScale, LinearScale, LineController, LineElement, PointElement, BarController, BarElement, Title, Tooltip, Legend, Filler)

const ERA_LABELS = [
  'Era 1\n(0–99)', 'Era 2\n(100–199)', 'Era 3\n(200–299)',
  'Era 4\n(300–399)', 'Era 5\n(400–499)', 'Era 6\n(500–600)',
]

function escHtml(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}
function pct(n, d) { return d ? `${(n/d*100).toFixed(1)}%` : '—' }

// Collapse speaker-name variants ("Professor Hal", "Professor Hal (Brighton)",
// "Professor Hal Sosabowski (University of Brighton)" ...) into one row.
// Keeps the longest label as the canonical name, sums totals/wrongs, recomputes rate.
function mergeSpeakers(rows) {
  const norm = s => s.toLowerCase()
    .replace(/\([^)]*\)/g, '')        // strip parentheticals like (Brighton)
    .replace(/\bprofessor\b/g, 'prof') // collapse "Professor" so order doesn't matter
    .replace(/\bdr\b\.?/g, 'dr')
    .replace(/[^a-z\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
  const tokens = s => norm(s).split(' ').filter(Boolean)

  // Build a key for each row. Strategy:
  //   1. Use normalised full string as the primary key.
  //   2. If a key is a strict prefix of another key, and the shorter one is ≥ 2 tokens,
  //      collapse to the longer key (so "prof hal" and "prof hal sosabowski" merge).
  const keys = rows.map(r => norm(r.speaker))
  const unique = [...new Set(keys)].sort((a, b) => a.length - b.length)
  const canonical = {}
  for (const k of unique) {
    const tA = k.split(' ').filter(Boolean)
    let parent = null
    for (const other of Object.keys(canonical)) {
      const tB = other.split(' ').filter(Boolean)
      if (tB.length < tA.length && tA.slice(0, tB.length).join(' ') === other && tB.length >= 2) {
        parent = other; break
      }
      if (tA.length < tB.length && tB.slice(0, tA.length).join(' ') === k && tA.length >= 2) {
        parent = k; break
      }
    }
    canonical[k] = parent || k
  }

  const groups = new Map()
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i]
    const grpKey = canonical[keys[i]]
    if (!groups.has(grpKey)) groups.set(grpKey, { speaker: r.speaker, total: 0, wrong: 0 })
    const g = groups.get(grpKey)
    g.total += r.total || 0
    g.wrong += r.wrong || 0
    if (r.speaker.length > g.speaker.length) g.speaker = r.speaker
  }
  return Array.from(groups.values()).map(g => ({
    speaker: g.speaker,
    total: g.total,
    wrong: g.wrong,
    rate: g.total ? g.wrong / g.total : 0,
  }))
}

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

    <!-- James rolling-average line chart -->
    <div class="card" style="margin-bottom:24px">
      <div style="display:flex;justify-content:space-between;align-items:flex-end;flex-wrap:wrap;gap:16px;margin-bottom:8px">
        <div>
          <h2 style="margin:0 0 4px 0">James's Wrong Rate Over Time</h2>
          <p style="margin:0;color:var(--color-muted);font-size:13px">
            Rolling average over the last <strong id="winLabel" style="color:var(--color-text)">20</strong> episodes
            — drag the slider to smooth or sharpen the curve.
          </p>
        </div>
        <div style="display:flex;align-items:center;gap:12px;min-width:340px">
          <span style="font-size:12px;color:var(--color-muted);white-space:nowrap">Window</span>
          <input type="range" id="winSlider" min="1" max="100" value="20" step="1"
            style="flex:1;accent-color:#e74c3c;cursor:pointer">
          <span id="winValue" style="font-size:13px;font-weight:700;color:var(--color-red);min-width:32px;text-align:right">20</span>
        </div>
      </div>
      <div style="height:320px;position:relative"><canvas id="rollingChart"></canvas></div>
      <div style="display:flex;gap:16px;margin-top:12px;font-size:12px;color:var(--color-muted);flex-wrap:wrap">
        <div style="display:flex;align-items:center;gap:6px">
          <div style="width:14px;height:3px;background:#e74c3c;border-radius:2px"></div>
          James O'Brien (rolling)
        </div>
        <div style="display:flex;align-items:center;gap:6px">
          <div style="width:14px;height:2px;background:rgba(231,76,60,0.35);border-radius:2px"></div>
          Per-episode raw rate
        </div>
        <div style="display:flex;align-items:center;gap:6px">
          <div style="width:14px;height:2px;background:#64748b;border-style:dashed"></div>
          Overall mean
        </div>
        <span id="winStat" style="margin-left:auto"></span>
      </div>
    </div>

    <!-- Side-by-side: James vs Callers per era -->
    <div class="card" style="margin-bottom:24px">
      <h2 style="margin-bottom:16px">James vs Callers — Who Is More Reliable?</h2>
      <p style="color:var(--color-muted);font-size:13px;margin:0 0 12px 0">
        Wrong-answer rate per era, with the absolute difference highlighted. Lower is better.
      </p>
      <div id="vsChart" style="height:280px;position:relative"><canvas id="vsCanvas"></canvas></div>
      <div id="vsInsight" style="margin-top:12px;font-size:13px;color:var(--color-muted)"></div>
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

  // Speaker leaderboard — collapse name variants for the same person
  const sb = container.querySelector('#speakerBoard')
  const merged = mergeSpeakers(acc.speaker_leaderboard || [])
  // Sort by wrong rate descending, then by wrong count as tiebreaker
  const speakers = merged
    .filter(s => s.total >= 5)
    .sort((a, b) => (b.rate - a.rate) || (b.wrong - a.wrong))
    .slice(0, 20)
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

  // Rolling-average line chart for James's wrong rate
  const eps = (acc.episode_stats || []).slice().sort((a, b) => a.idx - b.idx)
  const labels = eps.map(e => e.idx)
  const rawRate = eps.map(e => (e.james_total ? (e.james_wrong / e.james_total) * 100 : null))

  // Overall mean (sum wrong / sum total across all 601 episodes)
  const totWrong = eps.reduce((s, e) => s + (e.james_wrong || 0), 0)
  const totTotal = eps.reduce((s, e) => s + (e.james_total || 0), 0)
  const overallMean = totTotal ? (totWrong / totTotal) * 100 : 0

  // Build the rolling series: at each index i, average the window [i-w+1 .. i]
  // Uses sum(wrong) / sum(total) for a weighted rate, not a mean of rates.
  function rolling(win) {
    return eps.map((_, i) => {
      const start = Math.max(0, i - win + 1)
      let w = 0, t = 0
      for (let j = start; j <= i; j++) { w += eps[j].james_wrong || 0; t += eps[j].james_total || 0 }
      return t ? (w / t) * 100 : null
    })
  }

  const ctx = container.querySelector('#rollingChart')
  const chart = new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [
        {
          label: 'James (rolling)',
          data: rolling(20),
          borderColor: '#e74c3c',
          backgroundColor: 'rgba(231, 76, 60, 0.12)',
          borderWidth: 2.5,
          pointRadius: 0,
          pointHoverRadius: 5,
          tension: 0.25,
          fill: true,
          spanGaps: true,
        },
        {
          label: 'Raw rate',
          data: rawRate,
          borderColor: 'rgba(231, 76, 60, 0.35)',
          borderWidth: 1,
          pointRadius: 0,
          pointHoverRadius: 3,
          tension: 0,
          spanGaps: true,
        },
        {
          label: 'Overall mean',
          data: eps.map(() => overallMean),
          borderColor: '#64748b',
          borderDash: [4, 4],
          borderWidth: 1.5,
          pointRadius: 0,
          fill: false,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: { duration: 200 },
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: 'rgba(15, 23, 42, 0.95)',
          padding: 10,
          callbacks: {
            title: items => `Episode ${items[0].label}`,
            label: ctx => {
              if (ctx.parsed.y == null) return `${ctx.dataset.label}: —`
              return `${ctx.dataset.label}: ${ctx.parsed.y.toFixed(1)}%`
            },
          },
        },
      },
      scales: {
        x: {
          title: { display: true, text: 'Episode index', color: '#94a3b8' },
          ticks: { color: '#94a3b8', maxTicksLimit: 12 },
          grid: { color: 'rgba(148, 163, 184, 0.08)' },
        },
        y: {
          title: { display: true, text: 'Wrong rate (%)', color: '#94a3b8' },
          beginAtZero: true,
          ticks: { color: '#94a3b8', callback: v => v + '%' },
          grid: { color: 'rgba(148, 163, 184, 0.08)' },
        },
      },
    },
  })

  const slider = container.querySelector('#winSlider')
  const winLabel = container.querySelector('#winLabel')
  const winValue = container.querySelector('#winValue')
  const winStat = container.querySelector('#winStat')

  function updateWindow() {
    const w = parseInt(slider.value, 10)
    chart.data.datasets[0].data = rolling(w)
    chart.update('none')
    winLabel.textContent = w
    winValue.textContent = w
    // Show the latest value for context
    const last = chart.data.datasets[0].data[chart.data.datasets[0].data.length - 1]
    const first = chart.data.datasets[0].data[w - 1] ?? null
    const delta = (last != null && first != null) ? (last - first) : 0
    const arrow = delta > 0.5 ? '↑' : delta < -0.5 ? '↓' : '→'
    const color = delta > 0.5 ? 'var(--color-red)' : delta < -0.5 ? 'var(--color-green)' : 'var(--color-muted)'
    winStat.innerHTML = `Latest: <strong style="color:${color}">${last?.toFixed(1) ?? '—'}%</strong>
      <span style="color:${color}">${arrow}</span> ${Math.abs(delta).toFixed(1)}pp vs earliest window`
  }

  slider.addEventListener('input', updateWindow)
  updateWindow()

  // James vs Callers grouped bar chart
  const eras = Object.entries(acc.era_breakdown || {}).sort((a, b) => parseInt(a[0]) - parseInt(b[0]))
  const eraLabels = eras.map(([k]) => ERA_LABELS[parseInt(k)]?.split('\n')[0] || `Era ${parseInt(k) + 1}`)
  const jRates = eras.map(([, ed]) => ed.james.total ? (ed.james.wrong / ed.james.total) * 100 : 0)
  const cRates = eras.map(([, ed]) => ed.caller.total ? (ed.caller.wrong / ed.caller.total) * 100 : 0)
  const totals = eras.map(([, ed]) => ({ j: ed.james.total, c: ed.caller.total }))

  const vsCtx = container.querySelector('#vsCanvas')
  new Chart(vsCtx, {
    type: 'bar',
    data: {
      labels: eraLabels,
      datasets: [
        {
          label: "James O'Brien",
          data: jRates,
          backgroundColor: 'rgba(239, 68, 60, 0.85)',
          borderColor: 'rgba(239, 68, 60, 1)',
          borderWidth: 1,
          borderRadius: 4,
        },
        {
          label: 'Expert callers',
          data: cRates,
          backgroundColor: 'rgba(34, 197, 94, 0.85)',
          borderColor: 'rgba(34, 197, 94, 1)',
          borderWidth: 1,
          borderRadius: 4,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: { duration: 200 },
      plugins: {
        legend: { position: 'top', labels: { color: '#94a3b8', boxWidth: 12, padding: 12 } },
        tooltip: {
          backgroundColor: 'rgba(15, 23, 42, 0.95)',
          padding: 10,
          callbacks: {
            label: ctx => {
              const i = ctx.dataIndex
              const t = totals[i]
              return `${ctx.dataset.label}: ${ctx.parsed.y.toFixed(1)}% (${t[ctx.datasetIndex === 0 ? 'j' : 'c']} answers)`
            },
            afterBody: items => {
              const i = items[0].dataIndex
              const diff = jRates[i] - cRates[i]
              const sign = diff > 0 ? '+' : ''
              return `Δ = James − Callers: ${sign}${diff.toFixed(1)}pp`
            },
          },
        },
      },
      scales: {
        x: {
          ticks: { color: '#94a3b8' },
          grid: { color: 'rgba(148, 163, 184, 0.08)' },
        },
        y: {
          beginAtZero: true,
          title: { display: true, text: 'Wrong rate (%)', color: '#94a3b8' },
          ticks: { color: '#94a3b8', callback: v => v + '%' },
          grid: { color: 'rgba(148, 163, 184, 0.08)' },
        },
      },
    },
  })

  // Insight footer: who's more reliable overall, and per era?
  const vsInsight = container.querySelector('#vsInsight')
  const allJ = jRates.reduce((s, v, i) => s + v * totals[i].j, 0) / totals.reduce((s, t) => s + t.j, 0)
  const allC = cRates.reduce((s, v, i) => s + v * totals[i].c, 0) / totals.reduce((s, t) => s + t.c, 0)
  const diff = allJ - allC
  const who = diff > 0
    ? `<strong style="color:var(--color-green)">Expert callers are ${Math.abs(diff).toFixed(1)}pp more reliable</strong>`
    : `<strong style="color:var(--color-red)">James is ${Math.abs(diff).toFixed(1)}pp more reliable</strong>`
  const eraSwings = eras.map(([k], i) => Math.abs(jRates[i] - cRates[i]))
  const swingIdx = eraSwings.indexOf(Math.max(...eraSwings))
  vsInsight.innerHTML = `${who} overall (${allJ.toFixed(1)}% vs ${allC.toFixed(1)}% wrong). Biggest era gap: <strong>${eraLabels[swingIdx]}</strong> at ${eraSwings[swingIdx].toFixed(1)}pp.`
}