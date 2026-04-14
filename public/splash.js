(function() {
  var isMobile = window.matchMedia('(max-width: 767px)').matches;
  var reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  var ring = document.getElementById('ring');
  var track = ring.querySelector('.ring-track');
  var panels = track.querySelectorAll('.panel:not(.panel--clone)');
  var dots = document.querySelectorAll('.ring-dot');
  var PANEL_COUNT = parseInt(ring.getAttribute('data-panel-count'), 10);
  var ANGLE_STEP = 360 / PANEL_COUNT;
  var panelDim = isMobile ? window.innerHeight : window.innerWidth;

  // Scroll state (angle-based)
  var currentAngle = 0;
  var targetAngle = 0;
  var rawTarget = 0;

  // Restore panel position after resize-triggered reload
  var _saved = parseInt(sessionStorage.getItem('wr-panel'), 10);
  if (!isNaN(_saved) && _saved >= 0 && _saved < PANEL_COUNT) {
    sessionStorage.removeItem('wr-panel');
    currentAngle = _saved * ANGLE_STEP;
    targetAngle = currentAngle;
    rawTarget = currentAngle;
  }
  // Tuning -- instant snap when user prefers reduced motion
  var SCROLL_EASE = reducedMotion ? 1.0 : 0.22;
  var prevActiveIdx = -1;
  var isSettled = true;

  function computeRadius() {
    return Math.round(panelDim / (2 * Math.tan(Math.PI / PANEL_COUNT)));
  }

  var radius = computeRadius();

  function snapAngle(a) {
    return Math.round(a / ANGLE_STEP) * ANGLE_STEP;
  }

  // Place each panel on the cylinder surface
  function layoutPanels() {
    for (var i = 0; i < panels.length; i++) {
      var angle = i * ANGLE_STEP;
      panels[i].style.transform = isMobile
        ? 'rotateX(' + (-angle) + 'deg) translateZ(' + radius + 'px)'
        : 'rotateY(' + angle + 'deg) translateZ(' + radius + 'px)';
    }
  }

  function renderTrack() {
    track.style.transform = isMobile
      ? 'translateZ(' + (-radius) + 'px) rotateX(' + currentAngle + 'deg)'
      : 'translateZ(' + (-radius) + 'px) rotateY(' + (-currentAngle) + 'deg)';
  }

  layoutPanels();
  renderTrack();

  // ── Offscreen animation pause ──
  function updateOffscreen(activeIdx) {
    for (var p = 0; p < panels.length; p++) {
      var near = p === activeIdx
        || p === (activeIdx + 1) % PANEL_COUNT
        || p === (activeIdx - 1 + PANEL_COUNT) % PANEL_COUNT;
      if (near) panels[p].removeAttribute('data-offscreen');
      else panels[p].setAttribute('data-offscreen', '');
    }
  }

  // ── Tick ──
  var rafId = 0;

  function startTick() {
    if (!rafId) rafId = requestAnimationFrame(tick);
  }

  function unsettle() {
    if (isSettled) {
      isSettled = false;
      track.style.willChange = 'transform';
      ring.dispatchEvent(new CustomEvent('panelunsettle'));
    }
    startTick();
  }

  // ── Wheel (desktop) ──
  if (!isMobile) {
    ring.addEventListener('wheel', function(e) {
      e.preventDefault();

      var delta = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
      if (e.deltaMode === 1) delta *= 40;
      if (e.deltaMode === 2) delta *= panelDim;

      rawTarget += (delta / panelDim) * ANGLE_STEP;
      targetAngle = rawTarget;

      unsettle();

    }, { passive: false });
  }

  // ── Touch (mobile) ──
  if (isMobile) {
    var touchStartY = 0;
    var touchStartX = 0;
    var touchStartAngle = 0;
    var lastTouchY = 0;
    var lastTouchTime = 0;
    var velocity = 0;
    var isDragging = false;
    var dragRaf = 0;
    var pendingAngle = 0;
    var isHorizontalScroll = false;
    var directionLocked = false;

    ring.addEventListener('touchstart', function(e) {
      // When iframe is interactive, don't capture touches for carousel rotation
      if (ring.classList.contains('is-iframe-active')) {
        isDragging = false;
        return;
      }
      isDragging = true;
      isHorizontalScroll = false;
      directionLocked = false;
      velocity = 0;
      touchStartX = e.touches[0].clientX;
      touchStartY = e.touches[0].clientY;
      touchStartAngle = currentAngle;
      pendingAngle = currentAngle;
      lastTouchY = touchStartY;
      lastTouchTime = Date.now();
    }, { passive: true });

    ring.addEventListener('touchmove', function(e) {
      if (!isDragging) return;
      if (e.touches.length > 1) return;

      // Direction lock: vertical swipes rotate the ring, horizontal swipes on
      // the directory list fall through to native scroll. If a swipe starts on
      // the list but is more vertical than horizontal, ring rotation wins.
      if (!directionLocked) {
        var dx = Math.abs(e.touches[0].clientX - touchStartX);
        var dy = Math.abs(e.touches[0].clientY - touchStartY);
        if (dx + dy > 8) {
          directionLocked = true;
          // Horizontal swipe on the member list = let browser handle it
          if (dx > dy && e.target.closest && e.target.closest('.directory-list')) {
            isHorizontalScroll = true;
          }
        }
      }

      if (isHorizontalScroll) return;
      e.preventDefault();

      var touchY = e.touches[0].clientY;
      var now = Date.now();
      var dt = now - lastTouchTime;

      if (dt > 0) {
        var raw = (lastTouchY - touchY) / dt;
        velocity = Math.max(-3, Math.min(3, raw));
      }

      lastTouchY = touchY;
      lastTouchTime = now;

      // Continuous angle -- no quantization during drag for smooth tracking
      var deltaY = touchStartY - touchY;
      pendingAngle = touchStartAngle + (deltaY / panelDim) * ANGLE_STEP;

      // Batch render via rAF to avoid multiple style writes per frame
      if (!dragRaf) {
        dragRaf = requestAnimationFrame(function() {
          dragRaf = 0;
          currentAngle = pendingAngle;
          rawTarget = currentAngle;
          targetAngle = currentAngle;
          renderTrack();

          unsettle();

          // Update active dot and offscreen state
          var norm = ((Math.round(currentAngle / ANGLE_STEP) % PANEL_COUNT) + PANEL_COUNT) % PANEL_COUNT;
          if (norm !== prevActiveIdx) {
            prevActiveIdx = norm;
            dots.forEach(function(dot, i) {
              dot.classList.toggle('is-active', i === norm);
            });
            updateOffscreen(norm);
            ring.dispatchEvent(new CustomEvent('panelchange', { detail: { index: norm } }));
          }
        });
      }
    }, { passive: false });

    function onTouchEnd() {
      if (ring.classList.contains('is-iframe-active')) return;
      isDragging = false;
      var wasHorizontalScroll = isHorizontalScroll;
      isHorizontalScroll = false;
      directionLocked = false;
      if (dragRaf) { cancelAnimationFrame(dragRaf); dragRaf = 0; }
      if (wasHorizontalScroll) return;
      currentAngle = pendingAngle;

      var nearest = snapAngle(currentAngle);
      var SWIPE_THRESHOLD = 0.15; // min velocity to trigger directional snap

      if (Math.abs(velocity) > SWIPE_THRESHOLD) {
        // Swipe detected: always advance at least one panel in swipe direction
        var dir = velocity > 0 ? 1 : -1;
        var next = nearest + dir * ANGLE_STEP;
        // If we already passed the next panel, snap to the one after
        if (dir > 0 && next < currentAngle) next += ANGLE_STEP;
        if (dir < 0 && next > currentAngle) next -= ANGLE_STEP;
        targetAngle = next;
      } else {
        // No significant swipe: snap to nearest panel
        targetAngle = nearest;
      }

      rawTarget = targetAngle;
      unsettle();
    }
    ring.addEventListener('touchend', onTouchEnd, { passive: true });
    ring.addEventListener('touchcancel', onTouchEnd, { passive: true });
  }

  // ── Dots ──
  dots.forEach(function(dot) {
    dot.addEventListener('click', function() {
      var idx = parseInt(dot.getAttribute('data-dot'), 10);
      var target = idx * ANGLE_STEP;
      var norm = ((currentAngle % 360) + 360) % 360;
      var diff = target - norm;
      if (diff > 180) diff -= 360;
      if (diff < -180) diff += 360;
      targetAngle = currentAngle + diff;
      rawTarget = targetAngle;
      unsettle();
    });
  });

  // ── Snap-to (programmatic) ──
  ring.addEventListener('snapto', function(e) {
    var idx = e.detail.index;
    var target = idx * ANGLE_STEP;
    var norm = ((currentAngle % 360) + 360) % 360;
    var diff = target - norm;
    if (diff > 180) diff -= 360;
    if (diff < -180) diff += 360;
    targetAngle = currentAngle + diff;
    rawTarget = targetAngle;
    unsettle();
  });

  // ── Keyboard (scoped to ring so screen readers can still use arrow keys) ──
  ring.setAttribute('tabindex', '0');
  ring.setAttribute('role', 'region');
  ring.setAttribute('aria-roledescription', 'carousel');
  ring.setAttribute('aria-label', 'Site panels');

  ring.addEventListener('keydown', function(e) {
    // Only navigate panels when the ring itself has focus, not child elements
    if (e.target !== ring) return;

    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
      e.preventDefault();
      targetAngle = snapAngle(currentAngle) + ANGLE_STEP;
      rawTarget = targetAngle;
      unsettle();

    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
      e.preventDefault();
      targetAngle = snapAngle(currentAngle) - ANGLE_STEP;
      rawTarget = targetAngle;
      unsettle();

    }
  });

  function tick() {
    rafId = 0;

    var diff = targetAngle - currentAngle;
    var moving = Math.abs(diff) > 0.05;

    if (moving) {
      currentAngle += diff * SCROLL_EASE;
      renderTrack();
    } else if (currentAngle !== targetAngle) {
      currentAngle = targetAngle;
      renderTrack();
    }

    // Active panel index
    var norm = ((Math.round(currentAngle / ANGLE_STEP) % PANEL_COUNT) + PANEL_COUNT) % PANEL_COUNT;
    if (norm !== prevActiveIdx) {
      prevActiveIdx = norm;
      dots.forEach(function(dot, i) {
        dot.classList.toggle('is-active', i === norm);
      });
      updateOffscreen(norm);
      ring.dispatchEvent(new CustomEvent('panelchange', { detail: { index: norm } }));
    }

    // Stop loop when settled -- restarts on next input via startTick()
    if (!isSettled && currentAngle === targetAngle) {
      isSettled = true;
      track.style.willChange = 'auto';
      ring.dispatchEvent(new CustomEvent('panelsettle', { detail: { index: norm } }));
      return;
    }

    if (moving || currentAngle !== targetAngle) {
      rafId = requestAnimationFrame(tick);
    }
  }

  // Initial render is already done; start loop only on first input
  // Set initial dot state
  var initIdx = ((Math.round(currentAngle / ANGLE_STEP) % PANEL_COUNT) + PANEL_COUNT) % PANEL_COUNT;
  prevActiveIdx = initIdx;
  dots.forEach(function(dot, i) { dot.classList.toggle('is-active', i === initIdx); });
  updateOffscreen(initIdx);
  ring.dispatchEvent(new CustomEvent('panelsettle', { detail: { index: initIdx } }));

  // ── Pause when hidden ──
  document.addEventListener('visibilitychange', function() {
    if (document.hidden) {
      if (rafId) { cancelAnimationFrame(rafId); rafId = 0; }
    } else if (!isSettled) {
      startTick();
    }
  });

  // ── Resize ──
  window.addEventListener('resize', function() {
    var wasMobile = isMobile;
    isMobile = window.matchMedia('(max-width: 767px)').matches;
    if (isMobile !== wasMobile) {
      var norm = ((Math.round(currentAngle / ANGLE_STEP) % PANEL_COUNT) + PANEL_COUNT) % PANEL_COUNT;
      sessionStorage.setItem('wr-panel', norm);
      window.location.reload();
      return;
    }
    panelDim = isMobile ? window.innerHeight : window.innerWidth;
    radius = computeRadius();
    layoutPanels();
    renderTrack();
  });

  // ── Join button click overlay ──
  // Chrome's preserve-3d hit-testing can route clicks to the rotated Explore
  // panel instead of the Join button. The fix: a transparent <a> element
  // OUTSIDE the ring's perspective context (so Chrome uses 2D hit-testing).
  // It sits invisibly over the real button on settle and hides on unsettle.
  var joinOverlay = document.getElementById('join-link-overlay');
  var JOIN_IDX = PANEL_COUNT - 1;
  if (joinOverlay) {
    ring.addEventListener('panelsettle', function(e) {
      if (e.detail.index !== JOIN_IDX) return;
      var btn = document.querySelector('.panel[data-index="' + JOIN_IDX + '"] .join-button');
      if (!btn) return;
      var r = btn.getBoundingClientRect();
      joinOverlay.style.top = r.top + 'px';
      joinOverlay.style.left = r.left + 'px';
      joinOverlay.style.width = r.width + 'px';
      joinOverlay.style.height = r.height + 'px';
      joinOverlay.style.display = 'block';
    });
    ring.addEventListener('panelunsettle', function() {
      joinOverlay.style.display = 'none';
    });
  }
})();

