/**
 * TimeToAnswer.js — "Time to Answer"
 * Histogram of how quickly James answers vs cluster type and episode era.
 * Uses n_answers as a proxy for time-to-answer (more back-and-forth = harder/longer).
 */
import { loadJSON } from '../lib/data.js'

function pct(n, d) {
  return d ? `${(n/d*100).toFixed(1)}%` : '—'
}

export async function renderTimeToAnswerPage(container, store) {
  container.innerHTML = `<div class="loading"><div class="spinner"></div>Loading answer dynamics...</div>`
  try {
    const [tta, chain] = await Promise.all([
      loadJSON('time_to_answer.json'),
      loadJSON('chain_length.json'),
    ])
    renderPage(container, tta, chain)
  } catch (e) {
    container.innerHTML = `<div class="loading"><div class="spinner"></div><p style="color:#e74c3c">Could not load data.</p></div>`
    console.error(e)
  }
}

function renderPage(container, tta, chain) {
  const nAnsBuckets = tta.by_answer_count || {}
  const eraBuckets = tta.by_episode_era || {}
  const nEps = 601
  const eraSize = Math.ceil(nEps / 6)
  const eraLabels = []
  for (let i = 0; i < 6; i++) {
    const start = i * eraSize
    const end = Math.min((i + 1) * eraSize, nEps) - 1
    eraLabels.push(`Era ${i + 1}\n(ep ${start}–${end})`)
  }

  container.innerHTML = `
    <div class="page-header">
      <h1>⏱️ Time to Answer</h1>
      <p>How many answers does a question need before it's resolved? More back-and-forth = harder question.</p>
    </div>

    <div class="card" style="background:linear-gradient(135deg,#1a1a2e,#16213e);border:1px solid #0f3460;margin-bottom:24px">
      <p style="color:#94a3b8;margin:0;font-size:14px">
        <strong style="color:#fff">Key finding:</strong> Single-answer questions resolve at <strong style="color:#4ade80">83.5%</strong> — James is usually right first time.
        Two answers push it to <strong style="color:#4ade80">88.1%</strong>. Zero answers = <strong style="color:#f87171">0.6%</strong> (never resolved — likely unasked/cut off).
      </p>
    </div>

    <!-- By answer count -->
    <div class="card">
      <h2>Resolution Rate by Answer Count</h2>
      <p style="color:var(--color-muted);font-size:14px;margin-bottom:16px">
        How many answers (back-and-forth exchanges) were needed? Shows both count and resolution rate.
      </p>
      <div id="ansChart" class="tta-chart">
        ${Object.entries(nAnsBuckets).sort((a, b) => parseInt(a[0]) - parseInt(b[0])).map(([k, v]) => {
          const rate = (v.rate || 0) * 100
          const heightPct = (v.total / 3190) * 100 // normalise to max
          const isZero = k === '0'
          return `
          <div class="tta-bar-group">
            <div class="tta-bar-rate" style="color:${rate > 80 ? 'var(--color-green)' : rate > 50 ? 'var(--color-yellow)' : 'var(--color-red)'}">${rate.toFixed(1)}%</div>
            <div class="tta-bar${isZero ? ' tta-bar-unanswered' : ''}" style="height:${Math.max(heightPct, 2)}%;background:${isZero ? '#374151' : rate > 80 ? 'var(--color-green)' : rate > 50 ? 'var(--color-yellow)' : 'var(--color-red)'}">
              <span class="tta-bar-count">${v.total.toLocaleString()}</span>
            </div>
            <div class="tta-bar-label">${k === '0' ? '0 answers' : k === '6' ? '6+ answers' : k + (k === '1' ? ' answer' : ' answers')}</div>
          </div>`
        }).join('')}
      </div>
      <div style="display:flex;gap:12px;margin-top:12px;flex-wrap:wrap">
        <div style="display:flex;align-items:center;gap:6px"><div style="width:12px;height:12px;border-radius:2px;background:var(--color-green)"></div> 80%+ resolved</div>
        <div style="display:flex;align-items:center;gap:6px"><div style="width:12px;height:12px;border-radius:2px;background:var(--color-yellow)"></div> 50–80%</div>
        <div style="display:flex;align-items:center;gap:6px"><div style="width:12px;height:12px;border-radius:2px;background:var(--color-red)"></div> &lt;50%</div>
        <div style="display:flex;align-items:center;gap:6px"><div style="width:12px;height:12px;border-radius:2px;background:#374151"></div> Unanswered (cut off)</div>
      </div>
    </div>

    <!-- By episode era -->
    <div class="card">
      <h2>Resolution Rate by Episode Era</h2>
      <p style="color:var(--color-muted);font-size:14px;margin-bottom:16px">
        Has James gotten better or worse over time? Shows accuracy trend across 601 episodes.
      </p>
      <div id="eraChart" class="tta-chart" style="height:220px">
        ${Object.entries(eraBuckets).sort((a, b) => parseInt(a[0]) - parseInt(b[0])).map(([k, v]) => {
          const era = parseInt(k)
          const rate = (v.rate || 0) * 100
          const eraLabel = eraLabels[era] || `Era ${era + 1}`
          const barH = Math.max(rate, 2)
          return `
          <div class="tta-bar-group">
            <div class="tta-bar-rate" style="color:${rate > 80 ? 'var(--color-green)' : rate > 70 ? '#fbbf24' : 'var(--color-red)'}">${rate.toFixed(1)}%</div>
            <div class="tta-bar" style="height:${barH}%;background:${rate > 80 ? 'var(--color-green)' : rate > 70 ? '#fbbf24' : 'var(--color-red)'}">
              <span class="tta-bar-count" style="font-size:10px">${v.total}</span>
            </div>
            <div class="tta-bar-label">${eraLabel.split('\n')[0]}</div>
          </div>`
        }).join('')}
      </div>
      <div style="display:flex;gap:12px;margin-top:8px;flex-wrap:wrap;color:var(--color-muted);font-size:12px">
        ${Object.entries(eraBuckets).sort((a, b) => parseInt(a[0]) - parseInt(b[0])).map(([k, v]) => {
          const era = parseInt(k)
          const label = eraLabels[era] || `Era ${era + 1}`
          return `<span>${label.split('\n')[0]}: ${v.total} Q</span>`
        }).join(' · ')}
      </div>
    </div>

    <!-- Answer chain details -->
    <div class="card">
      <h2>The Answer Chain Breakdown</h2>
      <div class="tta-insights">
        <div class="tta-insight">
          <div class="tta-insight-num">83.5%</div>
          <div class="tta-insight-text">
            <strong>First answer is usually right.</strong> Questions answered in a single exchange resolve 83.5% of the time.
            James is confident and correct more often than not.
          </div>
        </div>
        <div class="tta-insight">
          <div class="tta-insight-num">+4.6pp</div>
          <div class="tta-insight-text">
            <strong>Second answer helps a little.</strong> Two-answer questions resolve at 88.1%, suggesting the caller push-back helps refine the answer.
          </div>
        </div>
        <div class="tta-insight">
          <div class="tta-insight-num">0.6%</div>
          <div class="tta-insight-text">
            <strong>Unanswered = unresolved.</strong> 827 questions with zero answers in the data — almost all unresolved.
            These were likely caller no-shows or questions cut from air.
          </div>
        </div>
        <div class="tta-insight">
          <div class="tta-insight-num">70%</div>
          <div class="tta-insight-text">
            <strong>James has got slightly worse over time.</strong> Era 6 (recent episodes) resolves at ~70% vs 73-76% in earlier eras.
            The most recent era is notably the worst performing.
          </div>
        </div>
      </div>
    </div>
  `
}
