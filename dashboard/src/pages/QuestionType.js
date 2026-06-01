/**
 * QuestionType.js — Question type taxonomy: why/how/what/who answered rates.
 */
import { loadJSON } from '../lib/data.js'

const BASE = './data'
function escHtml(s) { return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;') }
function pct(n, d) { return d ? `${(n/d*100).toFixed(1)}%` : '—' }

export async function renderQuestionTypePage(container, store) {
  container.innerHTML = `<div class="loading"><div class="spinner"></div>Loading...</div>`
  try {
    const qt = await loadJSON(`${BASE}/question_type_stats.json`)
    renderPage(container, qt)
  } catch (e) {
    container.innerHTML = `<div style="color:#e74c3c;padding:20px">Could not load question type data.</p>`
  }
}

function renderPage(container, qt) {
  const types = Object.entries(qt).sort((a,b) => b[1].total - a[1].total)
  const maxTotal = Math.max(...types.map(t => t[1].total))

  container.innerHTML = `
    <div class="page-header">
      <h1>❓ Question Type Taxonomy</h1>
      <p>Does James answer "why" questions as well as "what" questions? Which question types are hardest?</p>
    </div>

    <div class="card">
      <h2>Resolution Rate by Question Type</h2>
      <div style="margin-top:16px">
        ${types.map(([type, stat]) => {
          const bar = pct(stat.resolved_rate_pct, 100)
          return `<div style="margin-bottom:16px">
            <div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:4px">
              <span style="font-size:18px;font-weight:700;text-transform:lowercase">${type}</span>
              <span style="font-size:14px;color:var(--color-muted)">${stat.total.toLocaleString()} Q · ${stat.resolved_rate_pct}% resolved · ${stat.avg_answers} avg answers</span>
            </div>
            <div style="background:var(--color-surface);height:24px;border-radius:4px;overflow:hidden">
              <div style="background:var(--color-primary);height:100%;width:${bar};border-radius:4px;display:flex;align-items:center;justify-content:flex-end;padding-right:8px">
                <span style="color:white;font-size:12px;font-weight:700">${stat.resolved_rate_pct}%</span>
              </div>
            </div>
          </div>`
        }).join('')}
      </div>
    </div>

    <div class="card">
      <h2>📊 Answer Difficulty Ranking</h2>
      <p style="font-size:14px;color:var(--color-muted);margin-bottom:16px">Sorted by resolved rate (hardest first)</p>
      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:12px">
        ${types.sort((a,b) => a[1].resolved_rate_pct - b[1].resolved_rate_pct).map(([type, stat]) => `
          <div style="background:var(--color-surface);border-radius:8px;padding:16px;border:1px solid var(--color-border)">
            <div style="font-size:40px;font-weight:700;${stat.resolved_rate_pct < 70 ? 'color:var(--color-red)' : 'color:var(--color-green)'}">${stat.resolved_rate_pct}%</div>
            <div style="font-size:16px;font-weight:600;text-transform:lowercase;margin-top:4px">${type}</div>
            <div style="font-size:13px;color:var(--color-muted);margin-top:4px">${stat.total} questions</div>
          </div>
        `).join('')}
      </div>
    </div>
  `
}