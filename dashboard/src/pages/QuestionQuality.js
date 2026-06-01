/**
 * QuestionQuality.js — Question interest/difficulty/novelty scores.
 * Shows distribution of question quality dimensions.
 */
import { loadJSON } from '../lib/data.js'

const BASE = './data'
function escHtml(s) { return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;') }
function pct(n, d) { return d ? `${(n/d*100).toFixed(1)}%` : '—' }

export async function renderQuestionQualityPage(container, store) {
  container.innerHTML = `<div class="loading"><div class="spinner"></div>Loading question quality data...</div>`
  try {
    const qqs = await loadJSON(`${BASE}/question_quality_scores.json`)
    renderPage(container, qqs)
  } catch (e) {
    // Show placeholder if file not yet generated
    container.innerHTML = `
      <div class="page-header">
        <h1>⭐ Question Quality</h1>
        <p>Each question rated on Interest, Difficulty, and Novelty (1-5 scale).</p>
      </div>
      <div class="card" style="text-align:center;padding:48px">
        <div style="font-size:48px;margin-bottom:16px">⏳</div>
        <div style="font-size:18px;font-weight:600;margin-bottom:8px">Question quality scores not yet generated</div>
        <div style="font-size:14px;color:var(--color-muted)">Run <code>question_quality_scorer.py</code> with MiniMax API key to generate <code>question_quality_scores.json</code></div>
      </div>
    `
  }
}

function renderPage(container, qqs) {
  const scores = qqs.scores || []
  const s = qqs.summary || {}

  const dist = (key, lo, hi) => scores.filter(r => r[key] >= lo && r[key] <= hi).length
  const total = scores.length || 1

  container.innerHTML = `
    <div class="page-header">
      <h1>⭐ Question Quality</h1>
      <p>Each question rated on Interest, Difficulty, and Novelty (1–5) by LLM analysis of ${scores.length.toLocaleString()} questions.</p>
    </div>

    <div class="stats-grid" style="--cols:3">
      <div class="stat-card"><div class="stat-value">${s.avg_interest || '?'}</div><div class="stat-label">Avg Interest (1-5)</div></div>
      <div class="stat-card"><div class="stat-value">${s.avg_difficulty || '?'}</div><div class="stat-label">Avg Difficulty (1-5)</div></div>
      <div class="stat-card"><div class="stat-value">${s.avg_novelty || '?'}</div><div class="stat-label">Avg Novelty (1-5)</div></div>
    </div>

    <div class="card">
      <h2>📊 Score Distributions</h2>
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:24px;margin-top:16px">
        ${[['interest','Interest'],['difficulty','Difficulty'],['novelty','Novelty']].map(([key, label]) => `
          <div>
            <h3 style="font-size:14px;text-transform:uppercase;letter-spacing:1px;color:var(--color-muted);margin-bottom:12px">${label}</h3>
            ${[[1,'Low'], [2,'Fair'], [3,'Medium'], [4,'High'], [5,'Very High']].map(([score, desc]) => {
              const cnt = scores.filter(r => r[key] === score).length
              const bar = pct(cnt, total)
              return `<div style="margin-bottom:8px">
                <div style="display:flex;justify-content:space-between;font-size:13px;margin-bottom:2px">
                  <span>${score} — ${desc}</span><span style="color:var(--color-muted)">${cnt.toLocaleString()} (${bar})</span>
                </div>
                <div style="background:var(--color-surface);height:12px;border-radius:4px;overflow:hidden">
                  <div style="background:var(--color-primary);height:100%;width:${bar};border-radius:4px"></div>
                </div>
              </div>`
            }).join('')}
          </div>
        `).join('')}
      </div>
    </div>

    <div class="card">
      <h2>🔥 Most Interesting Questions</h2>
      <div style="display:flex;flex-direction:column;gap:12px;margin-top:12px">
        ${scores.filter(r => r.interest === 5).slice(0, 10).map(r => `
          <div style="background:var(--color-surface);border-radius:8px;padding:12px">
            <div style="display:flex;gap:8px;align-items:center;margin-bottom:8px">
              <span style="background:var(--color-primary);color:white;padding:2px 8px;border-radius:4px;font-size:12px">⭐⭐⭐⭐⭐</span>
              <a href="/episodes?ep=${r.episode}" class="nav-link" data-link>${r.episode}</a>
            </div>
            <div style="font-size:15px">${escHtml(r.question || '(no question)')}</div>
          </div>
        `).join('')}
      </div>
    </div>
  `

  container.querySelectorAll('a[data-link]').forEach(a => {
    a.addEventListener('click', e => { e.preventDefault(); history.pushState(null,'',a.href); window.dispatchEvent(new PopStateEvent('popstate')) })
  })
}