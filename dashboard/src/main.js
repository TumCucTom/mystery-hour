/**
 * main.js — entry point + client-side router + sidebar nav
 */
import './styles/global.css'
import { loadAll } from './lib/data.js'
import { renderOverview } from './pages/Overview.js'
import { renderClusters } from './pages/Clusters.js'
import { renderEpisodes } from './pages/Episodes.js'
import { renderSearch } from './pages/Search.js'
import { renderDuplicates } from './pages/Duplicates.js'
import { renderUMAP } from './pages/UMAP.js'
import { renderUMAP3D } from './pages/UMAP3D.js'
import { renderAccuracyPage } from './pages/Accuracy.js'
import { renderSemanticSearch } from './pages/SemanticSearch.js'
import { renderTopicDriftPage } from './pages/TopicDrift.js'
import { renderEpisodeSimilarityPage } from './pages/EpisodeSimilarity.js'
import { renderGeographicPage } from './pages/Geographic.js'
import { renderAnswerDynamicsPage } from './pages/AnswerDynamics.js'
import { renderQuestionTypePage } from './pages/QuestionType.js'
import { renderRecurringUnansweredPage } from './pages/RecurringUnanswered.js'
import { renderSeasonalPage } from './pages/Seasonal.js'
import { renderQuestionQualityPage } from './pages/QuestionQuality.js'
import { renderEpisodeSummariesPage } from './pages/EpisodeSummaries.js'
import { renderRayLiottaPage } from './pages/RayLiotta.js'
import { renderHallOfFamePage } from './pages/HallOfFame.js'
import { renderDunningKrugerPage } from './pages/DunningKruger.js'
import { renderCallHeatmapPage } from './pages/CallHeatmap.js'
import { renderCallerNetworkPage } from './pages/CallerNetwork.js'
import { renderUMAPClustersPage } from './pages/UMAPClusters.js'
import { renderTimeToAnswerPage } from './pages/TimeToAnswer.js'
import { renderUKMapPage } from './pages/UKMap.js'
import { renderRecurringUnansweredDeepPage } from './pages/RecurringUnansweredDeep.js'
import { renderClusterEvolutionPage } from './pages/ClusterEvolution.js'
import { renderJamesSaysNextPage } from './pages/JamesSaysNext.js'
import { renderCallerNameGeneratorPage } from './pages/CallerNameGenerator.js'
import { renderOverturnedMapPage } from './pages/OverturnedMap.js'
import { renderTopicPairsPage } from './pages/TopicPairs.js'
import { renderCallerTypesPage } from './pages/CallerTypes.js'
import { renderClusterWorstPage } from './pages/ClusterWorst.js'
import { renderAnomaliesPage } from './pages/Anomalies.js'
import { renderUnresolvedFrontierPage } from './pages/UnresolvedFrontier.js'
import { renderSentimentPage } from './pages/Sentiment.js'
import { renderConfidencePage } from './pages/Confidence.js'
import { renderEpisodeRecommenderPage } from './pages/EpisodeRecommender.js'
import { renderKNNSimilarPage } from './pages/KNNSimilar.js'
import { renderEpFingerprintComparePage } from './pages/EpFingerprintCompare.js'
import { renderUMAPResolvedPage } from './pages/UMAPResolved.js'
import { renderWillResolvePage } from './pages/WillResolve.js'

