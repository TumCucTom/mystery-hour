/**
 * DunningKruger.js — "The Dunning-Kruger Effect"
 * Plots confidence (answer length / number of answers) vs actual accuracy (resolved rate).
 * Shows whether longer answers or more debate = higher or lower accuracy.
 */
import { loadJSON } from '../lib/data.js'

function pct(n, d) {
  return d ? `${(n / d * 100).toFixed(1)}%` : '—'
}

export async function renderDunningKrugerPage(container, store) {
  container.innerHTML = `<div class="loading"><div class="spinner"></div>Loading Dunning-Kruger data...</div>`
  try {
    const data = await loadJSON('dunning_kruger.json')
    renderPage(container, data)
  } catch (e) {
    container.innerHTML = `<div class="loading"><div class="spinner"></div><p style="color:#e74c3c">Failed to load data.</p></div>`
    console.error(e)
  }
}

function renderPage(container, data) {
  const lenBuckets = data.answer_length_buckets || {}
  const nAnsBuckets = data.n_answers_buckets || {}
  const zeroAns = (nAnsBuckets['0'] && nAnsBuckets['0'].total) || 0

  // Chart data for answer length buckets
  const lenLabels = { low: 'Short answers\n(<15 words)', medium: 'Medium answers\n(15-35 words)', high: 'Long answers\n(35+ words)' }
  const lenChartData = Object.entries(lenBuckets).map(([k, v]) => ({
    label: lenLabels[k] || k,
    rate: (v.rate || 0) * 100,
    total: v.total,
    resolved: v.resolved,
  }))

  // Chart data for n_answers buckets
  const nAnsLabels = { '0': '0 answers', '1': '1 answer', '2': '2 answers', '3': '3 answers', '4': '4 answers', '5': '5+ answers' }
  const nAnsChartData = Object.keys(nAnsLabels).filter(k => nAnsBuckets[k]).map(k => ({
    label: nAnsLabels[k],
    k,
    rate: (nAnsBuckets[k].rate || 0) * 100,
    total: nAnsBuckets[k].total,
    resolved: nAnsBuckets[k].resolved,
  }))

  container.innerHTML = `
    <div class="page-header">
      <h1>The Dunning-Kruger Effect</h1>
      <p>Does overconfidence lead to wrong answers? Compare answer length &amp; debate count vs actual accuracy.</p>
    </div>

    <div class="dk-insight card" style="background:linear-gradient(135deg,#1a1a2e,#16213e);border:1px solid #0f3460;margin-bottom:24px">
      <div class="dk-insight-icon">💡</div>
      <div class="dk-insight-text">
        <strong>Finding:</strong> Long answers have an <span style="color:#4ade80">85.3% resolution rate</span> vs short answers at <span style="color:#f87171">57.7%</span>.
        More debate (2-3 answers) also correlates with higher accuracy — callers push James to think harder.
        Questions with zero answers are almost never resolved (0.6%) — they were cut off or skipped.
      </div>
    </div>

    <!-- Answer Length vs Accuracy -->
    <div class="card">
      <h2>Answer Length vs Accuracy</h2>
      <p style="color:var(--color-muted);font-size:14px;margin-bottom:16px">
        Questions grouped by average answer word count. Does confidence (verbose answers) track with correctness?
      </p>
      <div id="lenChart" style="height:220px;position:relative">
        <div class="dk-bars">
          ${lenChartData.map(d => `
            <div class="dk-bar-group">
              <div class="dk-bar-wrap">
                <div class="dk-bar" style="height:${d.rate}%;background:${d.rate > 70 ? 'var(--color-green)' : d.rate > 60 ? 'var(--color-yellow)' : 'var(--color-red)'}">
                  <span class="dk-bar-pct">${d.rate.toFixed(1)}%</span>
                </div>
              </div>
              <div class="dk-bar-label">${d.label.split('\n')[0]}</div>
              <div class="dk-bar-sub">${d.total} Q · ${pct(d.resolved, d.total)} resolved</div>
            </div>
          `).join('')}
        </div>
      </div>
    </div>

    <!-- Debate count vs Accuracy -->
    <div class="card">
      <h2>Debate Depth vs Accuracy</h2>
      <p style="color:var(--color-muted);font-size:14px;margin-bottom:16px">
        Questions grouped by number of answers (back-and-forth exchanges). More debate = more likely resolved.
      </p>
      <div id="nAnsChart" style="height:220px;position:relative">
        <div class="dk-bars">
          ${nAnsChartData.map(d => `
            <div class="dk-bar-group">
              <div class="dk-bar-wrap">
                <div class="dk-bar" style="height:${d.rate}%;background:${d.rate > 80 ? 'var(--color-green)' : d.rate > 50 ? 'var(--color-yellow)' : 'var(--color-red)'}">
                  <span class="dk-bar-pct">${d.rate.toFixed(1)}%</span>
                </div>
              </div>
              <div class="dk-bar-label">${d.label}</div>
              <div class="dk-bar-sub">${d.total} Q</div>
            </div>
          `).join('')}
        </div>
      </div>
    </div>

    <!-- Interpretation card -->
    <div class="card dk-interpretation">
      <h2>What Does This Mean?</h2>
      <div class="dk-points">
        <div class="dk-point">
          <span class="dk-point-icon">📏</span>
          <div>
            <strong>Short answers correlate with low resolution.</strong>
            Questions answered in under 15 words on average resolved at just 57.7% — suggesting James often guesses quickly and wrong.
          </div>
        </div>
        <div class="dk-point">
          <span class="dk-point-icon">📚</span>
          <div>
            <strong>Long answers = higher accuracy.</strong>
            Questions with 35+ word average answer lengths resolved at 85.3%. James takes his time and gets it right.
          </div>
        </div>
        <div class="dk-point">
          <span class="dk-point-icon">🤝</span>
          <div>
            <strong>One answer is enough — usually.</strong>
            Single-answer questions resolve at 83.5%, barely different from 2-answer questions (88.1%). The first answer is often right.
          </div>
        </div>
        <div class="dk-point">
          <span class="dk-point-icon">❓</span>
          <div>
            <strong>Unanswered = unresolved.</strong> ${zeroAns.toLocaleString()} questions had zero answers in the dataset — almost none resolved. These were likely cut from air or never reached a caller.
          </div>
        </div>
      </div>
    </div>
  `
}
