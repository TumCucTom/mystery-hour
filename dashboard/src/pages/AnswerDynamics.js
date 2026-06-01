/**
 * AnswerDynamics.js — Multi-answer chains and answer length analysis.
 */
import { loadJSON } from '../lib/data.js'

const BASE = ''

function escHtml(s) { return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;') }
function pct(n, d) { return d ? `${(n/d*100).toFixed(1)}%` : '—' }

export async function renderAnswerDynamicsPage(container, store) {
  container.innerHTML = `<div class="loading"><div class="spinner"></div>Loading...</div>`
  try {
    const [chains, james] = await Promise.all([
      loadJSON('answer_chains.json'),
      loadJSON('james_accuracy.json'),
    ])
    renderPage(container, chains, james)
  } catch (e) {
    container.innerHTML = `<div class="loading"><div class="spinner"></div><p style="color:#e74c3c">Could not load answer dynamics data.</p></div>`
  }
}

function renderPage(container, chains, james) {
  const s   = chains.summary
  const als = chains.answer_length_stats

  container.innerHTML = `
    <div class="page-header">
      <h1>🔄 Answer Dynamics</h1>
      <p>How many callers typically weigh in before resolution? What answer length works best?</p>
    </div>

    <!-- Key stats -->
    <div class="stats-grid" style="--cols:4">
      <div class="stat-card"><div class="stat-value">${chains.total_answers.toLocaleString()}</div><div class="stat-label">Total Answers</div></div>
      <div class="stat-card"><div class="stat-value">${s.avg_answers_per_question}</div><div class="stat-label">Avg Answers per Question</div></div>
      <div class="stat-card"><div class="stat-value">${s.pct_multi_answer}%</div><div class="stat-label">Questions with Multiple Answers</div></div>
      <div class="stat-card"><div class="stat-value" style="color:var(--color-red)">${chains.total_overturned}</div><div class="stat-label">Overturned Answers</div></div>
    </div>

    <!-- Answer length vs resolution -->
    <div class="card">
      <h2>📏 Answer Length vs Resolution Rate</h2>
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:16px;margin-top:16px">
        ${[['short', 'Short (≤50 chars)'],['medium','Medium (50-200)'],['long','Long (>200)']].map(([key, label]) => {
          const stat = als[key]
          return `<div style="background:var(--color-surface);border-radius:8px;padding:16px;text-align:center">
            <div style="font-size:32px;font-weight:700">${pct(stat.resolved, stat.count)}</div>
            <div style="font-size:14px;font-weight:600;margin-top:4px">${label}</div>
            <div style="font-size:13px;color:var(--color-muted);margin-top:4px">${stat.count.toLocaleString()} answers · ${stat.resolved} resolved</div>
            <div style="margin-top:12px;background:var(--color-primary);height:8px;border-radius:4px;width:${pct(stat.resolved, stat.count)}"></div>
          </div>`
        }).join('')}
      </div>
      <p style="margin-top:16px;font-size:13px;color:var(--color-muted)">Longer answers are strongly associated with higher resolution rates — thorough explanations work.</p>
    </div>

    <!-- Answer count distribution -->
    <div class="card">
      <h2>📊 How Many Answers Before Resolution?</h2>
      <div style="display:flex;flex-wrap:wrap;gap:8px;margin-top:12px">
        ${Object.entries(chains.answer_distribution).sort((a,b)=>Number(a[0])-Number(b[0])).slice(0,8).map(([n, data]) => `
          <div style="background:var(--color-surface);border-radius:8px;padding:12px;text-align:center;min-width:80px">
            <div style="font-size:24px;font-weight:700">${n}</div>
            <div style="font-size:12px;color:var(--color-muted)">answers</div>
            <div style="font-size:13px;margin-top:4px">${data.total.toLocaleString()} Q</div>
            <div style="font-size:12px;color:var(--color-green)">${pct(data.resolved, data.total)} resolved</div>
          </div>
        `).join('')}
      </div>
    </div>

    <!-- Longest unresolved chains -->
    <div class="card">
      <h2>🌀 Longest Unresolved Chains (never got a definitive answer)</h2>
      <div class="unresolved-list">
        ${(chains.longest_unresolved || []).slice(0, 15).map(item => `
          <div style="border-bottom:1px solid var(--color-border);padding:12px 0">
            <div style="font-size:15px;font-weight:600;margin-bottom:4px">${escHtml(item.question)}</div>
            <div style="font-size:13px;color:var(--color-muted)">
              <a href="/episodes?ep=${item.episode}" class="nav-link" data-link>${item.episode}</a>
              · ${item.n_answers} answers · ${(item.topics || []).slice(0,3).join(', ') || 'no topics'}
            </div>
          </div>
        `).join('')}
      </div>
    </div>
  `

  container.querySelectorAll('a[data-link]').forEach(a => {
    a.addEventListener('click', e => { e.preventDefault(); history.pushState(null,'',a.href); window.dispatchEvent(new PopStateEvent('popstate')) })
  })
}