// ── Nav config: groups of pages ─────────────────────────
const NAV_SECTIONS = [
  {
    label: 'Home',
    icon: '🏠',
    links: [
      { href: '/', label: 'Overview', description: 'Dashboard home' },
    ],
  },
  {
    label: 'Topics',
    icon: '🧭',
    links: [
      { href: '/clusters', label: 'Clusters', description: '80 topic groups' },
      { href: '/topic-drift', label: 'Topic Drift', description: 'How topics evolve' },
      { href: '/topic-pairs', label: 'Topic Pairs', description: 'Co-occurrence matrix' },
      { href: '/call-heatmap', label: 'Call Heatmap', description: 'Topics × era' },
      { href: '/cluster-evolution', label: 'Evolution', description: 'Cluster over time' },
      { href: '/umap-clusters', label: 'Topic Universe', description: 'UMAP of all questions' },
      { href: '/umap-3d', label: '3D Universe', description: 'Rotatable 3D scatter' },
      { href: '/umap', label: 'UMAP', description: 'Raw UMAP projection' },
      { href: '/umap-resolved', label: 'UMAP Resolved', description: 'Resolved vs unresolved' },
    ],
  },
  {
    label: 'Episodes',
    icon: '🎬',
    links: [
      { href: '/episodes', label: 'Episodes', description: 'All 601 episodes' },
      { href: '/summaries', label: 'Summaries', description: 'Episode recaps' },
      { href: '/ray-liotta', label: 'Ray Liotta', description: 'Best of the worst' },
      { href: '/hall-of-fame', label: 'Hall of Fame', description: 'Top episodes' },
      { href: '/episode-recommender', label: 'Recommender', description: 'Find similar eps' },
      { href: '/ep-compare', label: 'Compare', description: 'Side-by-side eps' },
    ],
  },
  {
    label: 'Callers',
    icon: '📞',
    links: [
      { href: '/geographic', label: 'Geographic', description: 'Where callers are' },
      { href: '/uk-map', label: 'UK Map', description: 'Heatmap by town' },
      { href: '/caller-types', label: 'Caller Types', description: 'Cluster by topic' },
      { href: '/caller-network', label: 'Caller Network', description: 'Who calls together' },
      { href: '/name-generator', label: 'Name Gen', description: 'Generate fake callers' },
    ],
  },
  {
    label: 'Questions',
    icon: '❓',
    links: [
      { href: '/search', label: 'Search', description: 'Keyword search' },
      { href: '/ask', label: 'Ask', description: 'Find similar Q&As' },
      { href: '/similar', label: 'Similar Episodes', description: 'Cosine sim' },
      { href: '/knn-similar', label: 'KNN Similar', description: 'Nearest neighbours' },
      { href: '/question-quality', label: 'Quality', description: 'Best Qs ranked' },
      { href: '/question-type', label: 'Q Types', description: 'Category breakdown' },
      { href: '/duplicates', label: 'Duplicates', description: 'Repeated Qs' },
      { href: '/recurring-unanswered', label: 'Unanswered', description: 'Recurring fails' },
      { href: '/recurring-deep', label: 'Unanswered Deep', description: 'Deep dive' },
    ],
  },
  {
    label: 'James & Accuracy',
    icon: '🎯',
    links: [
      { href: '/accuracy', label: 'Accuracy', description: 'Resolution rate' },
      { href: '/answer-dynamics', label: 'Answers', description: 'How answers unfold' },
      { href: '/time-to-answer', label: 'Time to Answer', description: 'Back-and-forth length' },
      { href: '/confidence', label: 'Confidence', description: 'Hedging vs definitive' },
      { href: '/sentiment', label: 'Sentiment', description: 'Tone of answers' },
      { href: '/dunning-kruger', label: 'Dunning-Kruger', description: 'Calibration curve' },
      { href: '/james-says', label: 'James Says', description: 'Predict the next call' },
    ],
  },
  {
    label: 'Anomalies',
    icon: '🌀',
    links: [
      { href: '/anomalies', label: 'Anomalies', description: 'Outlier questions' },
      { href: '/cluster-worst', label: 'Worst Clusters', description: 'James\'s weakest' },
      { href: '/unresolved-frontier', label: 'Unresolved', description: 'Never-resolved topics' },
      { href: '/overturned-map', label: 'Overturned', description: 'Wrong answers' },
      { href: '/seasonal', label: 'Seasonal', description: 'Time patterns' },
      { href: '/will-resolve', label: 'Will It Resolve?', description: 'Predict outcome' },
    ],
  },
]

// Flat list for search
const ALL_LINKS = NAV_SECTIONS.flatMap(s =>
  s.links.map(l => ({ ...l, section: s.label, icon: s.icon }))
)

const ROUTE_LABELS = Object.fromEntries(
  NAV_SECTIONS.flatMap(s => s.links.map(l => [l.href, l.label]))
)