/* ── Webring line animation ── */
(function() {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  var lines = document.querySelectorAll('.anim-line');
  if (!lines.length) return;

  var NS = 'http://www.w3.org/2000/svg';
  var STAGGER = 700;
  var DRAW_DUR = 500;
  var DOT_LEAD = 250;
  var uid = 0;

  lines.forEach(function(line) {
    var idx = parseInt((line.className.baseVal || '').replace(/.*anim-line-(\d+).*/, '$1'), 10);
    if (isNaN(idx)) return;

    var svg = line.closest('svg');
    var len = line.getTotalLength();
    var id = 'anim-m-' + (uid++);

    // Build a mask with a solid copy of the path — acts as a reveal wipe
    var defs = svg.querySelector('defs');
    if (!defs) { defs = document.createElementNS(NS, 'defs'); svg.insertBefore(defs, svg.firstChild); }

    var mask = document.createElementNS(NS, 'mask');
    mask.setAttribute('id', id);
    mask.setAttribute('maskUnits', 'userSpaceOnUse');
    var vb = svg.viewBox.baseVal;
    mask.setAttribute('x', vb.x); mask.setAttribute('y', vb.y);
    mask.setAttribute('width', vb.width); mask.setAttribute('height', vb.height);

    var rev = document.createElementNS(NS, 'path');
    rev.setAttribute('d', line.getAttribute('d'));
    rev.setAttribute('fill', 'none');
    rev.setAttribute('stroke', 'white');
    rev.setAttribute('stroke-width', '4');
    rev.setAttribute('stroke-linecap', 'round');
    rev.style.strokeDasharray = len + ' ' + len;
    rev.style.strokeDashoffset = '' + len;

    mask.appendChild(rev);
    defs.appendChild(mask);
    line.setAttribute('mask', 'url(#' + id + ')');

    // Visible line is always dashed
    line.style.strokeDasharray = '8 5';

    var delay = idx * STAGGER + DOT_LEAD;

    // Animate the mask to reveal the dashed line
    setTimeout(function() {
      rev.style.transition = 'stroke-dashoffset ' + DRAW_DUR + 'ms ease-in-out';
      rev.style.strokeDashoffset = '0';
    }, delay);
  });

  // After all lines drawn, start marching
  var totalTime = 12 * STAGGER + DOT_LEAD + DRAW_DUR + 150;
  setTimeout(function() {
    lines.forEach(function(line) {
      line.style.strokeDasharray = '';
      line.classList.add('is-marching');
    });
  }, totalTime);
})();
