import { forceSimulation, forceCenter, forceCollide, forceManyBody, forceLink, type SimulationNodeDatum, type SimulationLinkDatum } from 'd3-force'
import { select } from 'd3-selection'
import { drag } from 'd3-drag'

interface RingMember extends SimulationNodeDatum {
  slug: string
  name: string
  url: string
  city?: string
  type: string
}

interface RingLink extends SimulationLinkDatum<RingMember> {
  source: number
  target: number
}

function displayDomain(url: string): string {
  return url.replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/$/, '')
}

function buildLinks(members: RingMember[]): RingLink[] {
  const n = members.length
  const links: RingLink[] = []

  // Adjacent ring links only (prev/next)
  for (let i = 0; i < n; i++) {
    links.push({ source: i, target: (i + 1) % n })
  }

  return links
}

function init() {
  const container = document.getElementById('ring-viz')
  const dataEl = document.getElementById('ring-data')
  if (!container || !dataEl) return

  const members: RingMember[] = JSON.parse(dataEl.textContent ?? '[]')
  if (!members.length) return

  // Dimensions
  const width = 400
  const height = 400
  const pad = 80
  const cx = width / 2
  const cy = height / 2
  const totalW = width + pad * 2
  const totalH = height + pad * 2
  const defaultZoom = 0.8
  const spread = 150
  const nodeR = 5
  const driftAlpha = 0.006

  // Deterministic pseudo-random so the layout is stable per-session but not uniform
  function hashSlug(slug: string): number {
    let h = 2166136261
    for (let i = 0; i < slug.length; i++) {
      h ^= slug.charCodeAt(i)
      h = Math.imul(h, 16777619)
    }
    return ((h >>> 0) % 10000) / 10000
  }

  // Initial positions: randomized jitter around center
  members.forEach((m) => {
    const r = hashSlug(m.slug) * spread
    const a = hashSlug(m.slug + '#a') * Math.PI * 2
    m.x = cx + Math.cos(a) * r
    m.y = cy + Math.sin(a) * r
  })

  // Build mesh links
  const linkData = buildLinks(members)

  // Viewbox pan/zoom state
  let vw = totalW / defaultZoom
  let vh = totalH / defaultZoom
  let vx = cx - vw / 2
  let vy = cy - vh / 2
  const vx0 = vx
  const vy0 = vy
  const vw0 = vw
  const vh0 = vh
  const zoomStep = 0.2
  const minZoom = 0.4
  const maxZoom = 3

  function applyViewBox() {
    svg.attr('viewBox', `${vx} ${vy} ${vw} ${vh}`)
  }

  // Animated viewBox transition
  let viewBoxAnimFrame = 0

  function animateViewBox(tx: number, ty: number, tw: number, th: number, duration = 300) {
    if (viewBoxAnimFrame) cancelAnimationFrame(viewBoxAnimFrame)
    const sx = vx, sy = vy, sw = vw, sh = vh
    const t0 = performance.now()

    function step(now: number) {
      const p = Math.min((now - t0) / duration, 1)
      const e = p * (2 - p) // ease-out quad
      vx = sx + (tx - sx) * e
      vy = sy + (ty - sy) * e
      vw = sw + (tw - sw) * e
      vh = sh + (th - sh) * e
      applyViewBox()
      if (p < 1) viewBoxAnimFrame = requestAnimationFrame(step)
      else viewBoxAnimFrame = 0
    }

    viewBoxAnimFrame = requestAnimationFrame(step)
  }

  function focusOnMember(slug: string) {
    const member = members.find(m => m.slug === slug)
    if (!member || member.x == null || member.y == null) return

    const focusZoom = 1.6
    let fw = totalW / focusZoom
    let fh = totalH / focusZoom
    const baseAspect = vw0 / vh0
    if (fw / fh > baseAspect) fh = fw / baseAspect
    else fw = fh * baseAspect

    const fx = Math.max(-pad, Math.min(totalW - fw - pad, member.x - fw / 2))
    const fy = Math.max(-pad, Math.min(totalH - fh - pad, member.y - fh / 2))
    animateViewBox(fx, fy, fw, fh)
  }

  function zoom(direction: 1 | -1) {
    if (viewBoxAnimFrame) { cancelAnimationFrame(viewBoxAnimFrame); viewBoxAnimFrame = 0 }
    const factor = 1 + zoomStep * direction
    const newW = Math.max(totalW / maxZoom, Math.min(totalW / minZoom, vw * factor))
    const newH = Math.max(totalH / maxZoom, Math.min(totalH / minZoom, vh * factor))
    // Keep center stable
    vx += (vw - newW) / 2
    vy += (vh - newH) / 2
    vw = newW
    vh = newH
    applyViewBox()
  }

  // Zoom controls
  const zoomWrap = document.createElement('div')
  zoomWrap.className = 'ring-zoom-controls'
  const btnIn = document.createElement('button')
  btnIn.className = 'ring-zoom-btn'
  btnIn.textContent = '+'
  btnIn.setAttribute('aria-label', 'Zoom in')
  btnIn.addEventListener('click', () => zoom(-1))
  const btnOut = document.createElement('button')
  btnOut.className = 'ring-zoom-btn'
  btnOut.textContent = '\u2212'
  btnOut.setAttribute('aria-label', 'Zoom out')
  btnOut.addEventListener('click', () => zoom(1))
  const expandIcon = '<svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M2 6V2h4"/><path d="M10 2h4v4"/><path d="M14 10v4h-4"/><path d="M6 14H2v-4"/></svg>'
  const collapseIcon = '<svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 4l8 8"/><path d="M12 4l-8 8"/></svg>'
  const btnExpand = document.createElement('button')
  btnExpand.className = 'ring-zoom-btn ring-expand-btn'
  btnExpand.innerHTML = expandIcon
  btnExpand.setAttribute('aria-label', 'Explore ring fullscreen')
  zoomWrap.appendChild(btnIn)
  zoomWrap.appendChild(btnOut)
  zoomWrap.appendChild(btnExpand)
  container.style.position = 'relative'
  container.appendChild(zoomWrap)

  // SVG
  const svg = select(container)
    .append('svg')
    .attr('viewBox', `${vx} ${vy} ${vw} ${vh}`)
    .attr('class', 'directory-ring-svg')
    .attr('role', 'img')
    .attr('aria-label', `Webring visualization with ${members.length} members`)
    .style('cursor', 'grab')

  // Mobile: detect via layout breakpoint so Firefox responsive mode works too
  const isMobileLayout = matchMedia('(max-width: 767px)').matches
  const isTouchDevice = isMobileLayout || matchMedia('(pointer: coarse)').matches

  // Pan: drag on SVG background to move the viewBox
  let panStartX = 0
  let panStartY = 0
  let panStartVx = 0
  let panStartVy = 0

  const svgEl = svg.node()!

  function getScale(): number {
    const rect = svgEl.getBoundingClientRect()
    return vw / rect.width
  }

  const panBehavior = drag<SVGSVGElement, unknown>()
    .filter((event) => {
      // Only pan when dragging the background, not nodes
      const target = event.target as Element
      return !target.closest('.ring-node')
    })
    .on('start', (event) => {
      panStartX = event.x
      panStartY = event.y
      panStartVx = vx
      panStartVy = vy
      svg.style('cursor', 'grabbing')
    })
    .on('drag', (event) => {
      const scale = getScale()
      vx = panStartVx - (event.x - panStartX) * scale
      vy = panStartVy - (event.y - panStartY) * scale
      applyViewBox()
    })
    .on('end', () => {
      svg.style('cursor', 'grab')
    })

  if (!isTouchDevice) svg.call(panBehavior)

  // Fullscreen explore mode (touch only)
  let isFullscreen = false

  if (isTouchDevice) {
    let touchPanStart = { x: 0, y: 0, vx: 0, vy: 0 }
    let lastPinchDist = 0
    let isPanning = false

    // Overlay lives on <body> to escape transform-containing-block ancestors
    const overlay = document.createElement('div')
    overlay.className = 'ring-fullscreen-overlay'
    overlay.hidden = true
    document.body.appendChild(overlay)

    function enterFullscreen() {
      isFullscreen = true
      if (viewBoxAnimFrame) { cancelAnimationFrame(viewBoxAnimFrame); viewBoxAnimFrame = 0 }
      overlay.hidden = false
      overlay.appendChild(svgEl)
      overlay.appendChild(zoomWrap)
      document.body.classList.add('has-ring-fullscreen')
      btnExpand.innerHTML = collapseIcon
      btnExpand.setAttribute('aria-label', 'Close')
      svgEl.style.touchAction = 'none'
      simulation.alphaTarget(0)
    }

    function exitFullscreen() {
      isFullscreen = false
      container.appendChild(svgEl)
      container.appendChild(zoomWrap)
      overlay.hidden = true
      document.body.classList.remove('has-ring-fullscreen')
      btnExpand.innerHTML = expandIcon
      btnExpand.setAttribute('aria-label', 'Explore ring fullscreen')
      svgEl.style.touchAction = ''
      if (selectedSlug) {
        focusOnMember(selectedSlug)
      } else {
        animateViewBox(vx0, vy0, vw0, vh0)
        simulation.alphaTarget(driftAlpha).restart()
      }
    }

    btnExpand.addEventListener('click', () => {
      if (isFullscreen) exitFullscreen()
      else enterFullscreen()
    })

    svgEl.addEventListener('touchstart', (e: TouchEvent) => {
      if (!isFullscreen) return
      isPanning = false

      if (e.touches.length === 2) {
        e.preventDefault()
        const dx = e.touches[1].clientX - e.touches[0].clientX
        const dy = e.touches[1].clientY - e.touches[0].clientY
        lastPinchDist = Math.hypot(dx, dy)
      }

      touchPanStart = { x: e.touches[0].clientX, y: e.touches[0].clientY, vx, vy }
    }, { passive: false })

    svgEl.addEventListener('touchmove', (e: TouchEvent) => {
      if (!isFullscreen) return

      if (e.touches.length === 1 && !isPanning) {
        const dx = Math.abs(e.touches[0].clientX - touchPanStart.x)
        const dy = Math.abs(e.touches[0].clientY - touchPanStart.y)
        if (dx + dy < 8) return
        isPanning = true
        if (viewBoxAnimFrame) { cancelAnimationFrame(viewBoxAnimFrame); viewBoxAnimFrame = 0 }
      }

      e.preventDefault()

      if (e.touches.length === 1 && isPanning) {
        const scale = getScale()
        vx = touchPanStart.vx - (e.touches[0].clientX - touchPanStart.x) * scale
        vy = touchPanStart.vy - (e.touches[0].clientY - touchPanStart.y) * scale
        applyViewBox()
      } else if (e.touches.length === 2) {
        const dx = e.touches[1].clientX - e.touches[0].clientX
        const dy = e.touches[1].clientY - e.touches[0].clientY
        const dist = Math.hypot(dx, dy)
        if (lastPinchDist === 0) { lastPinchDist = dist; return }

        const factor = lastPinchDist / dist
        const newW = Math.max(totalW / maxZoom, Math.min(totalW / minZoom, vw * factor))
        const newH = Math.max(totalH / maxZoom, Math.min(totalH / minZoom, vh * factor))

        const rect = svgEl.getBoundingClientRect()
        const midX = (e.touches[0].clientX + e.touches[1].clientX) / 2
        const midY = (e.touches[0].clientY + e.touches[1].clientY) / 2
        const svgMidX = vx + (midX - rect.left) / rect.width * vw
        const svgMidY = vy + (midY - rect.top) / rect.height * vh

        vx = svgMidX - (svgMidX - vx) * (newW / vw)
        vy = svgMidY - (svgMidY - vy) * (newH / vh)
        vw = newW
        vh = newH
        applyViewBox()
        lastPinchDist = dist
      }
    }, { passive: false })

    svgEl.addEventListener('touchend', (e: TouchEvent) => {
      if (!isFullscreen) return
      isPanning = false
      if (e.touches.length === 1) {
        touchPanStart = { x: e.touches[0].clientX, y: e.touches[0].clientY, vx, vy }
        lastPinchDist = 0
      } else if (e.touches.length === 0) {
        lastPinchDist = 0
      }
    })
  }

  // Links
  const linkGroup = svg.append('g').attr('class', 'ring-links')
  const linkEls = linkGroup.selectAll<SVGLineElement, RingLink>('line')
    .data(linkData)
    .join('line')
    .attr('class', 'ring-link-line')

  // Node groups
  const nodeGroup = svg.append('g').attr('class', 'ring-nodes')
  const nodes = nodeGroup
    .selectAll<SVGGElement, RingMember>('g')
    .data(members)
    .join('g')
    .attr('class', 'ring-node')
    .attr('id', d => `ring-node-${d.slug}`)

  // Touch hit area (invisible, larger target for taps)
  if (isTouchDevice) {
    nodes.append('circle')
      .attr('r', nodeR * 5)
      .attr('fill', 'transparent')
      .attr('class', 'ring-node-hit')
      .style('pointer-events', 'auto')
  }

  // Node dots
  nodes.append('circle')
    .attr('r', nodeR)
    .attr('class', 'ring-node-dot')

  // Domain labels
  nodes.append('text')
    .attr('class', 'ring-node-label')
    .attr('dy', nodeR + 10)
    .text(d => displayDomain(d.url))

  // Touch: tap-to-select with visit affordance. Desktop: click-to-visit.
  let selectedSlug: string | null = null

  function selectMember(slug: string, scrollCard = true) {
    if (selectedSlug === slug) { deselectMember(); return }
    hideBloom()
    selectedSlug = slug
    showBloom(slug)

    // Mark selected card
    const card = document.querySelector<HTMLElement>(`.directory-row[data-member="${slug}"]`)
    document.querySelectorAll('.directory-row.is-selected').forEach(el => el.classList.remove('is-selected'))
    card?.classList.add('is-selected')
    if (scrollCard) {
      card?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' })
    }

    // Freeze drift so the selected node doesn't slide away
    if (isTouchDevice) simulation.alphaTarget(0)
  }

  function deselectMember() {
    selectedSlug = null
    document.querySelectorAll('.directory-row.is-selected').forEach(el => el.classList.remove('is-selected'))
    hideBloom()
    if (isTouchDevice && !isFullscreen) simulation.alphaTarget(driftAlpha).restart()
  }

  // Tap SVG background to deselect on touch
  if (isTouchDevice) {
    svgEl.addEventListener('click', (e) => {
      if (!(e.target as Element).closest('.ring-node') && selectedSlug) {
        deselectMember()
      }
    })
  }

  nodes.on('click', (event, d) => {
    if (isTouchDevice) {
      event.stopPropagation()
      selectMember(d.slug)
    } else {
      window.open(d.url, '_blank', 'noopener,noreferrer')
    }
  })

  // Force simulation — sparse organic graph
  const simulation = forceSimulation<RingMember>(members)
    .force('link', forceLink<RingMember, RingLink>(linkData)
      .distance(d => 60 + hashSlug(((d.source as unknown as RingMember).slug) + ((d.target as unknown as RingMember).slug)) * 70)
      .strength(0.05))
    .force('center', forceCenter<RingMember>(cx, cy).strength(0.02))
    .force('collide', forceCollide<RingMember>(isTouchDevice ? nodeR * 5 : nodeR + 8).strength(0.7))
    .force('charge', forceManyBody<RingMember>().strength(-120).distanceMax(spread * 2.5))
    .alphaDecay(0.012)
    .velocityDecay(0.4)

  // Pre-settle synchronously so the first paint is already in the expanded state
  const settleTicks = Math.ceil(Math.log(simulation.alphaMin()) / Math.log(1 - simulation.alphaDecay()))
  simulation.tick(settleTicks)
  simulation.on('tick', ticked)
  ticked()

  // Start gentle drift after the settled initial render
  setTimeout(() => {
    simulation.alphaTarget(driftAlpha).restart()
  }, 3000)

  function ticked() {
    nodes.attr('transform', d => `translate(${d.x},${d.y})`)
    linkEls
      .attr('x1', d => (d.source as unknown as RingMember).x!)
      .attr('y1', d => (d.source as unknown as RingMember).y!)
      .attr('x2', d => (d.target as unknown as RingMember).x!)
      .attr('y2', d => (d.target as unknown as RingMember).y!)
  }

  // Drag behavior
  const dragBehavior = drag<SVGGElement, RingMember>()
    .on('start', (event, d) => {
      if (!event.active) simulation.alphaTarget(0.4).restart()
      d.fx = d.x
      d.fy = d.y
    })
    .on('drag', (event, d) => {
      d.fx = event.x
      d.fy = event.y
    })
    .on('end', (event, d) => {
      if (!event.active) simulation.alphaTarget(driftAlpha)
      d.fx = null
      d.fy = null
    })

  if (!isTouchDevice) nodes.call(dragBehavior)

  // Bloom hover helpers
  const ringWrap = container.closest('.directory-ring-wrap')

  function showBloom(slug: string) {
    ringWrap?.classList.add('has-highlight')
    document.getElementById(`ring-node-${slug}`)?.classList.add('is-highlighted')

    // Highlight connected links
    linkEls.each(function (d) {
      const s = d.source as unknown as RingMember
      const t = d.target as unknown as RingMember
      if (s.slug === slug || t.slug === slug) {
        (this as SVGLineElement).classList.add('is-highlighted')
      }
    })

    // Highlight directory row
    document.querySelector(`.directory-row[data-member="${slug}"]`)?.classList.add('is-hovered')
  }

  function hideBloom() {
    ringWrap?.classList.remove('has-highlight')
    document.querySelectorAll('.ring-node.is-highlighted').forEach(el => el.classList.remove('is-highlighted'))
    document.querySelectorAll('.ring-link-line.is-highlighted').forEach(el => el.classList.remove('is-highlighted'))
    document.querySelectorAll('.directory-row.is-hovered').forEach(el => el.classList.remove('is-hovered'))
    document.querySelectorAll('.directory-row.is-selected').forEach(el => el.classList.remove('is-selected'))
    selectedSlug = null
  }

  // Directory list <-> ring hover interaction
  const rows = Array.from(document.querySelectorAll<HTMLElement>('.directory-row[data-member]'))

  rows.forEach(row => {
    const slug = row.getAttribute('data-member')
    if (!slug) return

    if (isTouchDevice) {
      const href = row.getAttribute('href')
      if (!href) return
      const visitLink = document.createElement('a')
      visitLink.className = 'directory-row-visit'
      visitLink.href = href
      visitLink.target = '_blank'
      visitLink.rel = 'noopener noreferrer'
      visitLink.setAttribute('aria-label', `Visit ${row.querySelector('.directory-row-name')?.textContent ?? 'site'}`)
      visitLink.innerHTML = '<svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M6 3H3.5A1.5 1.5 0 0 0 2 4.5v8A1.5 1.5 0 0 0 3.5 14h8A1.5 1.5 0 0 0 13 12.5V10"/><path d="M9 2h5v5"/><path d="M14 2 7.5 8.5"/></svg>'
      row.appendChild(visitLink)

      row.addEventListener('click', (e) => {
        if ((e.target as Element).closest('.directory-row-visit')) return
        e.preventDefault()
        selectMember(slug, false)
      })
    } else {
      row.addEventListener('mouseenter', () => showBloom(slug))
      row.addEventListener('mouseleave', () => hideBloom())
    }
  })

  // Pagination — recalculate page size when the directory panel settles
  const directoryListEl = document.querySelector<HTMLElement>('.directory-list')
  const headerEl = document.querySelector<HTMLElement>('.directory-header')
  const directoryInnerEl = directoryListEl?.closest<HTMLElement>('.directory-inner') ?? null
  const directoryListWrapEl = directoryListEl?.closest<HTMLElement>('.directory-list-wrap') ?? null
  const paginationEl = directoryListWrapEl?.querySelector<HTMLElement>('.directory-pagination') ?? null
  const prevBtn = document.getElementById('page-prev') as HTMLButtonElement | null
  const nextBtn = document.getElementById('page-next') as HTMLButtonElement | null
  const pageInfo = document.getElementById('page-info')
  let pageSize = 10
  let currentPage = 0
  let totalPages = Math.max(1, Math.ceil(rows.length / pageSize))
  let pageMeasureFrame = 0
  let pageMeasurePaintFrame = 0
  let searchMatches: Set<string> | null = null

  function parsePixels(value: string): number {
    const parsed = Number.parseFloat(value)
    return Number.isFinite(parsed) ? parsed : 0
  }

  function getBlockPadding(el: HTMLElement | null): number {
    if (!el) return 0
    const styles = getComputedStyle(el)
    return parsePixels(styles.paddingTop) + parsePixels(styles.paddingBottom)
  }

  function getBlockGap(el: HTMLElement | null): number {
    if (!el) return 0
    const styles = getComputedStyle(el)
    return parsePixels(styles.rowGap || styles.gap)
  }

  function hasPagedListLayout(): boolean {
    if (!directoryListEl || !paginationEl) return false
    return getComputedStyle(directoryListEl).flexDirection !== 'row'
  }

  function computePageSize() {
    if (!directoryListEl || !rows.length) return
    if (!hasPagedListLayout()) {
      currentPage = 0
      totalPages = 1
      renderPage()
      return
    }
    const sampleRow = rows.find(row => row.style.display !== 'none') ?? rows[0]
    const wasHidden = sampleRow.style.display === 'none'
    if (wasHidden) sampleRow.style.display = ''
    // `getBoundingClientRect()` changes with the panel's 3D rotation.
    // Use layout-box heights so pagination stays stable while the ring moves.
    const rowHeight = sampleRow.offsetHeight
    if (wasHidden) sampleRow.style.display = 'none'
    if (rowHeight === 0) return
    const headerHeight = headerEl?.offsetHeight ?? 0
    const panelHeight = directoryListEl.closest<HTMLElement>('.panel')?.clientHeight || window.innerHeight
    const listHeightFromPanel = panelHeight
      - getBlockPadding(directoryInnerEl)
      - getBlockGap(directoryListWrapEl)
      - (paginationEl?.offsetHeight ?? 0)
    const listHeight = listHeightFromPanel > 0
      ? listHeightFromPanel
      : (directoryListEl.clientHeight || directoryListEl.offsetHeight)
    if (listHeight === 0) return
    pageSize = Math.max(5, Math.floor((listHeight - headerHeight) / rowHeight))
    totalPages = Math.max(1, Math.ceil(rows.length / pageSize))
    if (currentPage >= totalPages) currentPage = totalPages - 1
  }

  function schedulePageSizeRecalc() {
    if (pageMeasureFrame) cancelAnimationFrame(pageMeasureFrame)
    if (pageMeasurePaintFrame) cancelAnimationFrame(pageMeasurePaintFrame)

    pageMeasureFrame = requestAnimationFrame(() => {
      pageMeasureFrame = 0
      pageMeasurePaintFrame = requestAnimationFrame(() => {
        pageMeasurePaintFrame = 0
        computePageSize()
        renderPage()
      })
    })
  }

  function renderPage() {
    const paginationActive = hasPagedListLayout() && !searchMatches
    directoryListEl?.classList.toggle('is-paginated', hasPagedListLayout())
    if (paginationEl) paginationEl.hidden = !paginationActive

    if (!paginationActive) {
      rows.forEach(row => {
        row.style.display = ''
      })
      return
    }

    const start = currentPage * pageSize
    const end = start + pageSize
    rows.forEach((row, i) => {
      row.style.display = (i >= start && i < end) ? '' : 'none'
    })
    if (prevBtn) prevBtn.disabled = currentPage === 0
    if (nextBtn) nextBtn.disabled = currentPage >= totalPages - 1
    if (pageInfo) pageInfo.textContent = `${currentPage + 1} / ${totalPages}`
  }

  prevBtn?.addEventListener('click', () => {
    if (currentPage > 0) { currentPage--; renderPage() }
  })
  nextBtn?.addEventListener('click', () => {
    if (currentPage < totalPages - 1) { currentPage++; renderPage() }
  })

  const ringEl = document.getElementById('ring')
  ringEl?.addEventListener('panelsettle', ((e: CustomEvent) => {
    if (e.detail?.index === 2) {
      schedulePageSizeRecalc()
    }
  }) as EventListener)

  // Initial render with default size
  renderPage()
  schedulePageSizeRecalc()
  window.addEventListener('resize', schedulePageSizeRecalc)
  document.fonts?.ready.then(() => {
    schedulePageSizeRecalc()
  }).catch(() => undefined)

  // Ring node hover -> bloom
  nodes
    .on('mouseenter', (_event, d) => showBloom(d.slug))
    .on('mouseleave', () => hideBloom())

  // Search bar: regex-from-start filter that highlights rows + nodes
  // and pans/zooms the ring to fit matches.
  const searchInput = document.getElementById('directory-search-input') as HTMLInputElement | null
  const directoryList = document.querySelector<HTMLElement>('.directory-list')

  function clearSearchState() {
    ringWrap?.classList.remove('has-highlight')
    directoryList?.classList.remove('has-search')
    document.querySelectorAll('.ring-node.is-highlighted').forEach(el => el.classList.remove('is-highlighted'))
    document.querySelectorAll('.ring-link-line.is-highlighted').forEach(el => el.classList.remove('is-highlighted'))
    document.querySelectorAll('.directory-row.is-search-match').forEach(el => el.classList.remove('is-search-match'))
  }

  function resetViewBox() {
    animateViewBox(vx0, vy0, vw0, vh0)
  }

  function fitViewBoxToMatches(matches: RingMember[]) {
    if (matches.length === 0) return
    let minX = Infinity
    let minY = Infinity
    let maxX = -Infinity
    let maxY = -Infinity
    for (const m of matches) {
      if (m.x == null || m.y == null) continue
      if (m.x < minX) minX = m.x
      if (m.y < minY) minY = m.y
      if (m.x > maxX) maxX = m.x
      if (m.y > maxY) maxY = m.y
    }
    if (!isFinite(minX)) return

    const padX = 50
    const padY = 40
    let bw = (maxX - minX) + padX * 2
    let bh = (maxY - minY) + padY * 2
    const minFrame = 220
    if (bw < minFrame) bw = minFrame
    if (bh < minFrame) bh = minFrame

    // Match aspect ratio of the original frame so the SVG doesn't distort
    const baseAspect = vw0 / vh0
    const curAspect = bw / bh
    if (curAspect > baseAspect) {
      bh = bw / baseAspect
    } else {
      bw = bh * baseAspect
    }

    const cxMatches = (minX + maxX) / 2
    const cyMatches = (minY + maxY) / 2
    animateViewBox(cxMatches - bw / 2, cyMatches - bh / 2, bw, bh)
  }

  if (searchInput) {
    searchInput.addEventListener('input', () => {
      const q = searchInput.value.trim()

      if (q === '') {
        searchMatches = null
        clearSearchState()
        renderPage()
        resetViewBox()
        simulation.alphaTarget(driftAlpha).restart()
        return
      }

      let re: RegExp
      try {
        re = new RegExp('^' + q, 'i')
      } catch {
        return
      }

      // Stop drift so the frame stays stable while searching
      simulation.alphaTarget(0)

      const matched = members.filter(m => re.test(m.name))
      const matchedSlugs = new Set(matched.map(m => m.slug))
      searchMatches = matchedSlugs
      renderPage()

      // Clear previous highlight classes
      document.querySelectorAll('.ring-node.is-highlighted').forEach(el => el.classList.remove('is-highlighted'))
      document.querySelectorAll('.ring-link-line.is-highlighted').forEach(el => el.classList.remove('is-highlighted'))
      document.querySelectorAll('.directory-row.is-search-match').forEach(el => el.classList.remove('is-search-match'))

      ringWrap?.classList.add('has-highlight')
      directoryList?.classList.add('has-search')

      for (const slug of matchedSlugs) {
        document.getElementById(`ring-node-${slug}`)?.classList.add('is-highlighted')
        document.querySelector(`.directory-row[data-member="${slug}"]`)?.classList.add('is-search-match')
      }

      linkEls.each(function (d) {
        const s = d.source as unknown as RingMember
        const t = d.target as unknown as RingMember
        if (matchedSlugs.has(s.slug) || matchedSlugs.has(t.slug)) {
          (this as SVGLineElement).classList.add('is-highlighted')
        }
      })

      if (matched.length > 0) {
        document.querySelector<HTMLElement>(`.directory-row[data-member="${matched[0].slug}"]`)
          ?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' })
        fitViewBoxToMatches(matched)
      } else {
        resetViewBox()
      }
    })
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init)
} else {
  init()
}
