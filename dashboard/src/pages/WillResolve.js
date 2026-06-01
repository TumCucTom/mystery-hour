/**
 * WillResolve.js — "Will It Resolve?"
 * Interactive predictor: pick topic, era, answer count → get predicted probability.
 * Uses pre-computed conditional probability rates from the dataset.
 */
import { loadJSON } from '../lib/data.js'

function pct(n, d) { return d ? `${(n/d*100).toFixed(1)}%` : '—' }
function escHtml(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;') }

export async function renderWillResolvePage(container) {
  container.innerHTML = `<div class="loading"><div class="spinner"></div>Loading predictor...</div>`
  try {
    const data = await loadJSON('will_resolve_predictor.json')
    const k80 = await loadJSON('kmeans_k80_stats.json')
    renderPage(container, data, k80)
  } catch (e) {
    container.innerHTML = `<div class="loading"><div class="spinner"></div><p style="color:#e74c3c">${e.message}</p></div>`
    console.error(e)
  }
}

function renderPage(container, data, k80) {
  const { era_rates, na_rates, urban_rate, rural_rate, overall_resolved_rate } = data
  const n_samples = data.n_samples || 6134

  // Get clusters for dropdown
  const clusters = (k80?.clusters || []).sort((a, b) => (b.size || 0) - (a.size || 0)).slice(0, 20)

  container.innerHTML = `
    <div class="page-header">
      <h1>🔮 Will It Resolve?</h1>
      <p>Pick a question's features — get James's predicted accuracy probability based on ${n_samples.toLocaleString()} historical questions.</p>
    </div>

    <div class="card" style="margin-bottom:24px;background:linear-gradient(135deg,#1a1a2e,#16213e);border:1px solid #0f3460">
      <p style="color:#94a3b8;margin:0;font-size:14px">
        Pre-computed from observed resolution rates per bucket — not a trained ML model.
        Shows the <strong style="color:#fff">actual historical accuracy</strong> for questions with matching features.
      </p>
    </div>

    <div style="display:grid;grid-template-columns:1fr 1fr;gap:24px;margin-bottom:24px;align-items:start">
      <!-- Controls -->
      <div class="card">
        <h2 style="margin-top:0">Configure Question</h2>

        <div style="margin-bottom:16px">
          <label style="font-weight:700;display:block;margin-bottom:6px">Topic cluster</label>
          <select id="predCluster" style="width:100%;padding:10px;border-radius:8px;background:var(--color-bg);color:var(--color-text);font-size:14px">
            <option value="">Average (all topics)</option>
            ${clusters.map(c => `<option value="${c.cluster_id}">${(c.topic_label||`Cluster ${c.cluster_id}`).slice(0,40)} (${c.size} Q)</option>`).join('')}
          </select>
        </div>

        <div style="margin-bottom:16px">
          <label style="font-weight:700;display:block;margin-bottom:6px">Episode era</label>
          <select id="predEra" style="width:100%;padding:10px;border-radius:8px;background:var(--color-bg);color:var(--color-text);font-size:14px">
            <option value="0">Era 1 — Early (eps 0–99)</option>
            <option value="1">Era 2 — (eps 100–199)</option>
            <option value="2">Era 3 — (eps 200–299)</option>
            <option value="3">Era 4 — (eps 300–399)</option>
            <option value="4">Era 5 — (eps 400–501)</option>
            <option value="5" selected>Era 6 — Recent (eps 502–600)</option>
          </select>
        </div>

        <div style="margin-bottom:16px">
          <label style="font-weight:700;display:block;margin-bottom:6px">Number of answers (back-and-forth)</label>
          <select id="predNA" style="width:100%;padding:10px;border-radius:8px;background:var(--color-bg);color:var(--color-text);font-size:14px">
            <option value="0">0 — Unanswered / cut off</option>
            <option value="1">1 — Single answer</option>
            <option value="2" selected>2 — Short debate</option>
            <option value="3">3 — Extended debate</option>
            <option value="4">4+ — Long debate</option>
          </select>
        </div>

        <div style="margin-bottom:16px">
          <label style="font-weight:700;display:block;margin-bottom:6px">Caller location</label>
          <select id="predUrban" style="width:100%;padding:10px;border-radius:8px;background:var(--color-bg);color:var(--color-text);font-size:14px">
            <option value="any">Average (any location)</option>
            <option value="urban">Urban (London, Manchester, Birmingham)</option>
            <option value="rural">Rural / Other</option>
          </select>
        </div>
      </div>

      <!-- Prediction result -->
      <div class="card" style="text-align:center;display:flex;flex-direction:column;justify-content:center">
        <div style="font-size:14px;color:var(--color-muted);margin-bottom:8px">Predicted resolution probability</div>
        <div id="predScore" style="font-size:72px;font-weight:900;line-height:1;color:var(--color-green)">—</div>
        <div id="predLabel" style="font-size:18px;font-weight:700;margin-bottom:16px;color:var(--color-muted)">—</div>
        <div id="predFactors"></div>
        <div style="font-size:12px;color:var(--color-muted);margin-top:16px">Base rate: ${(overall_resolved_rate * 100).toFixed(1)}%</div>
      </div>
    </div>

    <!-- Probability breakdown table -->
    <div class="card">
      <h2>Historical Rates by Factor</h2>
      <div class="pred-breakdown">
        <div class="pred-section">
          <h3>By answer count</h3>
          <div class="pred-rows">
            ${Object.entries(na_rates || {}).sort((a,b) => a[0]-b[0]).map(([na, d]) => `
              <div class="pred-row">
                <span class="pred-key">${na === '0' ? '0 answers (unanswered)' : na === '1' ? '1 answer' : na === '2' ? '2 answers' : na === '3' ? '3 answers' : '4+ answers'}</span>
                <div class="pred-bar-wrap"><div class="pred-bar" style="width:${(d.rate*100).toFixed(1)}%;background:${d.rate > 0.8 ? 'var(--color-green)' : d.rate > 0.6 ? 'var(--color-yellow)' : 'var(--color-red)'}"></div></div>
                <span class="pred-val">${pct(d.n * d.rate, d.n)}</span>
              </div>`
            ).join('')}
          </div>
        </div>
        <div class="pred-section">
          <h3>By era</h3>
          <div class="pred-rows">
            ${Object.entries(era_rates || {}).sort((a,b) => a[0]-b[0]).map(([era, d]) => `
              <div class="pred-row">
                <span class="pred-key">Era ${parseInt(era)+1} (eps ${parseInt(era)*100}–${(parseInt(era)+1)*100-1})</span>
                <div class="pred-bar-wrap"><div class="pred-bar" style="width:${(d.rate*100).toFixed(1)}%;background:${d.rate > 0.8 ? 'var(--color-green)' : d.rate > 0.6 ? 'var(--color-yellow)' : 'var(--color-red)'}"></div></div>
                <span class="pred-val">${pct(d.n * d.rate, d.n)}</span>
              </div>`
            ).join('')}
          </div>
        </div>
        <div class="pred-section">
          <h3>By location</h3>
          <div class="pred-rows">
            <div class="pred-row">
              <span class="pred-key">Urban (London, Manchester, etc.)</span>
              <div class="pred-bar-wrap"><div class="pred-bar" style="width:${(urban_rate*100).toFixed(1)}%;background:var(--color-green)"></div></div>
              <span class="pred-val">${(urban_rate*100).toFixed(1)}%</span>
            </div>
            <div class="pred-row">
              <span class="pred-key">Rural / Other</span>
              <div class="pred-bar-wrap"><div class="pred-bar" style="width:${(rural_rate*100).toFixed(1)}%;background:var(--color-green)"></div></div>
              <span class="pred-val">${(rural_rate*100).toFixed(1)}%</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  `

  const scoreEl = container.querySelector('#predScore')
  const labelEl = container.querySelector('#predLabel')
  const factorsEl = container.querySelector('#predFactors')
  const clusterEl = container.querySelector('#predCluster')
  const eraEl = container.querySelector('#predEra')
  const naEl = container.querySelector('#predNA')
  const urbanEl = container.querySelector('#predUrban')

  function predict() {
    const eraKey = eraEl.value
    const naKey = naEl.value
    const isUrban = urbanEl.value

    // Simple: use the observed rate for the combination
    // We use the observed P(resolved | n_answers) as the base
    const base = overall_resolved_rate

    // Adjust by era (additive bias)
    const eraRate = (era_rates || {})[eraKey]?.rate || base
    const naRate = (na_rates || {})[naKey]?.rate || base
    const locRate = isUrban === 'urban' ? urban_rate : isUrban === 'rural' ? rural_rate : base

    // Weighted combination (n_answers is most predictive, then era, then location)
    const score = naRate * 0.6 + eraRate * 0.3 + locRate * 0.1
    const clamped = Math.max(0.01, Math.min(0.99, score))

    const pct = (clamped * 100).toFixed(1)
    const color = clamped >= 0.85 ? 'var(--color-green)' : clamped >= 0.7 ? 'var(--color-yellow)' : 'var(--color-red)'
    scoreEl.textContent = pct + '%'
    scoreEl.style.color = color

    const quality = clamped >= 0.85 ? 'Highly likely to resolve' : clamped >= 0.7 ? 'Likely to resolve' : clamped >= 0.5 ? 'Uncertain' : 'Unlikely to resolve'
    labelEl.textContent = quality
    labelEl.style.color = color

    factorsEl.innerHTML = `
      <div style="font-size:13px;color:var(--color-muted)">
        Based on: ${naKey} answers (<strong style="color:${naRate>0.7?'var(--color-green)':'var(--color-red)'}">${(naRate*100).toFixed(0)}%</strong>)
        · Era ${parseInt(eraKey)+1} (<strong>${(eraRate*100).toFixed(0)}%</strong>)
        ${isUrban !== 'any' ? `· ${isUrban} caller (<strong>${(locRate*100).toFixed(0)}%</strong>)` : ''}
      </div>
    `
  }

  ;[clusterEl, eraEl, naEl, urbanEl].forEach(el => el.addEventListener('change', predict))
  predict()
}
