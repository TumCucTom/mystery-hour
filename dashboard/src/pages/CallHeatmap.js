/**
 * CallHeatmap.js — "Call the Show Heatmap"
 * Topic cluster frequency heatmap across episode eras (proxy for day/time).
 * Since exact broadcast timestamps aren't available, we use episode number
 * ranges as a proxy for time progression and show topic cluster popularity.
 */
import { loadJSON } from '../lib/data.js'
import { loadAll } from '../lib/data.js'

function escHtml(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

export async function renderCallHeatmapPage(container, store) {
  container.innerHTML = `<div class="loading"><div class="spinner"></div>Loading call patterns...</div>`
  try {
    const [allQa, k80] = await Promise.all([
      loadJSON('all_qa.json'),
      loadJSON('kmeans_k80_stats.json'),
    ])
    renderPage(container, allQa, k80)
  } catch (e) {
    container.innerHTML = `<div class="loading"><div class="spinner"></div><p style="color:#e74c3c">Could not load data.</p></div>`
    console.error(e)
  }
}

function renderPage(container, allQa, k80) {
  const nEps = allQa.episodes.length
  const eraSize = Math.ceil(nEps / 6)
  const eraNames = ['Era 1\n(early)', 'Era 2', 'Era 3', 'Era 4', 'Era 5', 'Era 6\n(recent)']

  // Get top 20 most common topics/clusters
  const topicCounts = {}
  for (const ep of allQa.episodes) {
    for (const q of (ep.questions || [])) {
      for (const t of (q.topics || [])) {
        topicCounts[t] = (topicCounts[t] || 0) + 1
      }
    }
  }
  const topTopics = Object.entries(topicCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 25)
    .map(([t]) => t)

  // Build era x topic matrix
  const eraTopicMatrix = Array.from({ length: 6 }, () => ({}))
  for (let ei = 0; ei < allQa.episodes.length; ei++) {
    const era = Math.min(Math.floor(ei / eraSize), 5)
    const ep = allQa.episodes[ei]
    for (const q of (ep.questions || [])) {
      for (const t of (q.topics || [])) {
        eraTopicMatrix[era][t] = (eraTopicMatrix[era][t] || 0) + 1
      }
    }
  }

  // Normalise by era total
  const eraTotals = eraTopicMatrix.map(m => Object.values(m).reduce((s, v) => s + v, 0))
  const normMatrix = eraTopicMatrix.map((m, ei) => {
    const total = eraTotals[ei]
    const row = {}
    for (const t of topTopics) row[t] = total ? (m[t] || 0) / total : 0
    return row
  })

  // Find max for colour scaling
  const maxVal = Math.max(...normMatrix.map(row => Math.max(...Object.values(row))))

  // Episode volume per era
  const eraEps = eraTopicMatrix.map((_, i) => {
    const start = i * eraSize
    const end = Math.min((i + 1) * eraSize, nEps)
    return `${end - start} eps`
  })

  container.innerHTML = `
    <div class="page-header">
      <h1>📊 Call the Show — Topic Heatmap</h1>
      <p>Topic cluster frequency across the show's history (601 episodes grouped into 6 eras).</p>
    </div>

    <div class="card" style="margin-bottom:24px;background:linear-gradient(135deg,#1a1a2e,#16213e);border:1px solid #0f3460">
      <p style="color:#94a3b8;font-size:14px;margin:0">
        <strong style="color:#fff">Note:</strong> Exact broadcast day/time isn't available. This heatmap shows how topic
        clusters changed across <strong style="color:#fff">6 episode eras</strong> — from early episodes (2001–2004) to recent ones.
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
                <div class="heatmap-era-name">${name.replace('\n', ' ')}</div>
                <div class="heatmap-era-eps">${eraEps[i]}</div>
              </div>
            `).join('')}
          </div>
          ${topTopics.map((topic, ti) => {
            const vals = normMatrix.map(row => row[topic] || 0)
            return `
            <div class="heatmap-row">
              <div class="heatmap-row-label" title="${escHtml(topic)}">${escHtml(topic.length > 20 ? topic.slice(0, 20) + '…' : topic)}</div>
              ${vals.map((v, ei) => {
                const intensity = maxVal > 0 ? v / maxVal : 0
                const rawCount = eraTopicMatrix[ei][topic] || 0
                return `
                <div class="heatmap-cell" style="background:rgba(59,130,246,${intensity.toFixed(3)})" title="${escHtml(topic)} (${eraNames[ei].replace('\n', ' ')}): ${rawCount} questions (${(v*100).toFixed(1)}%)">
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
      <h2>📈 Rising Topics (Era 1 → Era 6)</h2>
      <div id="risingTopics" class="trend-list"></div>
    </div>
    <div class="card">
      <h2>📉 Declining Topics (Era 1 → Era 6)</h2>
      <div id="fallingTopics" class="trend-list"></div>
    </div>
  `

  // Compute rising/falling
  const rising = topTopics
    .map(t => {
      const early = normMatrix[0][t] || 0
      const late = normMatrix[5][t] || 0
      return { topic: t, early, late, delta: late - early }
    })
    .filter(x => x.early > 0.01 || x.late > 0.01)
    .sort((a, b) => b.delta - a.delta)

  const risingEl = container.querySelector('#risingTopics')
  const fallingEl = container.querySelector('#fallingTopics')

  risingEl.innerHTML = rising.slice(0, 8).map(r => `
    <div class="trend-item">
      <div class="trend-label">${escHtml(r.topic)}</div>
      <div class="trend-bars">
        <div class="trend-bar-wrap"><div class="trend-bar trend-early" style="width:${(r.early * 100).toFixed(1)}%"></div><span class="trend-pct">${(r.early * 100).toFixed(1)}%</span></div>
        <div class="trend-bar-wrap"><div class="trend-bar trend-late" style="width:${(r.late * 100).toFixed(1)}%"></div><span class="trend-pct">${(r.late * 100).toFixed(1)}%%</span></div>
      </div>
    </div>
  `).join('')

  fallingEl.innerHTML = rising.slice(-8).reverse().map(r => `
    <div class="trend-item">
      <div class="trend-label">${escHtml(r.topic)}</div>
      <div class="trend-bars">
        <div class="trend-bar-wrap"><div class="trend-bar trend-early" style="width:${(r.early * 100).toFixed(1)}%"></div><span class="trend-pct">${(r.early * 100).toFixed(1)}%</span></div>
        <div class="trend-bar-wrap"><div class="trend-bar trend-late" style="width:${(r.late * 100).toFixed(1)}%"></div><span class="trend-pct">${(r.late * 100).toFixed(1)}%</span></div>
      </div>
    </div>
  `).join('')
}
