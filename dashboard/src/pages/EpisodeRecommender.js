/**
 * EpisodeRecommender.js — "Episode Recommender"
 * Given an episode, find the 3 most similar episodes using UMAP centroid cosine similarity.
 */
import { loadJSON } from '../lib/data.js'
import { loadAll } from '../lib/data.js'

function escHtml(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

export async function renderEpisodeRecommenderPage(container, store) {
  container.innerHTML = `<div class="loading"><div class="spinner"></div>Loading recommendations...</div>`
  try {
    const [recs, allQa] = await Promise.all([
      loadJSON('episode_recommender.json'),
      loadJSON('all_qa.json'),
    ])
    renderPage(container, recs, allQa)
  } catch (e) {
    container.innerHTML = `<div class="loading"><div class="spinner"></div><p style="color:#e74c3c">${e.message}</p></div>`
    console.error(e)
  }
}

function renderPage(container, recs, allQa) {
  const eps = allQa.episodes || []
  const epMap = Object.fromEntries(eps.map(e => [e.episode, e]))
  const epList = eps.map(e => e.episode)

  container.innerHTML = `
    <div class="page-header">
      <h1>🎬 Episode Recommender</h1>
      <p>Pick an episode — find the 3 most similar episodes by UMAP centroid cosine similarity.</p>
    </div>

    <div class="card" style="margin-bottom:24px">
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:24px;align-items:start">
        <div>
          <label for="epSelect" style="font-weight:700;display:block;margin-bottom:8px">Select episode:</label>
          <select id="epSelect" style="width:100%;padding:10px;font-size:14px;border-radius:8px;background:var(--color-bg);color:var(--color-text)">
            ${epList.map(ep => `<option value="${ep}">${ep}</option>`).join('')}
          </select>
        </div>
        <div id="epPreview" style="font-size:13px;color:var(--color-muted);padding-top:28px">
          ${eps[0] ? (eps[0].topics||[]).slice(0,4).map(t => `<span class="topic-tag">${escHtml(t)}</span>`).join('') : ''}
        </div>
      </div>
    </div>

    <div id="recResults"></div>
  `

  const selectEl = container.querySelector('#epSelect')
  const previewEl = container.querySelector('#epPreview')
  const resultsEl = container.querySelector('#recResults')

  function showRecs(epId) {
    const recList = (recs && recs[epId]) ? recs[epId] : []
    const ep = epMap[epId]
    const topics = (ep?.topics || []).slice(0, 6)
    const questions = (ep?.questions || []).slice(0, 3)

    resultsEl.innerHTML = `
      <div class="card" style="margin-bottom:16px">
        <div style="display:flex;align-items:center;gap:12px;margin-bottom:12px">
          <h2 style="margin:0">📍 ${epId}</h2>
          ${topics.map(t => `<span class="topic-tag">${escHtml(t)}</span>`).join('')}
        </div>
        <div style="font-size:13px">
          ${questions.map(q => `
            <div style="padding:6px 0;border-bottom:1px solid var(--color-border);font-size:13px;color:var(--color-muted)">
              ${escHtml((q.question||'').slice(0,120))}…
            </div>
          `).join('')}
        </div>
      </div>

      <h2 style="margin-bottom:12px">🎯 Top 3 Similar Episodes</h2>
      ${recList.map((r, i) => {
        const rep = epMap[r.ep]
        const rtopics = (rep?.topics || []).slice(0, 4)
        return `
        <div class="rec-card card">
          <div class="rec-rank">#${i+1}</div>
          <div class="rec-info">
            <div style="font-weight:700;font-size:16px;margin-bottom:6px">
              <a href="/episodes?ep=${r.ep}" class="nav-link" data-link>${r.ep}</a>
              <span style="font-size:13px;color:var(--color-muted)">${r.n_q} questions</span>
            </div>
            <div style="display:flex;flex-wrap:wrap;gap:4px;margin-bottom:6px">${rtopics.map(t => `<span class="topic-tag">${escHtml(t)}</span>`).join('')}</div>
          </div>
          <div class="rec-sim">${(r.sim * 100).toFixed(1)}%</div>
        </div>`
      }).join('')}
    `

    previewEl.innerHTML = topics.map(t => `<span class="topic-tag">${escHtml(t)}</span>`).join('') || '—'

    resultsEl.querySelectorAll('a[data-link]').forEach(a => {
      a.addEventListener('click', e => { e.preventDefault(); history.pushState(null,'',a.href); window.dispatchEvent(new PopStateEvent('popstate')) })
    })
  }

  showRecs(selectEl.value)
  selectEl.addEventListener('change', () => showRecs(selectEl.value))
}