// ── Routes ───────────────────────────────────────────────
const routes = {
  '/': renderOverview,
  '/clusters': renderClusters,
  '/episodes': renderEpisodes,
  '/search': renderSearch,
  '/accuracy': renderAccuracyPage,
  '/ask': renderSemanticSearch,
  '/topic-drift': renderTopicDriftPage,
  '/similar': renderEpisodeSimilarityPage,
  '/geographic': renderGeographicPage,
  '/answer-dynamics': renderAnswerDynamicsPage,
  '/question-type': renderQuestionTypePage,
  '/duplicates': renderDuplicates,
  '/umap': renderUMAP,
  '/umap-3d': renderUMAP3D,
  '/seasonal': renderSeasonalPage,
  '/recurring-unanswered': renderRecurringUnansweredPage,
  '/question-quality': renderQuestionQualityPage,
  '/summaries': renderEpisodeSummariesPage,
  '/ray-liotta': renderRayLiottaPage,
  '/hall-of-fame': renderHallOfFamePage,
  '/dunning-kruger': renderDunningKrugerPage,
  '/call-heatmap': renderCallHeatmapPage,
  '/caller-network': renderCallerNetworkPage,
  '/umap-clusters': renderUMAPClustersPage,
  '/time-to-answer': renderTimeToAnswerPage,
  '/uk-map': renderUKMapPage,
  '/recurring-deep': renderRecurringUnansweredDeepPage,
  '/cluster-evolution': renderClusterEvolutionPage,
  '/james-says': renderJamesSaysNextPage,
  '/name-generator': renderCallerNameGeneratorPage,
  '/overturned-map': renderOverturnedMapPage,
  '/topic-pairs': renderTopicPairsPage,
  '/caller-types': renderCallerTypesPage,
  '/cluster-worst': renderClusterWorstPage,
  '/anomalies': renderAnomaliesPage,
  '/unresolved-frontier': renderUnresolvedFrontierPage,
  '/sentiment': renderSentimentPage,
  '/confidence': renderConfidencePage,
  '/episode-recommender': renderEpisodeRecommenderPage,
  '/knn-similar': renderKNNSimilarPage,
  '/ep-compare': renderEpFingerprintComparePage,
  '/umap-resolved': renderUMAPResolvedPage,
  '/will-resolve': renderWillResolvePage,
}

// ── Shell render ─────────────────────────────────────────
function renderShell() {
  const path = location.pathname
  const currentSection = NAV_SECTIONS.find(s =>
    s.links.some(l => l.href === path)
  )

  return `
    <div class="app-shell">
      <header class="topbar">
        <button class="topbar-menu" id="sidebarToggle" aria-label="Toggle menu">
          <span></span><span></span><span></span>
        </button>
        <a href="/" class="topbar-logo" data-link>
          <span class="topbar-logo-icon">🕵️</span>
          <span class="topbar-logo-text">Mystery Hour</span>
          <span class="topbar-logo-sub">Q&amp;A Explorer</span>
        </a>
        <div class="topbar-search">
          <span class="topbar-search-icon">🔍</span>
          <input type="text" id="quickJump" placeholder="Jump to a page…" autocomplete="off" />
          <span class="topbar-search-hint">${navigator.platform.includes('Mac') ? '⌘K' : 'Ctrl+K'}</span>
        </div>
        <div class="topbar-stats">
          <span class="topbar-stat"><strong>${store.data?.nEpisodes || 0}</strong> eps</span>
          <span class="topbar-stat"><strong>${(store.data?.totalQuestions || 0).toLocaleString()}</strong> Qs</span>
        </div>
      </header>

      <aside class="sidebar" id="sidebar">
        <nav class="sidebar-nav">
          ${NAV_SECTIONS.map(section => `
            <div class="sidebar-section${currentSection?.label === section.label ? ' active-section' : ''}">
              <div class="sidebar-section-label">
                <span class="sidebar-section-icon">${section.icon}</span>
                <span>${section.label}</span>
              </div>
              <ul class="sidebar-links">
                ${section.links.map(link => `
                  <li>
                    <a href="${link.href}"
                       class="sidebar-link${path === link.href ? ' active' : ''}"
                       data-link
                       title="${link.description || link.label}">
                      <span class="sidebar-link-label">${link.label}</span>
                    </a>
                  </li>
                `).join('')}
              </ul>
            </div>
          `).join('')}
        </nav>
      </aside>

      <main class="content" id="content"></main>
    </div>
  `
}

