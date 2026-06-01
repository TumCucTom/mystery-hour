/**
 * main.js — entry point + client-side router
 */
import './styles/global.css'
import { loadAll } from './lib/data.js'
import { renderOverview } from './pages/Overview.js'
import { renderClusters } from './pages/Clusters.js'
import { renderEpisodes } from './pages/Episodes.js'
import { renderSearch } from './pages/Search.js'
import { renderDuplicates } from './pages/Duplicates.js'
import { renderUMAP } from './pages/UMAP.js'
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

// ── Nav ───────────────────────────────────────────────────
function renderNav() {
  const path = location.pathname
  const links = [
    ['/', 'Overview'],
    ['/clusters', 'Clusters'],
    ['/episodes', 'Episodes'],
    ['/search', 'Search'],
    ['/accuracy', 'Accuracy'],
    ['/ask', 'Ask'],
    ['/topic-drift', 'Drift'],
    ['/similar', 'Similar'],
    ['/geographic', 'Map'],
    ['/answer-dynamics', 'Answers'],
    ['/question-type', 'Q Types'],
    ['/duplicates', 'Duplicates'],
    ['/umap', 'UMAP'],
    ['/seasonal', 'Seasonal'],
    ['/recurring-unanswered', 'Unanswered'],
    ['/question-quality', 'Quality'],
    ['/summaries', 'Summaries'],
    ['/ray-liotta', 'Ray Liotta'],
    ['/hall-of-fame', 'Hall of Fame'],
    ['/dunning-kruger', 'Dunning-Kruger'],
    ['/call-heatmap', 'Call Heatmap'],
    ['/caller-network', 'Caller Network'],
    ['/umap-clusters', 'Topic Universe'],
    ['/time-to-answer', 'Time to Answer'],
    ['/uk-map', 'UK Map'],
    ['/recurring-deep', 'Unanswered Deep'],
    ['/cluster-evolution', 'Evolution'],
    ['/james-says', 'James Says'],
    ['/name-generator', 'Name Gen'],
    ['/overturned-map', 'Overturned'],
    ['/topic-pairs', 'Topic Pairs'],
    ['/caller-types', 'Caller Types'],
    ['/cluster-worst', 'Worst Clusters'],
    ['/anomalies', 'Anomalies'],
    ['/unresolved-frontier', 'Unresolved'],
    ['/sentiment', 'Sentiment'],
    ['/confidence', 'Confidence'],
    ['/episode-recommender', 'Recommender'],
    ['/knn-similar', 'KNN Similar'],
    ['/ep-compare', 'EP Compare'],
    ['/umap-resolved', 'UMAP Split'],
    ['/will-resolve', 'Will It Resolve?'],
  ]
  const nav = document.createElement('nav')
  nav.className = 'nav'
  nav.innerHTML = `
    <span class="nav-logo">Mystery Hour</span>
    <button class="nav-hamburger" id="navHamburger" aria-label="Menu">
      <span></span><span></span><span></span>
    </button>
    <div class="nav-links" id="navLinks">
      ${links.map(([href, label]) =>
        `<a class="nav-link${path === href ? ' active' : ''}" href="${href}">${label}</a>`
      ).join('')}
    </div>
  `
  // Mobile hamburger toggle
  const hamburger = nav.querySelector('#navHamburger')
  const linksEl = nav.querySelector('#navLinks')
  hamburger.addEventListener('click', () => {
    linksEl.classList.toggle('open')
    hamburger.classList.toggle('active')
  })
  // Close on link click
  linksEl.addEventListener('click', e => {
    if (e.target.classList.contains('nav-link')) {
      linksEl.classList.remove('open')
      hamburger.classList.remove('active')
    }
  })
  return nav
}

// ── Router ─────────────────────────────────────────────────
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

function route() {
  const fn = routes[location.pathname] || renderOverview
  const page = document.createElement('main')
  page.className = 'page'
  fn(page, store)
  document.getElementById('app').replaceChildren(nav, page)
}

// ── Global state ───────────────────────────────────────────
const store = { data: null, loaded: false }

// ── Init ─────────────────────────────────────────────────
async function init() {
  const app = document.getElementById('app')
  app.innerHTML = `<div class="loading"><div class="spinner"></div>Loading 6,097 questions...</div>`
  nav = renderNav()

  try {
    store.data = await loadAll()
    store.loaded = true
  } catch (e) {
    app.innerHTML = `<div class="loading"><div class="spinner"></div><p style="color:#e74c3c">Failed to load data: ${e.message}</p></div>`
    console.error(e)
    return
  }

  nav = renderNav()
  document.getElementById('app').innerHTML = ''
  route()

  // Listen for navigation
  window.addEventListener('popstate', route)
}

let nav = null

// Intercept link clicks for SPA routing
document.addEventListener('click', e => {
  const a = e.target.closest('a[href^="/"]')
  if (!a) return
  e.preventDefault()
  history.pushState(null, '', a.href)
  route()
})

init()