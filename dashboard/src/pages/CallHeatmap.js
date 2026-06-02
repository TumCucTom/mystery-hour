/**
 * CallHeatmap.js — "Call the Show Heatmap"
 * Topic cluster frequency heatmap across episode eras (proxy for day/time).
 * Since exact broadcast timestamps aren't available, we use episode number
 * ranges as a proxy for time progression and show topic cluster popularity.
 */
import { loadJSON } from '../lib/data.js'

function escHtml(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

export async function renderCallHeatmapPage(container, store) {
  container.innerHTML = `<div class="loading"><div class="spinner"></div>Loading call patterns...</div>`
  try {
    const [allQa, evo] = await Promise.all([
      loadJSON('all_qa.json'),
      loadJSON('cluster_evolution.json'),
    ])
    renderPage(container, allQa, evo)
  } catch (e) {
    container.innerHTML = `<div class="loading"><div class="spinner"></div><p style="color:#e74c3c">Could not load data.</p></div>`
    console.error(e)
  }
}

function renderPage(container, allQa, evo) {
  const nEps = allQa.episodes.length
  const evolution = evo.evolution || []
  // Era count is driven by the data, not hardcoded
  const nEras = (evolution[0]?.values || []).length || (evo.era_labels || []).length || 6
  const eraQuestionCounts = evo.era_question_counts || Array(nEras).fill(0)
  const eraNames = evo.era_labels || Array.from({ length: nEras }, (_, i) => `Era ${i + 1}`)

  // Use the cluster_evolution data which has the actual era proportions
  const topTopics = [...evolution]
    .sort((a, b) => Math.max(...b.values) - Math.max(...a.values))
    .slice(0, 25)
    .map(r => r.label)

  // Build era x topic matrix from the cluster_evolution proportions
  const normMatrix = Array.from({ length: nEras }, () => ({}))
  for (const r of evolution) {
    for (let ei = 0; ei < nEras; ei++) {
      normMatrix[ei][r.label] = r.values[ei] || 0
    }
  }
  // Derive raw counts from proportions × era totals
  const eraTopicMatrix = normMatrix.map((row, ei) => {
    const total = eraQuestionCounts[ei] || 0
    const counts = {}
    for (const t of topTopics) {
      counts[t] = Math.round((row[t] || 0) * total)
    }
    return counts
  })

  // Find max for colour scaling
  const maxVal = Math.max(...topTopics.flatMap(t => normMatrix.map(row => row[t] || 0)), 0.001)

  // Episode volume per era (use era_question_counts for accurate counts)
  const eraEps = eraQuestionCounts.map(c => `${c} Q`)

  container.innerHTML = `
    <div class="page-header">
      <h1>📊 Call the Show — Topic Heatmap</h1>
      <p>Topic cluster frequency across the show's history (${nEps} episodes grouped into ${nEras} eras).</p>
    </div>

    <div class="card" style="margin-bottom:24px;background:linear-gradient(135deg,#1a1a2e,#16213e);border:1px solid #0f3460">
      <p style="color:#94a3b8;font-size:14px;margin:0">
        <strong style="color:#fff">Note:</strong> Exact broadcast day/time isn't available. This heatmap shows how topic
        clusters changed across <strong style="color:#fff">${nEras} episode eras</strong> — from early episodes to recent ones.
        Darker cells = higher proportion of questions on that topic in that era.
      </p>
    </div>

    <div class="card">
      <h2>Topic Cluster Frequency by Era</h2>
      <div class="heatmap-wrap">
        <div class="heatmap-container">
          <div class="heatmap-row heatmap-header-row">
            <div class="heatmap-corner"></div>
            ${eraNames.map((name, i) => `
              <div class="heatmap-col-header">
                <div class="heatmap-era-name">${escHtml(name.replace('\n', ' '))}</div>
                <div class="heatmap-era-eps">${eraEps[i] || ''}</div>
              </div>
            `).join('')}
          </div>
          ${topTopics.map((topic) => {
            const vals = normMatrix.map(row => row[topic] || 0)
            return `
            <div class="heatmap-row">
              <div class="heatmap-row-label" title="${escHtml(topic)}">${escHtml(topic.length > 20 ? topic.slice(0, 20) + '…' : topic)}</div>
              ${vals.map((v, ei) => {
                const intensity = maxVal > 0 ? v / maxVal : 0
                const rawCount = eraTopicMatrix[ei][topic] || 0
                return `
                <div class="heatmap-cell" style="background:rgba(59,130,246,${intensity.toFixed(3)})" title="${escHtml(topic)} (${escHtml(eraNames[ei].replace('\n', ' '))}): ${rawCount} questions (${(v*100).toFixed(1)}%)">
                  ${rawCount > 0 ? `<span class="heatmap-cell-count">${rawCount}</span>` : ''}
                </div>
              `}).join('')}
            </div>
          `}).join('')}
        </div>
      </div>
      <div class="heatmap-legend">
        <span>Less</span>
        ${[0, 0.25, 0.5, 0.75, 1].map(v => `<div class="heatmap-legend-cell" style="background:rgba(59,130,246,${v.toFixed(3)})"></div>`).join('')}
        <span>More</span>
      </div>
    </div>

    <!-- Rising and falling topics -->
    <div class="card">
      <h2>📈 Rising Topics (Era 1 → Era ${nEras})</h2>
      <div id="risingTopics" class="trend-list"></div>
    </div>
    <div class="card">
      <h2>📉 Declining Topics (Era 1 → Era ${nEras})</h2>
      <div id="fallingTopics" class="trend-list"></div>
    </div>
  `

  // Compute rising/falling from the actual evolution data
  const sorted = [...evolution].sort((a, b) => b.delta - a.delta)
  const rising = sorted.filter(r => r.delta > 0.001).slice(0, 8)
  const falling = sorted.filter(r => r.delta < -0.001).reverse().slice(0, 8)

  const risingEl = container.querySelector('#risingTopics')
  const fallingEl = container.querySelector('#fallingTopics')

  risingEl.innerHTML = rising.map(r => `
    <div class="trend-item">
      <div class="trend-label" title="${escHtml(r.label)}">${escHtml(r.label)}</div>
      <div class="trend-bars">
        <div class="trend-bar-wrap"><div class="trend-bar trend-early" style="width:${(r.early * 100).toFixed(1)}%"></div><span class="trend-pct">${(r.early * 100).toFixed(1)}%</span></div>
        <div class="trend-bar-wrap"><div class="trend-bar trend-late" style="width:${(r.late * 100).toFixed(1)}%"></div><span class="trend-pct">${(r.late * 100).toFixed(1)}%</span></div>
      </div>
    </div>
  `).join('')

  fallingEl.innerHTML = falling.map(r => `
    <div class="trend-item">
      <div class="trend-label" title="${escHtml(r.label)}">${escHtml(r.label)}</div>
      <div class="trend-bars">
        <div class="trend-bar-wrap"><div class="trend-bar trend-early" style="width:${(r.early * 100).toFixed(1)}%"></div><span class="trend-pct">${(r.early * 100).toFixed(1)}%</span></div>
        <div class="trend-bar-wrap"><div class="trend-bar trend-late" style="width:${(r.late * 100).toFixed(1)}%"></div><span class="trend-pct">${(r.late * 100).toFixed(1)}%</span></div>
      </div>
    </div>
  `).join('')
}
