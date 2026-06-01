/**
 * Sentiment.js — "Answer Sentiment Analysis"
 * Keyword-based sentiment scoring of James's answers. Does sentiment predict overturned?
 */
import { loadJSON } from '../lib/data.js'

function escHtml(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}
function pct(n, d) { return d ? `${(n/d*100).toFixed(1)}%` : '—' }

export async function renderSentimentPage(container) {
  container.innerHTML = `<div class="loading"><div class="spinner"></div>Loading sentiment data...</div>`
  try {
    const data = await loadJSON('sentiment.json')
    renderPage(container, data)
  } catch (e) {
    container.innerHTML = `<div class="loading"><div class="spinner"></div><p style="color:#e74c3c">${e.message}</p></div>`
    console.error(e)
  }
}

function renderPage(container, data) {
  const dist = data.sentiment_distribution || {}

  container.innerHTML = `
    <div class="page-header">
      <h1>💬 Answer Sentiment Analysis</h1>
      <p>Keyword-based sentiment of James's answers — positive, negative, or uncertain language. Does it predict accuracy?</p>
    </div>

    <div class="card" style="margin-bottom:24px;background:linear-gradient(135deg,#1a1a2e,#16213e);border:1px solid #0f3460">
      <p style="color:#94a3b8;margin:0;font-size:14px">
        Lexicon: <strong style="color:#4ade80">positive</strong> (great, correct, definitely, obviously) vs
        <strong style="color:#f87171">negative</strong> (wrong, false, doubt, probably) vs
        <strong style="color:#fbbf24">uncertain</strong> (I think, maybe, perhaps).
        A single answer can score on multiple categories.
      </p>
    </div>

    <!-- Sentiment distribution cards -->
    <div class="stats-grid" style="--cols:3;margin-bottom:24px">
      ${['positive', 'negative', 'uncertain'].map(sent => {
        const d = dist[sent] || {total:0, resolved:0, overturned:0}
        const color = sent === 'positive' ? 'var(--color-green)' : sent === 'negative' ? 'var(--color-red)' : 'var(--color-yellow)'
        return `
        <div class="stat-card">
          <div class="stat-value" style="color:${color}">${pct(d.resolved, d.total)}</div>
          <div class="stat-label" style="text-transform:capitalize">${sent} — Resolution Rate</div>
          <div style="font-size:12px;color:var(--color-muted);margin-top:4px">${d.resolved}/${d.total} resolved · ${d.overturned} overturned</div>
        </div>`
      }).join('')}
    </div>

    <!-- Bar chart of sentiment vs accuracy -->
    <div class="card" style="margin-bottom:24px">
      <h2>Sentiment vs Resolution Rate</h2>
      <div class="sent-bars">
        ${['positive', 'negative', 'uncertain'].map(sent => {
          const d = dist[sent] || {total:0, resolved:0}
          const rate = d.total ? d.resolved/d.total : 0
          const color = sent === 'positive' ? '#4ade80' : sent === 'negative' ? '#f87171' : '#fbbf24'
          return `
          <div class="sent-row">
            <div class="sent-label" style="text-transform:capitalize;font-weight:700;color:${color}">${sent}</div>
            <div class="sent-bar-outer">
              <div class="sent-bar-fill" style="width:${(rate*100).toFixed(1)}%;background:${color}"></div>
            </div>
            <div class="sent-pct">${pct(d.resolved, d.total)}</div>
            <div class="sent-count">${d.total} answers</div>
          </div>`
        }).join('')}
      </div>
    </div>
  `
}
