/**
 * EpisodeSimilarity.js — find similar episodes by Q&A topic profile.
 * Uses episode_fingerprints.json (cluster distribution per episode)
 * and computes cosine similarity between episode fingerprints.
 */
import { loadJSON } from '../lib/data.js'

const BASE = '/data'

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
    const fpData = await loadJSON('episode_fingerprints.json')
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
      <h1>Episode Similarity</h1>
      <p>Find episodes with similar Q&amp;A topic profiles. Type or pick an episode to see its most similar neighbours.</p>
    </div>

    <div class="card" style="margin-bottom:24px">
      <div style="display:grid;grid-template-columns:1fr 220px;gap:16px;align-items:end">
        <div>
          <label for="epSearch" style="font-weight:600;margin-bottom:8px;display:block">Episode</label>
          <input type="text" id="epSearch" autocomplete="off" placeholder="Type ep_ number or pick below…"
            style="width:100%;padding:10px;font-size:15px;border-radius:8px;background:var(--color-bg);border:1px solid var(--color-border);color:var(--color-text);box-sizing:border-box">
          <select id="epSelect" size="6"
            style="width:100%;margin-top:8px;padding:6px;font-size:14px;border-radius:8px;background:var(--color-bg);border:1px solid var(--color-border);color:var(--color-text);display:none">
          </select>
        </div>
        <div>
          <label for="simThreshold" style="font-weight:600;margin-bottom:8px;display:block">Min similarity: <span id="thresholdLabel">0%</span></label>
          <input type="range" id="simThreshold" min="0" max="100" value="0" step="5" style="width:100%">
        </div>
      </div>
    </div>

    <div id="simResults"></div>
  `

  const searchEl = container.querySelector('#epSearch')
  const selectEl = container.querySelector('#epSelect')
  const thresholdEl = container.querySelector('#simThreshold')
  const thresholdLabelEl = container.querySelector('#thresholdLabel')
  const resultsEl = container.querySelector('#simResults')

  let currentEp = episodes[0]

  function rebuildOptions(filter) {
    const f = (filter || '').toLowerCase()
    const matches = episodes.filter(ep => !f || ep.toLowerCase().includes(f))
    selectEl.innerHTML = matches.slice(0, 50).map(ep => `<option value="${ep}">${ep}</option>`).join('')
    selectEl.style.display = matches.length && filter ? 'block' : 'none'
  }

  function showSimilar(epId) {
    const dist = epDist[epId]
    if (!dist) return
    currentEp = epId

    const minSim = parseInt(thresholdEl.value, 10) / 100

    // Compute similarity to all other episodes
    const all = episodes
      .filter(ep => ep !== epId)
      .map(ep => ({ ep, sim: cosineSim(dist, epDist[ep]) }))
      .sort((a, b) => b.sim - a.sim)

    const scored = all.filter(s => s.sim >= minSim).slice(0, 12)

    resultsEl.innerHTML = `
      <div class="card">
        <h2>Most similar episodes to <a href="/episodes?ep=${epId}" class="nav-link" data-link>${epId}</a></h2>
        ${scored.length ? `
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
        ` : `<p style="color:var(--color-muted);text-align:center;padding:24px">No episodes ≥${(minSim*100).toFixed(0)}% similar. Lower the threshold or pick another episode.</p>`}
      </div>
    `
  }

  searchEl.value = currentEp
  rebuildOptions('')

  searchEl.addEventListener('input', () => {
    rebuildOptions(searchEl.value.trim())
    const exact = episodes.find(ep => ep === searchEl.value.trim())
    if (exact) showSimilar(exact)
  })
  selectEl.addEventListener('change', () => {
    searchEl.value = selectEl.value
    selectEl.style.display = 'none'
    showSimilar(selectEl.value)
  })
  thresholdEl.addEventListener('input', () => {
    thresholdLabelEl.textContent = `${thresholdEl.value}%`
    showSimilar(currentEp)
  })

  showSimilar(currentEp)
}