// ── Quick jump (search) ──────────────────────────────────
function setupQuickJump() {
  const input = document.getElementById('quickJump')
  if (!input) return
  let dropdown = null
  let selectedIdx = 0

  function close() {
    if (dropdown) { dropdown.remove(); dropdown = null }
    selectedIdx = 0
  }

  function open(results) {
    close()
    dropdown = document.createElement('div')
    dropdown.className = 'quick-jump-dropdown'
    dropdown.innerHTML = results.map((r, i) => `
      <a href="${r.href}" class="quick-jump-item${i === 0 ? ' selected' : ''}" data-link data-idx="${i}">
        <span class="quick-jump-icon">${r.icon}</span>
        <span class="quick-jump-section">${r.section}</span>
        <span class="quick-jump-label">${r.label}</span>
        <span class="quick-jump-desc">${r.description || ''}</span>
      </a>
    `).join('')
    input.parentElement.appendChild(dropdown)

    dropdown.querySelectorAll('a').forEach(a => {
      a.addEventListener('click', e => {
        e.preventDefault()
        history.pushState(null, '', a.href)
        close()
        input.value = ''
        route()
      })
    })
  }

  function search(q) {
    if (!q || q.length < 1) { close(); return }
    const ql = q.toLowerCase()
    const results = ALL_LINKS
      .filter(l =>
        l.label.toLowerCase().includes(ql) ||
        (l.description || '').toLowerCase().includes(ql) ||
        l.section.toLowerCase().includes(ql)
      )
      .slice(0, 8)
    if (results.length) open(results)
    else close()
  }

  input.addEventListener('input', e => search(e.target.value.trim()))
  input.addEventListener('focus', e => { if (e.target.value.trim()) search(e.target.value.trim()) })
  input.addEventListener('blur', () => setTimeout(close, 150))
  input.addEventListener('keydown', e => {
    if (!dropdown) return
    const items = dropdown.querySelectorAll('a')
    if (e.key === 'ArrowDown') { e.preventDefault(); selectedIdx = Math.min(selectedIdx + 1, items.length - 1) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); selectedIdx = Math.max(selectedIdx - 1, 0) }
    else if (e.key === 'Enter') { e.preventDefault(); items[selectedIdx]?.click() }
    else if (e.key === 'Escape') { close(); input.blur() }
    items.forEach((el, i) => el.classList.toggle('selected', i === selectedIdx))
    items[selectedIdx]?.scrollIntoView({ block: 'nearest' })
  })

  // Global ⌘K / Ctrl+K
  document.addEventListener('keydown', e => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
      e.preventDefault()
      input.focus()
      input.select()
    }
  })
}

// ── Sidebar toggle (mobile) ──────────────────────────────
function setupSidebarToggle() {
  const toggle = document.getElementById('sidebarToggle')
  const sidebar = document.getElementById('sidebar')
  if (!toggle || !sidebar) return
  toggle.addEventListener('click', () => {
    sidebar.classList.toggle('open')
    toggle.classList.toggle('active')
  })
  // Close on link click (mobile)
  sidebar.querySelectorAll('a[data-link]').forEach(a => {
    a.addEventListener('click', () => {
      sidebar.classList.remove('open')
      toggle.classList.remove('active')
    })
  })
}

// ── Router ───────────────────────────────────────────────
function route() {
  const fn = routes[location.pathname] || renderOverview
  const content = document.getElementById('content')
  if (!content) return
  content.innerHTML = ''
  const page = document.createElement('div')
  page.className = 'page'
  fn(page, store)
  content.appendChild(page)
  window.scrollTo(0, 0)
  // Refresh active link
  document.querySelectorAll('.sidebar-link').forEach(a => {
    a.classList.toggle('active', a.getAttribute('href') === location.pathname)
  })
}

// ── Global state ─────────────────────────────────────────
const store = { data: null, loaded: false }

// ── Init ─────────────────────────────────────────────────
async function init() {
  const app = document.getElementById('app')
  app.innerHTML = `<div class="loading-shell"><div class="spinner"></div><p>Loading 6,097 questions…</p></div>`

  try {
    store.data = await loadAll()
    store.loaded = true
  } catch (e) {
    app.innerHTML = `<div class="loading-shell"><div class="spinner"></div><p style="color:var(--danger)">Failed to load data: ${e.message}</p></div>`
    console.error(e)
    return
  }

  app.innerHTML = renderShell()
  setupSidebarToggle()
  setupQuickJump()
  route()

  window.addEventListener('popstate', route)
}

// Intercept link clicks for SPA routing
document.addEventListener('click', e => {
  const a = e.target.closest('a[href^="/"]')
  if (!a) return
  e.preventDefault()
  history.pushState(null, '', a.href)
  route()
})

init()
