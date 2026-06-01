/**
 * Accuracy.js — "How did James do?" Scorecard
 * Shows James's overturned/wrong answer rate overall and per episode.
 */
import { loadJSON } from '../lib/data.js'
import { makeBarChart } from '../lib/chart-helper.js'

const BASE = '/data'

function escHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function pct(n, d) {
  return d ? `${(n/d*100).toFixed(1)}%` : '—'
}

function renderAccuracy(container, store) {
  container.innerHTML = `<div class="loading"><div class="spinner"></div>Loading accuracy data...</div>`
  loadJSON('james_accuracy.json').then(acc => {
    renderPage(container, acc)
  }).catch(() => {
    container.innerHTML = `<div class="loading"><div class="spinner"></div><p style="color:#e74c3c">Failed to load accuracy data.</p></div>`
  })
}

function renderPage(container, acc) {
  const s = acc.summary

  const worstChartData = acc.worst_episodes.slice(0, 15).map(e => ({
    episode: e.episode.replace('ep_', ''),
    rate: e.rate * 100,
  }))

  const bestChartData = acc.best_episodes.slice(-10).map(e => ({
    episode: e.episode.replace('ep_', ''),
    rate: e.rate * 100,
  }))

  container.innerHTML = `
    <div class="page-header">
      <h1>James's Accuracy Scorecard</h1>
      <p>How often does James get caught out by callers?</p>
    </div>

    <!-- Summary cards -->
    <div class="stats-grid" style="--cols: 4">
      <div class="stat-card">
        <div class="stat-value">${s.total_questions.toLocaleString()}</div>
        <div class="stat-label">Questions Analysed</div>
      </div>
      <div class="stat-card">
        <div class="stat-value" style="color: var(--color-red)">${pct(s.questions_with_overturned_answer, s.total_questions)}</div>
        <div class="stat-label">Wrong Answer Rate</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">${s.questions_with_overturned_answer.toLocaleString()}</div>
        <div class="stat-label">Questions with Overturned Answer</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">${s.longest_wrong_streak}</div>
        <div class="stat-label">Longest Wrong Streak (consecutive eps with ≥1 wrong)</div>
      </div>
    </div>

    <!-- Worst episodes bar chart -->
    <div class="card">
      <h2>Worst Episodes (most wrong answers)</h2>
      <canvas id="worstChart" height="60"></canvas>
    </div>

    <!-- Top overturned questions -->
    <div class="card">
      <h2>Most Frequently Overturned Questions</h2>
      <div class="overturned-list">
        ${acc.overturned_details.slice(0, 20).map(item => `
          <div class="overturned-item">
            <div class="overturned-badge">×${item.overturned_count}</div>
            <div class="overturned-text">
              <div class="overturned-q">${escHtml(item.question)}</div>
              <div class="overturned-meta">
                <a href="/episodes?ep=${item.episode}" class="nav-link" data-link>${item.episode}</a>
                · ${item.resolved ? 'Resolved' : 'Unresolved'}
              </div>
            </div>
          </div>
        `).join('')}
      </div>
    </div>

    <!-- Best episodes -->
    <div class="card">
      <h2>Best Episodes (fewest wrong answers)</h2>
      <div class="best-episodes">
        ${acc.best_episodes.slice(0, 10).map(e => `
          <div class="best-ep-item">
            <span class="best-ep-name">${escHtml(e.episode)}</span>
            <span class="best-ep-stat">${e.total} Q · ${e.wrong} wrong</span>
            <div class="best-ep-bar" style="width: ${pct(e.wrong, e.total)}"></div>
          </div>
        `).join('')}
      </div>
    </div>

    <!-- All episode stats table -->
    <div class="card">
      <h2>All Episodes — Wrong Answer Rate</h2>
      <input type="text" id="accSearch" placeholder="Filter episodes…" style="margin-bottom:12px;padding:8px;border-radius:6px;border:1px solid var(--color-border);width:100%;max-width:300px">
      <div id="episodeTable" style="max-height:400px;overflow-y:auto"></div>
    </div>
  `

  // Chart.js bar chart for worst episodes
  const ctx = container.querySelector('#worstChart').getContext('2d')
  makeBarChart(ctx, worstChartData.map(d => d.episode), worstChartData.map(d => d.rate), 'Wrong answer rate (%)', 'rgba(231,76,60,0.7)').catch(() => {})

  // Episode table with filter
  const table = container.querySelector('#episodeTable')
  function renderTable(filter) {
    const rows = acc.episode_stats.filter(e => !filter || e.episode.includes(filter))
    table.innerHTML = `
      <table style="width:100%;border-collapse:collapse;font-size:13px">
        <thead style="position:sticky;top:0;background:var(--color-surface)">
          <tr style="text-align:left;color:var(--color-muted)">
            <th style="padding:8px">Episode</th>
            <th style="padding:8px;text-align:right">Questions</th>
            <th style="padding:8px;text-align:right">Wrong</th>
            <th style="padding:8px;text-align:right">Rate</th>
            <th style="padding:8px">Bar</th>
          </tr>
        </thead>
        <tbody>
          ${rows.slice(0, 200).map(e => `
            <tr style="border-top:1px solid var(--color-border)">
              <td style="padding:8px">
                <a href="/episodes?ep=${e.episode}" class="nav-link" data-link>${escHtml(e.episode)}</a>
              </td>
              <td style="padding:8px;text-align:right">${e.total}</td>
              <td style="padding:8px;text-align:right;color:var(--color-red)">${e.wrong}</td>
              <td style="padding:8px;text-align:right;font-weight:600">${pct(e.wrong, e.total)}</td>
              <td style="padding:8px;width:120px">
                <div style="background:var(--color-red);height:6px;border-radius:3px;width:${pct(e.wrong, e.total)}"></div>
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `
  }
  renderTable('')
  container.querySelector('#accSearch').addEventListener('input', e => renderTable(e.target.value))
}

export function renderAccuracyPage(container, store) {
  renderAccuracy(container, store)
}