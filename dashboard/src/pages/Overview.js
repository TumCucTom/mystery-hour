/**
 * Overview.js — hub home page
 * Hero stats + 6 large tiles, one per subject area, each linking to top pages.
 */
import { Chart, CategoryScale, LinearScale, BarController, BarElement, Title, Tooltip, Legend } from 'chart.js'

Chart.register(CategoryScale, LinearScale, BarController, BarElement, Title, Tooltip, Legend)

const HOME_TILES = [
  {
    section: 'Topics',
    icon: '🧭',
    blurb: 'What questions are about — clusters, drift, co-occurrence, UMAP.',
    color: '#6c5ce7',
    pages: [
      { href: '/clusters', label: '80 Topic Clusters', desc: 'Browse k-means groups' },
      { href: '/topic-drift', label: 'Topic Drift', desc: 'How themes evolve' },
      { href: '/topic-pairs', label: 'Topic Pairs', desc: 'Co-occurrence matrix' },
      { href: '/umap-clusters', label: 'Topic Universe', desc: 'All Qs in 2D' },
    ],
  },
  {
    section: 'Episodes',
    icon: '🎬',
    blurb: 'Explore individual shows — best, worst, most similar.',
    color: '#e74c3c',
    pages: [
      { href: '/episodes', label: 'All 601 Episodes', desc: 'Browse the catalogue' },
      { href: '/hall-of-fame', label: 'Hall of Fame', desc: 'Top-rated episodes' },
      { href: '/ray-liotta', label: 'Ray Liotta', desc: 'Best of the worst' },
      { href: '/episode-recommender', label: 'Recommender', desc: 'Find similar eps' },
    ],
  },
  {
    section: 'Callers',
    icon: '📞',
    blurb: 'Who calls in, where they are, what they ask about.',
    color: '#2ecc71',
    pages: [
      { href: '/uk-map', label: 'UK Heatmap', desc: 'Caller geography' },
      { href: '/caller-types', label: 'Caller Types', desc: 'Cluster by topic' },
      { href: '/caller-network', label: 'Caller Network', desc: 'Who calls together' },
      { href: '/name-generator', label: 'Name Gen', desc: 'Make fake callers' },
    ],
  },
  {
    section: 'Questions',
    icon: '❓',
    blurb: 'Search, similarity, quality, and recurring themes.',
    color: '#f39c12',
    pages: [
      { href: '/search', label: 'Search', desc: 'Keyword search' },
      { href: '/ask', label: 'Ask the Dataset', desc: 'Find similar Q&As' },
      { href: '/knn-similar', label: 'KNN Similar', desc: 'Nearest neighbours' },
      { href: '/question-quality', label: 'Quality', desc: 'Best Qs ranked' },
    ],
  },
  {
    section: 'James & Accuracy',
    icon: '🎯',
    blurb: 'How often James is right, how confident he sounds, how answers unfold.',
    color: '#00b894',
    pages: [
      { href: '/accuracy', label: 'Accuracy', desc: 'Resolution rate' },
      { href: '/time-to-answer', label: 'Time to Answer', desc: 'Back-and-forth length' },
      { href: '/confidence', label: 'Confidence', desc: 'Hedging vs definitive' },
      { href: '/dunning-kruger', label: 'Dunning-Kruger', desc: 'Calibration curve' },
    ],
  },
  {
    section: 'Anomalies',
    icon: '🌀',
    blurb: 'Outliers, never-resolved topics, patterns and predictions.',
    color: '#e84393',
    pages: [
      { href: '/anomalies', label: 'Anomalies', desc: 'Outlier questions' },
      { href: '/unresolved-frontier', label: 'Unresolved', desc: 'Never-resolved topics' },
      { href: '/overturned-map', label: 'Overturned', desc: 'Wrong answers' },
      { href: '/will-resolve', label: 'Will It Resolve?', desc: 'Predict outcome' },
    ],
  },
]

export function renderOverview(page, store) {
  const d = store.data
  const stats = [
    { num: d.nEpisodes, label: 'Episodes' },
    { num: (d.totalQuestions || 0).toLocaleString(), label: 'Questions' },
    { num: (d.totalAnswers || 0).toLocaleString(), label: 'Answers' },
    { num: `${d.resolvedPct}%`, label: 'Resolved' },
    { num: (d.overturnedCount || 0).toLocaleString(), label: 'Overturned' },
    { num: d.nClusters80, label: 'Clusters' },
  ]

  page.innerHTML = `
    <section class="home-hero">
      <div class="home-hero-text">
        <h1>Welcome to the Mystery Hour Q&amp;A Explorer</h1>
        <p>An interactive look at 6,097 questions, 9,049 answers, and 20+ years of James's
        attempts to explain the world from a BBC radio phone-in.</p>
        <div class="home-hero-stats">
          ${stats.map(s => `
            <div class="home-stat">
              <div class="home-stat-num">${s.num}</div>
              <div class="home-stat-label">${s.label}</div>
            </div>
          `).join('')}
        </div>
      </div>
      <div class="home-hero-chart">
        <canvas id="epChart" height="180"></canvas>
      </div>
    </section>

    <h2 class="home-section-title">Explore by subject</h2>
    <p class="home-section-blurb">Six angles on the same 601 episodes. Pick wherever your curiosity lands.</p>

    <div class="home-tile-grid">
      ${HOME_TILES.map(tile => `
        <div class="home-tile" style="--tile-accent: ${tile.color}">
          <div class="home-tile-header">
            <div class="home-tile-icon">${tile.icon}</div>
            <div class="home-tile-title">
              <h3>${tile.section}</h3>
              <p>${tile.blurb}</p>
            </div>
          </div>
          <ul class="home-tile-pages">
            ${tile.pages.map(p => `
              <li>
                <a href="${p.href}" class="home-tile-link" data-link>
                  <span class="home-tile-link-arrow">→</span>
                  <span class="home-tile-link-body">
                    <span class="home-tile-link-label">${p.label}</span>
                    <span class="home-tile-link-desc">${p.desc}</span>
                  </span>
                </a>
              </li>
            `).join('')}
          </ul>
        </div>
      `).join('')}
    </div>
  `

  // Mini chart: questions per episode
  requestAnimationFrame(() => {
    const ctx = page.querySelector('#epChart')
    if (!ctx) return
    const epStats = d.episodeStats || []
    new Chart(ctx, {
      type: 'bar',
      data: {
        labels: epStats.map((_, i) => i),
        datasets: [{
          label: 'Questions per episode',
          data: epStats.map(ep => ep.n_questions),
          backgroundColor: 'rgba(108, 92, 231, 0.7)',
          borderColor: 'rgba(108, 92, 231, 1)',
          borderWidth: 0,
          borderRadius: 2,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false }, tooltip: { enabled: false } },
        scales: {
          x: { display: false },
          y: { display: false },
        },
      },
    })
  })
}
