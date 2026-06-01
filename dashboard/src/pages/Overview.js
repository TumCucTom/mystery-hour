/**
 * Overview.js — main dashboard overview page
 */
import { Chart, CategoryScale, LinearScale, BarController, BarElement, Title, Tooltip, Legend } from 'chart.js'

Chart.register(CategoryScale, LinearScale, BarController, BarElement, Title, Tooltip, Legend)

export function renderOverview(page, store) {
  const { data } = store
  const {
    nEpisodes, totalQuestions, totalAnswers, resolvedPct,
    overturnedCount, topLocations, episodeStats, ansDist, resolvedByAns,
    nClusters80, clusters
  } = data

  // Stats row
  const stats = [
    ['nEpisodes', nEpisodes, 'Episodes'],
    ['totalQuestions', totalQuestions.toLocaleString(), 'Questions'],
    ['totalAnswers', totalAnswers.toLocaleString(), 'Answers'],
    ['resolvedPct', `${resolvedPct}%`, 'Resolved'],
    ['overturnedCount', overturnedCount.toLocaleString(), 'Overturned'],
    ['nClusters80', nClusters80, 'Clusters'],
  ]

  page.innerHTML = `
    <div class="page-header">
      <h1>Mystery Hour Q&A Explorer</h1>
      <p>${nEpisodes} episodes · ${totalQuestions.toLocaleString()} questions · ${totalAnswers.toLocaleString()} answers · ${resolvedPct}% resolved</p>
    </div>

    <div class="card-grid">
      ${stats.map(([key, num, label]) => `
        <div class="stat-card" data-stat="${key}">
          <div class="stat-number">${num}</div>
          <div class="stat-label">${label}</div>
        </div>`).join('')}
    </div>

    <div class="section">
      <div class="section-title">Questions per Episode</div>
      <div class="chart-wrap">
        <canvas id="epChart" height="70"></canvas>
      </div>
    </div>

    <div class="two-col">
      <div class="section">
        <div class="section-title">Top Caller Locations</div>
        <div class="chart-wrap">
          <canvas id="locChart" height="300"></canvas>
        </div>
      </div>

      <div class="section">
        <div class="section-title">Answer Count Distribution</div>
        <div class="chart-wrap">
          <canvas id="ansChart" height="300"></canvas>
        </div>
      </div>
    </div>

    <div class="section">
      <div class="section-title">Top Topic Clusters</div>
      <div id="clusterGrid" class="cluster-grid" style="grid-template-columns: repeat(auto-fill, minmax(260px, 1fr))"></div>
    </div>
  `

  // Cluster cards
  const clusterGrid = page.querySelector('#clusterGrid')
  const topClusters = (clusters.k80 || []).slice(0, 30)
  if (clusterGrid) {
    clusterGrid.innerHTML = topClusters.map(c => `
    <div class="cluster-card" data-cluster="${c.cluster_id}">
      <div class="cluster-id">Cluster ${c.cluster_id} · ${c.size} Qs</div>
      <div class="cluster-topic">${escHtml(c.topic_label || '—')}</div>
      <div class="cluster-meta">
        <span class="badge ${c.resolved_rate > 0.7 ? 'badge-success' : 'badge-warning'}">${Math.round(c.resolved_rate*100)}% resolved</span>
        <span>avg ${c.avg_answers} answers</span>
      </div>
      <div class="cluster-kw">${(c.keywords || []).slice(0, 5).join(' · ')}</div>
    </div>
  `).join('')

    clusterGrid.addEventListener('click', e => {
    const card = e.target.closest('.cluster-card')
    if (!card) return
    const id = card.dataset.cluster
    history.pushState(null, '', `/clusters?highlight=${id}`)
    import('/src/pages/Clusters.js').then(m => m.renderClusters(document.getElementById('app'), store))
  })
  }

  // Init charts after DOM is ready
  requestAnimationFrame(() => {
    // Questions per episode chart
    const epLabels = episodeStats.map((_, i) => i)
    const epQCounts = episodeStats.map(ep => ep.n_questions)
    const epCtx = page.querySelector('#epChart')
    if (epCtx) {
      new Chart(epCtx, {
        type: 'bar',
        data: {
          labels: epLabels,
          datasets: [{
            label: 'Questions',
            data: epQCounts,
            backgroundColor: 'rgba(255,107,53,0.6)',
            borderColor: 'rgba(255,107,53,0.9)',
            borderWidth: 1,
          }]
        },
        options: {
          responsive: true,
          plugins: { legend: { display: false } },
          scales: {
            x: { title: { display: true, text: 'Episode index', color: '#8a8680' }, ticks: { display: false }, grid: { display: false } },
            y: { title: { display: true, text: 'Questions', color: '#8a8680' }, ticks: { stepSize: 1 }, grid: { color: '#3a3a3a' } }
          }
        }
      })
    }

    // Locations chart
    const topLocs = (topLocations || []).slice(0, 20)
    const locCtx = page.querySelector('#locChart')
    if (locCtx) {
      new Chart(locCtx, {
        type: 'bar',
        data: {
          labels: topLocs.map(([loc]) => loc),
          datasets: [{ label: 'Callers', data: topLocs.map(([, c]) => c), backgroundColor: 'rgba(255,107,53,0.6)', borderColor: 'rgba(255,107,53,1)', borderWidth: 1 }]
        },
        options: {
          indexAxis: 'y',
          responsive: true,
          plugins: { legend: { display: false } },
          scales: {
            x: { title: { display: true, text: 'Caller count', color: '#8a8680' }, grid: { color: '#3a3a3a' } },
            y: { grid: { display: false } }
          }
        }
      })
    }

    // Answer distribution chart
    const ansLabels = Object.keys(ansDist || {}).sort((a, b) => a - b).map(k => k === '10' ? '10+' : k)
    const ansCounts = Object.keys(ansDist || {}).sort((a, b) => a - b).map(k => ansDist[k])
    const ansCtx = page.querySelector('#ansChart')
    if (ansCtx) {
      new Chart(ansCtx, {
        type: 'bar',
        data: {
          labels: ansLabels,
          datasets: [{ label: '# Questions', data: ansCounts, backgroundColor: 'rgba(78,205,196,0.6)', borderColor: 'rgba(78,205,196,1)', borderWidth: 1 }]
        },
        options: {
          responsive: true,
          plugins: { legend: { display: false } },
          scales: {
            x: { title: { display: true, text: 'Answer count', color: '#8a8680' }, grid: { display: false } },
            y: { title: { display: true, text: 'Questions', color: '#8a8680' }, grid: { color: '#3a3a3a' } }
          }
        }
      })
    }
  })
}

function escHtml(s) {
  if (!s) return ''
  return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;')
}