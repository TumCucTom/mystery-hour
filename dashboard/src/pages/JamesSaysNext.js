/**
 * JamesSaysNext.js — "What Does James Say Next?"
 * N-gram analysis of James's answer openings and which phrases predict accuracy.
 */
import { loadJSON } from '../lib/data.js'

function escHtml(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function pct(n, d) {
  return d ? `${(n/d*100).toFixed(1)}%` : '—'
}

export async function renderJamesSaysNextPage(container, store) {
  container.innerHTML = `<div class="loading"><div class="spinner"></div>Loading phrase analysis...</div>`
  try {
    const data = await loadJSON('james_phrases.json')
    renderPage(container, data)
  } catch (e) {
    container.innerHTML = `<div class="loading"><div class="spinner"></div><p style="color:#e74c3c">Could not load data.</p></div>`
    console.error(e)
  }
}

function renderPage(container, data) {
  const { hedging_phrases, definitive_phrases, all_phrases, first_words } = data

  const hedging = (hedging_phrases || []).filter(p => p.total >= 3)
  const definitive = (definitive_phrases || []).filter(p => p.total >= 3)
  const all = (all_phrases || []).filter(p => p.total >= 5)
  const words = (first_words || []).filter(w => w.total >= 5)

  container.innerHTML = `
    <div class="page-header">
      <h1>💬 What Does James Say Next?</h1>
      <p>How James opens his answers — and whether it predicts whether he's right.</p>
    </div>

    <div class="card" style="margin-bottom:24px;background:linear-gradient(135deg,#1a1a2e,#16213e);border:1px solid #0f3460">
      <p style="color:#94a3b8;margin:0;font-size:14px">
        <strong style="color:#fbbf24">"it's"</strong> is James's #1 opening word (246 answers).
        Definitive phrases like <strong style="color:#4ade80">"the reason"</strong> and <strong style="color:#4ade80">"it's because"</strong>
        have near-perfect accuracy. Hedging phrases like <strong style="color:#f87171">"I think"</strong> are less reliable — but still 80%!
      </p>
    </div>

    <!-- First word chart -->
    <div class="card" style="margin-bottom:24px">
      <h2>First Word Accuracy</h2>
      <p style="color:var(--color-muted);font-size:13px;margin-bottom:16px">Which word James uses to start — sorted by frequency. Longer bar = higher accuracy.</p>
      <div class="phrase-chart">
        ${words.slice(0, 20).map(w => {
          const rate = w.rate || 0
          const color = rate >= 0.8 ? 'var(--color-green)' : rate >= 0.6 ? 'var(--color-yellow)' : 'var(--color-red)'
          return `
          <div class="phrase-row">
            <div class="phrase-word">"${escHtml(w.word)}"</div>
            <div class="phrase-bar-wrap">
              <div class="phrase-bar" style="width:${(rate * 100).toFixed(1)}%;background:${color}"></div>
            </div>
            <div class="phrase-stats">
              <span class="phrase-rate" style="color:${color}">${(rate * 100).toFixed(0)}%</span>
              <span class="phrase-count">${w.total}×</span>
            </div>
          </div>`
        }).join('')}
      </div>
    </div>

    <!-- Definitive phrases -->
    <div class="card" style="margin-bottom:24px;border-left:4px solid #4ade80">
      <h2>✅ Definitive Phrases (High Accuracy)</h2>
      <p style="color:var(--color-muted);font-size:13px;margin-bottom:12px">Phrases that sound confident — and usually are.</p>
      <div class="phrase-grid">
        ${definitive.slice(0, 12).map(p => `
          <div class="phrase-card" style="border-left-color:#4ade80">
            <div class="phrase-card-rate" style="color:#4ade80">${(p.rate*100).toFixed(0)}%</div>
            <div class="phrase-card-text">"${escHtml(p.phrase)}"</div>
            <div class="phrase-card-meta">${p.resolved}/${p.total} resolved</div>
          </div>
        `).join('')}
      </div>
    </div>

    <!-- Hedging phrases -->
    <div class="card" style="margin-bottom:24px;border-left:4px solid #fbbf24">
      <h2>🤔 Hedging Phrases (Lower Accuracy)</h2>
      <p style="color:var(--color-muted);font-size:13px;margin-bottom:12px">When James hedges his bets… he's usually still right, but less so.</p>
      <div class="phrase-grid">
        ${hedging.slice(0, 12).map(p => `
          <div class="phrase-card" style="border-left-color:#fbbf24">
            <div class="phrase-card-rate" style="color:#fbbf24">${(p.rate*100).toFixed(0)}%</div>
            <div class="phrase-card-text">"${escHtml(p.phrase)}"</div>
            <div class="phrase-card-meta">${p.resolved}/${p.total} resolved</div>
          </div>
        `).join('')}
      </div>
    </div>

    <!-- All phrases ranked -->
    <div class="card">
      <h2>All Significant Phrases</h2>
      <input type="text" id="phraseSearch" placeholder="Filter phrases…" style="margin-bottom:12px;padding:8px;border-radius:6px;border:1px solid var(--color-border);width:100%;max-width:300px;background:var(--color-bg);color:var(--color-text)">
      <div class="phrase-chart" id="phraseList">
        ${all.slice(0, 30).map(p => {
          const rate = p.rate || 0
          const color = rate >= 0.8 ? 'var(--color-green)' : rate >= 0.6 ? 'var(--color-yellow)' : 'var(--color-red)'
          return `
          <div class="phrase-row">
            <div class="phrase-word">"${escHtml(p.phrase)}"</div>
            <div class="phrase-bar-wrap">
              <div class="phrase-bar" style="width:${(rate * 100).toFixed(1)}%;background:${color}"></div>
            </div>
            <div class="phrase-stats">
              <span class="phrase-rate" style="color:${color}">${(rate * 100).toFixed(0)}%</span>
              <span class="phrase-count">${p.total}×</span>
            </div>
          </div>`
        }).join('')}
      </div>
    </div>
  `

  const searchEl = container.querySelector('#phraseSearch')
  const listEl = container.querySelector('#phraseList')

  searchEl.addEventListener('input', () => {
    const q = searchEl.value.toLowerCase()
    const filtered = q ? all.filter(p => p.phrase.includes(q)) : all.slice(0, 30)
    listEl.innerHTML = filtered.map(p => {
      const rate = p.rate || 0
      const color = rate >= 0.8 ? 'var(--color-green)' : rate >= 0.6 ? 'var(--color-yellow)' : 'var(--color-red)'
      return `
      <div class="phrase-row">
        <div class="phrase-word">"${escHtml(p.phrase)}"</div>
        <div class="phrase-bar-wrap">
          <div class="phrase-bar" style="width:${(rate * 100).toFixed(1)}%;background:${color}"></div>
        </div>
        <div class="phrase-stats">
          <span class="phrase-rate" style="color:${color}">${(rate * 100).toFixed(0)}%</span>
          <span class="phrase-count">${p.total}×</span>
        </div>
      </div>`
    }).join('')
  })
}
