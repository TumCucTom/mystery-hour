/**
 * UMAP3D.js — interactive 3D scatter of all 6,134 questions
 * Drag to rotate, scroll to zoom, right-click drag to pan.
 * Click a cluster in the legend to toggle visibility.
 */
import * as THREE from 'three'

const COLORS = [
  0x6c5ce7, 0x00b894, 0xe17055, 0x0984e3, 0xfdcb6e, 0xe84393,
  0x74b9ff, 0xa29bfe, 0x55efc4, 0xfab1a0, 0xff7675, 0xffeaa7,
  0xdfe6e9, 0x63b3ed, 0x9fd36a, 0xf0a6c8, 0x48dbfb, 0xff9ff3,
  0xfeca57, 0x5f27cd, 0x01a3a4, 0xff6b6b, 0xc8d6e5, 0x222f3e,
  0x341f97, 0x0abde3, 0x10ac84, 0xee5a24, 0xf36817, 0x0fbcf9,
  0x00d2d3, 0xff9f43, 0x54a0ff, 0x2e86de, 0xc44569, 0x576574,
  0x1e272e, 0x8344a4, 0xa855f7, 0xd946ef, 0x0ea5e9, 0x22c55e,
  0xeab308, 0xef4444, 0x84cc16, 0x06b6d4, 0xfb7185, 0xfbbf24,
  0x34d399, 0xa78bfa, 0xf472b6, 0x60a5fa,
]

