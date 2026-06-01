/**
 * EpFingerprintCompare.js — "Episode Fingerprint Comparison"
 * Pick two episodes and see side-by-side cluster distribution bars.
 */
import { loadJSON } from '../lib/data.js'

function escHtml(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

export async function renderEpFingerprintComparePage(container) {
  container.innerHTML = `<div class="loading"><div class="spinner"></div>Loading fingerprints...</div>`
  try {
    const [fps, allQa] = await Promise.all([
      loadJSON('episode_fingerprints_full.json'),
      loadJSON('all_qa.json'),
    ])
    renderPage(container, fps, allQa)
  } catch (e) {
    container.innerHTML = `<div class="loading"><div class="spinner"></div><p style="color:#e74c3c">${e.message}</p></div>`
    console.error(e)
  }
}

function renderPage(container, fps, allQa) {
  const eps = allQa.episodes || []
  const fingerprints = fps?.fingerprints || []
  const topPerEp = fps?.top_per_ep || []
  const fpMap = Object.fromEntries(fingerprints.map(f => [f.ep, f.dist_norm]))
  const topMap = Object.fromEntries(topPerEp.map(t => [t.ep, t.top]))

  const COLOURS = ['#f87171','#fb923c','#fbbf24','#a3e635','#34d399','#22d3ee','#60a5fa','#a78bfa','#f472b6','#e879f9','#94a3b8','#4ade80','#2dd4bf','#818cf8','#c084fc','#fb7185','#facc15','#86efac','#67e8f9','#a5b4fc']

  container.innerHTML = `
    <div class="page-header">
      <h1>🔀 Episode Fingerprint Comparison</h1>
      <p>Pick two episodes — see their topic cluster distributions side by side.</p>
    </div>

    <div class="card" style="margin-bottom:24px">
      <div style="display:grid;grid-template-columns:1fr auto 1fr;gap:16px;align-items:end">
        <div>
          <label style="font-weight:700;display:block;margin-bottom:8px">Episode A</label>
          <select id="epA" style="width:100%;padding:10px;font-size:14px;border-radius:8px;background:var(--color-bg);color:var(--color-text)">
            ${eps.map(e => `<option value="${e.episode}">${e.episode}</option>`).join('')}
          </select>
        </div>
        <div style="font-size:24px;padding-bottom:8px">↔</div>
        <div>
          <label style="font-weight:700;display:block;margin-bottom:8px">Episode B</label>
          <select id="epB" style="width:100%;padding:10px;font-size:14px;border-radius:8px;background:var(--color-bg);color:var(--color-text)">
            ${eps.map(e => `<option value="${e.episode}">${e.episode}</option>`).join('')}
          </select>
        </div>
      </div>
    </div>

    <div id="compareResult"></div>
  `

  const selectA = container.querySelector('#epA')
  const selectB = container.querySelector('#epB')
  const resultEl = container.querySelector('#compareResult')

  function compare(epA, epB) {
    const distA = fpMap[epA] || []
    const distB = fpMap[epB] || []
    const topA = (topMap[epA] || []).slice(0, 5)
    const topB = (topMap[epB] || []).slice(0, 5)
    const epA_data = eps.find(e => e.episode === epA)
    const epB_data = eps.find(e => e.episode === epB)

    const maxA = Math.max(...distA, 0.001)
    const maxB = Math.max(...distB, 0.001)
    const allCids = new Set([...topA.map(([c]), ...topB.map(([c])]).map(Number))
    const sortedCids = [...allCids].sort((a, b) => a - b)

    resultEl.innerHTML = `
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:24px;margin-bottom:24px">
        ${[{ep: epA, dist: distA, top: topA, data: epA_data, max: maxA},
           {ep: epB, dist: distB, top: topB, data: epB_data, max: maxB}].map(({ep, dist, top, data, max}) => `
          <div class="card">
            <h2>
              <a href="/episodes?ep=${ep}" class="nav-link" data-link>${ep}</a>
            </h2>
            <div style="font-size:13px;color:var(--color-muted);margin-bottom:12px">
              ${(data?.topics || []).slice(0, 4).map(t => `<span class="topic-tag">${escHtml(t)}</span>`).join('')}
            </div>
            <div class="fp-bars">
              ${sortedCids.map((cid, i) => {
                const val = dist[cid] || 0
                return `<div class="fp-bar-row" title="Cluster ${cid}: ${(val*100).toFixed(1)}%">
                  <div class="fp-bar-label" style="color:${COLOURS[cid%COLOURS.length]}">C${cid}</div>
                  <div class="fp-bar-track"><div class="fp-bar-fill" style="width:${(val/max*100).toFixed(1)}%;background:${COLOURS[cid%COLOURS.length]}"></div></div>
                  <div class="fp-bar-val">${(val*100).toFixed(1)}%</div>
                </div>`
              }).join('')}
            </div>
          </div>
        `).join('')}
      </div>
    `

    resultEl.querySelectorAll('a[data-link]').forEach(a => {
      a.addEventListener('click', e => { e.preventDefault(); history.pushState(null,'',a.href); window.dispatchEvent(new PopStateEvent('popstate')) })
    })
  }

  compare(selectA.value, selectB.value)
  selectA.addEventListener('change', () => compare(selectA.value, selectB.value))
  selectB.addEventListener('change', () => compare(selectA.value, selectB.value))
}
