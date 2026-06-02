/**
 * TopicDrift.js — How topics evolved over 601 episodes.
 * Stacked area chart showing cluster composition per episode over time.
 */
import { loadJSON } from '../lib/data.js'
import { makeStackedAreaChart } from '../lib/chart-helper.js'

const BASE = '/data'

function escHtml(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

export async function renderTopicDriftPage(container, store) {
  container.innerHTML = `<div class="loading"><div class="spinner"></div>Loading topic drift data...</div>`
  try {
    const [drift, fingerprints] = await Promise.all([
      loadJSON('topic_drift.json'),
      loadJSON('episode_fingerprints.json'),
    ])
    renderPage(container, drift, fingerprints)
  } catch (e) {
    container.innerHTML = `<div class="loading"><div class="spinner"></div><p style="color:#e74c3c">Failed to load topic drift data.</p></div>`
    console.error(e)
  }
}

function renderPage(container, drift, fingerprints) {
  const episodes = drift.episodes
  const COLORS = [
    'rgba(52,152,219,0.7)', 'rgba(231,76,60,0.7)', 'rgba(46,204,113,0.7)',
    'rgba(155,89,182,0.7)', 'rgba(241,196,15,0.7)', 'rgba(26,188,156,0.7)',
    'rgba(230,126,34,0.7)', 'rgba(142,68,173,0.7)', 'rgba(22,160,133,0.7)',
    'rgba(243,156,18,0.7)',
  ]

  // Parse episode numbers and fill gaps with null so missing eps show as breaks on the x-axis
  const epNums = episodes.map(ep => parseInt(ep.replace(/[^\d]/g, ''), 10))
  const minN = epNums[0]
  const maxN = epNums[epNums.length - 1]

  // Build a contiguous label set (every episode number) and map data accordingly
  const contiguous = []
  for (let n = minN; n <= maxN; n++) contiguous.push(n)
  const epIndex = Object.fromEntries(epNums.map((n, i) => [n, i]))

  // X-axis labels: every 50th episode number, blank otherwise
  const xLabels = contiguous.map(n => n % 50 === 0 ? String(n) : '')

  // Re-shape each series so missing eps are null
  const reshaped = drift.series.map(s => ({
    label: s.label,
    data: contiguous.map(n => {
      const idx = epIndex[n]
      return idx == null ? null : (s.values[idx] ?? null)
    }),
  }))

  const datasets = reshaped.map((s, i) => ({
    label: s.label,
    data: s.data,
    backgroundColor: COLORS[i % COLORS.length],
    borderColor: COLORS[i % COLORS.length].replace('0.7', '1'),
    fill: true,
    tension: 0.3,
    pointRadius: 0,
    borderWidth: 1.5,
    spanGaps: false,
  }))

  container.innerHTML = `
    <div class="page-header">
      <h1>Topic Drift — 10 Years of Mystery Hour</h1>
      <p>How question topics evolved across ${episodes.length} episodes. Each line = one cluster's share of questions.</p>
    </div>

    <div class="card" style="margin-bottom:24px">
      <h3>Cluster Composition Over Time (stacked area)</h3>
      <div style="height:400px;position:relative">
        <canvas id="driftChart"></canvas>
      </div>
      <div style="font-size:12px;color:var(--color-muted);margin-top:8px">
        X-axis = episode index (sorted chronologically). Y-axis = fraction of questions per cluster.
      </div>
    </div>

    <div class="card">
      <h3>Top 10 Most Variable Clusters</h3>
      <div class="cluster-list">
        ${drift.series.map((s, i) => `
          <div class="cluster-item">
            <div class="cluster-color" style="background:${COLORS[i]}"></div>
            <div class="cluster-info">
              <div class="cluster-name">${escHtml(s.label)}</div>
              <div class="cluster-desc">Variance across episodes: ${(drift.series[i].values ? computeVariance(drift.series[i].values) : 0).toFixed(4)}</div>
            </div>
          </div>
        `).join('')}
      </div>
    </div>

    <div class="card">
      <h3>Browse Episode Fingerprints</h3>
      <input type="text" id="fpSearch" placeholder="Filter episodes…" style="margin-bottom:12px;padding:8px;border-radius:6px;border:1px solid var(--color-border);width:100%;max-width:300px">
      <div id="fpGrid" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:12px"></div>
    </div>
  `

  makeStackedAreaChart(
    container.querySelector('#driftChart').getContext('2d'),
    xLabels,
    datasets,
    'Fraction of questions'
  ).catch(() => {})

  const fpGrid = container.querySelector('#fpGrid')
  function renderFingerprints(filter) {
    const fps = (fingerprints.fingerprints || []).filter(f => !filter || f.episode.includes(filter))
    fpGrid.innerHTML = fps.slice(0, 60).map(fp => `
      <div class="fp-card" style="background:var(--color-surface);border-radius:8px;padding:12px;border:1px solid var(--color-border)">
        <div style="font-weight:600;margin-bottom:4px">
          <a href="/episodes?ep=${fp.episode}" class="nav-link" data-link>${fp.episode}</a>
        </div>
        <div style="font-size:12px;color:var(--color-muted)">${fp.n_questions} questions</div>
        <div style="margin-top:8px;display:flex;flex-wrap:wrap;gap:3px">
          ${(fp.distribution || []).slice(0, 8).map((frac, ci) => frac > 0.05 ? `<span style="background:${COLORS[ci % COLORS.length]};padding:2px 6px;border-radius:4px;font-size:10px">${(frac*100).toFixed(0)}%</span>` : '').join('')}
        </div>
      </div>
    `).join('')
    fpGrid.querySelectorAll('a[data-link]').forEach(a => {
      a.addEventListener('click', e => {
        e.preventDefault()
        history.pushState(null, '', a.href)
        window.dispatchEvent(new PopStateEvent('popstate'))
      })
    })
  }
  renderFingerprints('')
  container.querySelector('#fpSearch').addEventListener('input', e => renderFingerprints(e.target.value))
}

function computeVariance(arr) {
  const n = arr.length
  if (!n) return 0
  const mean = arr.reduce((s, v) => s + v, 0) / n
  return arr.reduce((s, v) => s + (v - mean) ** 2, 0) / n
}