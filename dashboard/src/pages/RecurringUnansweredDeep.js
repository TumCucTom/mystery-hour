/**
 * RecurringUnansweredDeep.js — "Recurring Unanswered Deep Dive"
 * Questions that have been asked multiple times across different episodes
 * and never got resolved.
 */
import { loadJSON } from '../lib/data.js'

function escHtml(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function pct(n, d) {
  return d ? `${(n/d*100).toFixed(1)}%` : '—'
}

export async function renderRecurringUnansweredDeepPage(container, store) {
  container.innerHTML = `<div class="loading"><div class="spinner"></div>Loading...</div>`
  try {
    const [deep, ru] = await Promise.all([
      loadJSON('recurring_unanswered_deep.json'),
      loadJSON('recurring_unanswered.json'),
    ])
    renderPage(container, deep, ru)
  } catch (e) {
    container.innerHTML = `<div class="loading"><div class="spinner"></div><p style="color:#e74c3c">Failed to load data.</p></div>`
    console.error(e)
  }
}

function renderPage(container, deep, ru) {
  const groups = deep.groups || []
  const summary = deep.summary || {}

  container.innerHTML = `
    <div class="page-header">
      <h1>🔁 Recurring Unanswered Deep Dive</h1>
      <p>The questions James has been asked <strong>more than once</strong> — sometimes years apart — and never resolved. The internet's greatest mysteries, live on air.</p>
    </div>

    <div class="stats-grid" style="--cols:3;margin-bottom:24px">
      <div class="stat-card">
        <div class="stat-value">${groups.length}</div>
        <div class="stat-label">Repeating Question Groups</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">${summary.total_questions_in_groups || 0}</div>
        <div class="stat-label">Total Repeated Questions</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">${summary.total_unresolved || 0}</div>
        <div class="stat-label">Total Unresolved</div>
      </div>
    </div>

    <div class="card" style="margin-bottom:24px;background:linear-gradient(135deg,#1a1a2e,#16213e);border:1px solid #0f3460">
      <div style="display:flex;align-items:center;gap:12px">
        <span style="font-size:28px">💀</span>
        <div>
          <div style="font-size:15px;font-weight:700;color:#f87171;margin-bottom:4px">The Hardest Questions in Britain</div>
          <div style="font-size:13px;color:#94a3b8">These questions stumped James <em>every single time</em>. If you know the answer, call the show.</div>
        </div>
      </div>
    </div>

    <div id="groupList"></div>
  `

  const listEl = container.querySelector('#groupList')

  function renderGroups(sortBy = 'count') {
    const sorted = [...groups]
    if (sortBy === 'count') sorted.sort((a, b) => -(a.count - b.count))
    if (sortBy === 'answers') sorted.sort((a, b) => a.avg_answers - b.avg_answers)

    listEl.innerHTML = `
      <div style="margin-bottom:16px;display:flex;gap:8px;align-items:center">
        <span style="font-size:13px;color:var(--color-muted)">Sort:</span>
        <button class="topic-tag sort-btn" data-sort="count" style="cursor:pointer">By Frequency</button>
        <button class="topic-tag sort-btn" data-sort="answers" style="cursor:pointer">By Answer Count</button>
      </div>
      <div class="ru-grid">
        ${sorted.map((g, i) => `
          <div class="ru-card card">
            <div class="ru-header">
              <div class="ru-badge">×${g.count}</div>
              <div class="ru-episodes">
                ${(g.episodes || []).map(ep => `<a href="/episodes?ep=${ep}" class="nav-link ru-ep" data-link>${ep}</a>`).join(' ')}
              </div>
            </div>
            <div class="ru-questions">
              ${(g.questions || []).map((q, qi) => `
                <div class="ru-question">
                  <div class="ru-q-text">${escHtml(q)}</div>
                  <div class="ru-q-meta">
                    ${g.episodes[qi] ? `<a href="/episodes?ep=${g.episodes[qi]}" class="nav-link" data-link>${g.episodes[qi]}</a>` : ''}
                    · avg ${g.avg_answers} answers
                  </div>
                </div>
              `).join('')}
            </div>
            ${g.topics && g.topics.length ? `
              <div class="ru-topics">${g.topics.map(([t, c]) => `<span class="topic-tag">${escHtml(t)} <span style="opacity:0.6">${c}×</span></span>`).join('')}</div>
            ` : '<div class="ru-topics" style="color:var(--color-muted);font-size:12px">No topics assigned</div>'}
          </div>
        `).join('')}
      </div>
    `

    listEl.querySelectorAll('[data-sort]').forEach(btn => {
      btn.style.opacity = btn.dataset.sort === sortBy ? '1' : '0.5'
      btn.addEventListener('click', () => renderGroups(btn.dataset.sort))
    })
    listEl.querySelectorAll('a[data-link]').forEach(a => {
      a.addEventListener('click', e => { e.preventDefault(); history.pushState(null, '', a.href); window.dispatchEvent(new PopStateEvent('popstate')) })
    })
  }

  renderGroups('count')
}
