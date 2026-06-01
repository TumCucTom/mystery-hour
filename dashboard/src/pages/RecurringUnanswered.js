/**
 * RecurringUnanswered.js — "The mysteries that haunt the show"
 * Questions asked multiple times across episodes but never resolved.
 */
import { loadJSON } from '../lib/data.js'

const BASE = ''
function escHtml(s) { return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;') }

export async function renderRecurringUnansweredPage(container, store) {
  container.innerHTML = `<div class="loading"><div class="spinner"></div>Loading...</div>`
  try {
    const ru = await loadJSON('recurring_unanswered.json')
    renderPage(container, ru)
  } catch (e) {
    container.innerHTML = `<div style="color:#e74c3c;padding:20px">Could not load recurring unanswered data.</div>`
  }
}

function renderPage(container, ru) {
  const s = ru.summary
  const groups = ru.recurring_groups || []

  container.innerHTML = `
    <div class="page-header">
      <h1>🌀 Recurring Unanswered Corner</h1>
      <p>The mysteries that haunt the show — questions asked multiple times across episodes, never resolved.</p>
    </div>

    <div class="stats-grid" style="--cols:3">
      <div class="stat-card"><div class="stat-value">${s.total_unresolved.toLocaleString()}</div><div class="stat-label">Total Unresolved Questions</div></div>
      <div class="stat-card"><div class="stat-value">${s.recurring_groups}</div><div class="stat-label">Recurring Groups (2+ times)</div></div>
      <div class="stat-card"><div class="stat-value">${s.total_questions_in_groups}</div><div class="stat-label">Questions in Recurring Groups</div></div>
    </div>

    <div class="card">
      <h2>🔁 Recurring Unanswered Groups</h2>
      <p style="font-size:14px;color:var(--color-muted);margin-bottom:16px">Questions that come back again and again without a definitive answer.</p>
      <div style="display:flex;flex-direction:column;gap:16px">
        ${groups.length === 0 ? '<p style="color:var(--color-muted)">No recurring unanswered groups found yet.</p>' : groups.map((g, i) => `
          <div style="background:var(--color-surface);border-radius:8px;padding:16px;border-left:4px solid var(--color-red)">
            <div style="font-size:13px;color:var(--color-muted);margin-bottom:8px">Group ${i+1} · ${g.count} occurrences · ${g.avg_answers} avg answers · ${(g.topics || []).slice(0,4).join(', ') || 'various topics'}</div>
            <div style="font-size:15px;font-weight:600;margin-bottom:8px">${escHtml(g.questions[0])}</div>
            <div style="font-size:13px;color:var(--color-muted)">
              Seen in: ${g.episodes.map(ep => `<a href="/episodes?ep=${ep}" class="nav-link" data-link>${ep}</a>`).join(', ')}
            </div>
            ${g.questions.length > 1 ? `<div style="margin-top:8px;font-size:13px;color:var(--color-muted)">Also asked: ${g.questions.slice(1).map(q => `"${escHtml(q.slice(0,80))}"`).join('; ')}</div>` : ''}
          </div>
        `).join('')}
      </div>
    </div>
  `

  container.querySelectorAll('a[data-link]').forEach(a => {
    a.addEventListener('click', e => { e.preventDefault(); history.pushState(null,'',a.href); window.dispatchEvent(new PopStateEvent('popstate')) })
  })
}