export async function renderUMAP3D(page, store) {
  page.innerHTML = `
    <div class="page-header">
      <h1>🌐 Question Universe (3D)</h1>
      <p>6,134 questions projected to 3D using UMAP. Drag to rotate, scroll to zoom — colour = topic cluster.</p>
    </div>

    <div id="umap-legend" style="display:flex;flex-wrap:wrap;gap:6px;padding:10px 0;border-bottom:1px solid var(--color-border);margin-bottom:12px;max-height:140px;overflow-y:auto"></div>

    <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-bottom:12px;font-size:12px;color:var(--color-muted)">
      <span><strong style="color:var(--color-text)">Drag</strong> rotate</span> ·
      <span><strong style="color:var(--color-text)">Scroll</strong> zoom</span> ·
      <span><strong style="color:var(--color-text)">Right-drag</strong> pan</span> ·
      <span><strong style="color:var(--color-text)">Hover</strong> a point for the question</span>
      <span style="margin-left:auto" id="umapStats"></span>
    </div>

    <div id="three-wrap" style="position:relative;height:75vh;min-height:520px;background:linear-gradient(180deg,#0b1020 0%,#0f172a 100%);border:1px solid var(--color-border);border-radius:10px;overflow:hidden">
      <canvas id="threeCanvas" style="display:block;width:100%;height:100%;cursor:grab"></canvas>
      <div id="threeTooltip" style="position:absolute;background:rgba(15,23,42,0.95);color:#f1f5f9;border:1px solid #334155;border-radius:6px;padding:8px 10px;font-size:12px;max-width:340px;pointer-events:none;display:none;z-index:10;box-shadow:0 6px 24px rgba(0,0,0,0.5)"></div>
    </div>
  `

  const res = await fetch('/data/umap_3d.json')
  const { coords, labels, cluster_labels } = await res.json()
  const meta = await (await fetch('/data/question_meta.json')).json()

  // Compute bounds to normalise and centre
  let minX = Infinity, minY = Infinity, minZ = Infinity
  let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity
  for (const [x, y, z] of coords) {
    if (x < minX) minX = x; if (x > maxX) maxX = x
    if (y < minY) minY = y; if (y > maxY) maxY = y
    if (z < minZ) minZ = z; if (z > maxZ) maxZ = z
  }
  const cx = (minX + maxX) / 2, cy = (minY + maxY) / 2, cz = (minZ + maxZ) / 2
  const span = Math.max(maxX - minX, maxY - minY, maxZ - minZ) || 1
  const scale = 50 / span
  const pos = new Float32Array(coords.length * 3)
  for (let i = 0; i < coords.length; i++) {
    pos[i * 3]     = (coords[i][0] - cx) * scale
    pos[i * 3 + 1] = (coords[i][1] - cy) * scale
    pos[i * 3 + 2] = (coords[i][2] - cz) * scale
  }

  // Group points by cluster
  const byCluster = {}
  for (let i = 0; i < labels.length; i++) {
    const c = labels[i]
    if (!byCluster[c]) byCluster[c] = []
    byCluster[c].push(i)
  }
  const clusterIds = Object.keys(byCluster).map(Number).sort((a, b) => a - b)

  const wrap = page.querySelector('#three-wrap')
  const canvas = page.querySelector('#threeCanvas')
  const tooltip = page.querySelector('#threeTooltip')

  // Try to build the WebGL scene. If WebGL is unavailable (e.g. headless
  // test browser), fall back to a clear message — but still show the legend
  // and stats so the page remains useful.
  let renderer = null
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true })
  } catch (e) {
    console.warn('WebGL unavailable, falling back to message:', e?.message || e)
  }

  let clusterObjs = []
  if (renderer) {
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))

    const scene = new THREE.Scene()
    scene.background = null
    scene.fog = new THREE.Fog(0x0f172a, 60, 140)

    const camera = new THREE.PerspectiveCamera(55, 1, 0.1, 500)
    camera.position.set(0, 0, 70)

    scene.add(new THREE.AmbientLight(0xffffff, 0.65))
    const dir = new THREE.DirectionalLight(0xffffff, 0.8)
    dir.position.set(40, 60, 80)
    scene.add(dir)

    // Build one Points object per cluster so we can toggle them
    for (const cid of clusterIds) {
      const indices = byCluster[cid]
      const positions = new Float32Array(indices.length * 3)
      for (let j = 0; j < indices.length; j++) {
        const i = indices[j]
        positions[j * 3]     = pos[i * 3]
        positions[j * 3 + 1] = pos[i * 3 + 1]
        positions[j * 3 + 2] = pos[i * 3 + 2]
      }
      const color = COLORS[Math.abs(cid) % COLORS.length]
      const geom = new THREE.BufferGeometry()
      geom.setAttribute('position', new THREE.BufferAttribute(positions, 3))
      const mat = new THREE.PointsMaterial({
        color,
        size: 0.55,
        sizeAttenuation: true,
        transparent: true,
        opacity: 0.85,
        depthWrite: false,
      })
      const points = new THREE.Points(geom, mat)
      points.userData = { cid, indices, color }
      scene.add(points)
      clusterObjs.push(points)
    }

    // Subtle axes
    const axisGeom = new THREE.BufferGeometry()
    axisGeom.setAttribute('position', new THREE.Float32BufferAttribute([
      -25, 0, 0,  25, 0, 0,
      0, -25, 0,  0, 25, 0,
      0, 0, -25,  0, 0, 25,
    ], 3))
    const axisMat = new THREE.LineBasicMaterial({ color: 0x334155, transparent: true, opacity: 0.5 })
    scene.add(new THREE.LineSegments(axisGeom, axisMat))

    // Manual orbit controls (no extra dep)
    const target = new THREE.Vector3(0, 0, 0)
    const spherical = new THREE.Spherical(70, Math.PI / 2, 0)
    function applyCam() {
      const v = new THREE.Vector3().setFromSpherical(spherical).add(target)
      camera.position.copy(v)
      camera.lookAt(target)
    }
    applyCam()

    function resize() {
      const w = wrap.clientWidth, h = wrap.clientHeight
      renderer.setSize(w, h, false)
      camera.aspect = w / h
      camera.updateProjectionMatrix()
    }
    resize()
    window.addEventListener('resize', resize)

    let dragging = false, panning = false, lx = 0, ly = 0
    canvas.addEventListener('mousedown', e => {
      dragging = !e.shiftKey && e.button === 0
      panning = e.button === 2 || e.shiftKey
      lx = e.clientX; ly = e.clientY
      canvas.style.cursor = panning ? 'move' : 'grabbing'
    })
    window.addEventListener('mousemove', e => {
      if (!dragging && !panning) return
      const dx = e.clientX - lx, dy = e.clientY - ly
      lx = e.clientX; ly = e.clientY
      if (dragging) {
        spherical.theta -= dx * 0.006
        spherical.phi   -= dy * 0.006
        spherical.phi = Math.max(0.05, Math.min(Math.PI - 0.05, spherical.phi))
      } else {
        const right = new THREE.Vector3().setFromMatrixColumn(camera.matrix, 0).multiplyScalar(-dx * 0.05)
        const up    = new THREE.Vector3().setFromMatrixColumn(camera.matrix, 1).multiplyScalar( dy * 0.05)
        target.add(right).add(up)
      }
      applyCam()
    })
    window.addEventListener('mouseup', () => { dragging = false; panning = false; canvas.style.cursor = 'grab' })
    canvas.addEventListener('contextmenu', e => e.preventDefault())
    canvas.addEventListener('wheel', e => {
      e.preventDefault()
      spherical.radius *= 1 + e.deltaY * 0.001
      spherical.radius = Math.max(15, Math.min(200, spherical.radius))
      applyCam()
    }, { passive: false })

    // Touch support
    let touchDist = null
    canvas.addEventListener('touchstart', e => {
      if (e.touches.length === 1) { dragging = true; lx = e.touches[0].clientX; ly = e.touches[0].clientY }
      if (e.touches.length === 2) {
        const dx = e.touches[0].clientX - e.touches[1].clientX
        const dy = e.touches[0].clientY - e.touches[1].clientY
        touchDist = Math.hypot(dx, dy)
      }
    }, { passive: true })
    canvas.addEventListener('touchmove', e => {
      if (dragging && e.touches.length === 1) {
        const dx = e.touches[0].clientX - lx, dy = e.touches[0].clientY - ly
        lx = e.touches[0].clientX; ly = e.touches[0].clientY
        spherical.theta -= dx * 0.006
        spherical.phi   -= dy * 0.006
        spherical.phi = Math.max(0.05, Math.min(Math.PI - 0.05, spherical.phi))
        applyCam()
      }
      if (touchDist != null && e.touches.length === 2) {
        const dx = e.touches[0].clientX - e.touches[1].clientX
        const dy = e.touches[0].clientY - e.touches[1].clientY
        const d = Math.hypot(dx, dy)
        spherical.radius *= touchDist / d
        spherical.radius = Math.max(15, Math.min(200, spherical.radius))
        touchDist = d
        applyCam()
      }
    }, { passive: true })
    canvas.addEventListener('touchend', () => { dragging = false; touchDist = null })

    // Raycaster for hover tooltip
    const raycaster = new THREE.Raycaster()
    raycaster.params.Points.threshold = 0.6
    const mouse = new THREE.Vector2()
    let hoverIdx = -1
    canvas.addEventListener('mousemove', e => {
      if (dragging || panning) return
      const rect = canvas.getBoundingClientRect()
      mouse.x = ((e.clientX - rect.left) / rect.width)  * 2 - 1
      mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1
      raycaster.setFromCamera(mouse, camera)
      const hits = raycaster.intersectObjects(clusterObjs, false)
      if (hits.length) {
        const obj = hits[0].object
        const pt = hits[0].index
        const qi = obj.userData.indices[pt]
        const m = meta[qi] || {}
        const topic = cluster_labels[String(obj.userData.cid)] || `Cluster ${obj.userData.cid}`
        tooltip.innerHTML = `
          <div style="font-size:10px;letter-spacing:0.06em;text-transform:uppercase;color:${'#' + obj.userData.color.toString(16).padStart(6, '0')};margin-bottom:4px">${escHtml(topic)}</div>
          <div style="font-weight:600;line-height:1.4;margin-bottom:4px">${escHtml((m.question || '').slice(0, 200))}</div>
          <div style="font-size:11px;color:#94a3b8">${escHtml(m.episode || '')} · ${escHtml(m.caller || '')}</div>
        `
        tooltip.style.display = 'block'
        tooltip.style.left = (e.clientX - rect.left + 12) + 'px'
        tooltip.style.top  = (e.clientY - rect.top + 12) + 'px'
        hoverIdx = qi
        canvas.style.cursor = 'pointer'
      } else {
        tooltip.style.display = 'none'
        hoverIdx = -1
        canvas.style.cursor = 'grab'
      }
    })
    canvas.addEventListener('mouseleave', () => { tooltip.style.display = 'none' })

    // Animate
    let lastT = performance.now()
    function animate() {
      const now = performance.now()
      const dt = (now - lastT) / 1000
      lastT = now
      if (!dragging && !panning && hoverIdx === -1) spherical.theta += dt * 0.04
      applyCam()
      renderer.render(scene, camera)
      requestAnimationFrame(animate)
    }
    animate()
  } else {
    // No WebGL — show a clear fallback message inside the wrap
    wrap.innerHTML = `
      <div style="position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;color:#94a3b8;padding:24px;text-align:center">
        <div style="font-size:48px;margin-bottom:12px">🌐</div>
        <div style="font-size:18px;font-weight:600;color:#f1f5f9;margin-bottom:6px">WebGL not available in this browser</div>
        <div style="font-size:13px;max-width:480px">The 3D view needs WebGL — try a real Chrome, Safari, Firefox or Edge. The cluster legend below is built from the same data, so you can still see the topic distribution.</div>
      </div>
    `
  }

  // Build legend (works regardless of WebGL — uses cluster count data)
  const legend = page.querySelector('#umap-legend')
  for (const cid of clusterIds) {
    const indices = byCluster[cid]
    const topic = cluster_labels[String(cid)] || `Cluster ${cid}`
    const count = indices.length
    const color = COLORS[Math.abs(cid) % COLORS.length]
    const colorHex = '#' + color.toString(16).padStart(6, '0')
    const item = document.createElement('span')
    item.className = 'legend-item'
    item.style.cssText = `font-size:11px;padding:3px 8px;border-radius:4px;cursor:${renderer ? 'pointer' : 'default'};background:${colorHex}33;border:1px solid ${colorHex};color:#f1f5f9`
    item.innerHTML = `<span style="opacity:0.7">[${cid}]</span> ${escHtml(topic.slice(0, 32))} <span style="opacity:0.5">· ${count}</span>`
    if (renderer) {
      const obj = clusterObjs.find(o => o.userData.cid === cid)
      if (obj) {
        item.addEventListener('click', () => {
          obj.visible = !obj.visible
          item.style.opacity = obj.visible ? '1' : '0.35'
        })
      }
    }
    legend.appendChild(item)
  }

  page.querySelector('#umapStats').innerHTML =
    `<strong style="color:var(--color-text)">${coords.length.toLocaleString()}</strong> questions · <strong style="color:var(--color-text)">${clusterIds.length}</strong> clusters`
}

function escHtml(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}
