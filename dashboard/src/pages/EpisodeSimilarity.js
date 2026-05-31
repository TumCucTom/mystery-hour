/**
 * EpisodeSimilarity.js — find similar episodes by Q&A topic profile.
 * Uses episode_fingerprints.json (cluster distribution per episode)
 * and computes cosine similarity between episode fingerprints.
 */
import { loadJSON } from '../lib/data.js'

const BASE = './data'

function escHtml(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function cosineSim(a, b) {
  let dot = 0, na = 0, nb = 0
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i]
    na  += a[i] * a[i]
    nb  += b[i] * b[i]
  }
  return dot / (Math.sqrt(na) * Math.sqrt(nb) + 1e-10)
}

export async function renderEpisodeSimilarityPage(container, store) {
  container.innerHTML = `<div class="loading"><div class="spinner"></div>Loading episode fingerprints...</div>`
  try {
    const fpData = await loadJSON(`${BASE}/episode_fingerprints.json`)
    renderPage(container, fpData)
  } catch (e) {
    container.innerHTML = `<div class="loading"><div class="spinner"></div><p style="color:#e74c3c">Could not load fingerprint data.</p></div>`
    console.error(e)
  }
}

function renderPage(container, fpData) {
  const fps = fpData.fingerprints || []

  // Build a map: episode -> distribution
  const epDist = {}
  for (const fp of fps) {
    epDist[fp.episode] = fp.distribution || new Array(80).fill(0)
  }
  const episodes = fps.map(f => f.episode)

  container.innerHTML = `
    <div class="page-header">
      <h1>🔗 Episode Similarity</h1>
      <p>Find episodes with similar Q&amp;A topic profiles. Select an episode to see its most similar neighbours.</p>
    </div>

    <div class="card" style="margin-bottom:24px">
      <label for="epSelect" style="font-weight:600;margin-bottom:8px;display:block">Select an episode:</label>
      <select id="epSelect" style="width:100%;padding:10px;font-size:15px;border-radius:8px;background:var(--color-bg);border:1px solid var(--color-border);color:var(--color-text)">
        ${episodes.map(ep => `<option value="${ep}">${ep}</option>`).join('')}
      </select>
    </div>

    <div id="simResults"></div>
  `

  const selectEl = container.querySelector('#epSelect')
  const resultsEl = container.querySelector('#simResults')

  function showSimilar(epId) {
    const dist = epDist[epId]
    if (!dist) return

    // Compute similarity to all other episodes
    const scored = episodes
      .filter(ep => ep !== epId)
      .map(ep => ({ ep, sim: cosineSim(dist, epDist[ep]) }))
      .sort((a, b) => b.sim - a.sim)
      .slice(0, 12)

    resultsEl.innerHTML = `
      <div class="card">
        <h2>Most similar episodes to <a href="/episodes?ep=${epId}" class="nav-link" data-link>${epId}</a></h2>
        <div class="sim-grid">
          ${scored.map((s, i) => `
            <div class="sim-card">
              <div class="sim-rank">#${i + 1}</div>
              <div class="sim-info">
                <div class="sim-ep">
                  <a href="/episodes?ep=${s.ep}" class="nav-link" data-link>${s.ep}</a>
                </div>
                <div class="sim-bar-wrap">
                  <div class="sim-bar" style="width:${(s.sim * 100).toFixed(1)}%"></div>
                </div>
                <div class="sim-score">${(s.sim * 100).toFixed(1)}% similar</div>
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    `

    resultsEl.querySelectorAll('a[data-link]').forEach(a => {
      a.addEventListener('click', e => {
        e.preventDefault()
        history.pushState(null, '', a.href)
        window.dispatchEvent(new PopStateEvent('popstate'))
      })
    })
  }

  showSimilar(selectEl.value)
  selectEl.addEventListener('change', () => showSimilar(selectEl.value))
}