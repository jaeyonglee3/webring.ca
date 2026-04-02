import { Hono } from 'hono'
import { raw } from 'hono/html'
import type { Bindings } from '../types'
import { getActiveMembers } from '../data'
import { CANADA_VIEWBOX, CANADA_OUTLINE_PATH, CANADA_REGION_PATHS, projectToSvg } from '../lib/canada-map'
import Layout from '../templates/Layout'

const app = new Hono<{ Bindings: Bindings }>()

app.get('/', async (c) => {
  c.header('Cache-Control', 'public, max-age=300')
  const active = await getActiveMembers(c.env.WEBRING)

  return c.html(
    <Layout fullHeight hideChrome>
      {raw(`<style>
        .landing {
          display: flex;
          flex: 1;
          min-height: 0;
          font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
          position: relative;
        }

        /* ── Left column — flexbox ── */
        .landing-left {
          flex: 0 0 47%;
          display: flex;
          flex-direction: column;
          position: relative;
          border-left: 2px solid var(--border-strong);
          border-right: 2px solid var(--border-strong);
          padding-bottom: 3.5rem;
        }

        /* ── Site title ── */
        .landing-title {
          font-size: 3.5rem;
          font-weight: 700;
          letter-spacing: -0.03em;
          padding: 1.5rem 2rem;
          line-height: 1.1;
          color: var(--fg);
          text-decoration: none;
          display: flex;
          align-items: center;
          gap: 2rem;
        }
        .landing-title-flag {
          height: 1.2em;
          width: auto;
          display: inline-block;
          flex-shrink: 0;
        }
        .landing-intro {
          font-size: 1.2rem;
          font-weight: 400;
          line-height: 1.55;
          color: var(--fg);
          padding: 0 2rem 1.2rem;
          max-width: 42ch;
        }
        .member-count {
          font-size: 0.7rem;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          color: var(--fg-muted);
          padding: 0.8rem 2rem 0.4rem;
          border-top: 2px solid var(--border-strong);
        }
        .member-list-wrap {
          flex: 1;
          overflow-y: auto;
          min-height: 0;
        }


        /* ── Members list ── */
        .member-list { list-style: none; padding: 0 2rem; }
        .member-list li {
          padding: 0.6rem 0;
          border-bottom: 1px solid var(--border);
          display: flex;
          justify-content: space-between;
          align-items: baseline;
        }
        .member-list li:first-child { border-top: 1px solid var(--border); }
        .member-list-name {
          font-size: 1rem;
          font-weight: 600;
          color: var(--fg);
          text-decoration: none;
        }
        .member-list-name:hover { color: var(--accent); }
        .member-list-meta {
          font-size: 0.8rem;
          font-weight: 400;
          color: var(--fg-muted);
        }


        /* ── Widget (matches embed look) ── */
        .landing-widget {
          position: absolute;
          bottom: 0;
          left: 0;
          right: 0;
          padding: 0.85rem 2rem;
          display: flex;
          align-items: center;
          justify-content: center;
          background: var(--bg);
        }
        .landing-widget-inner {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          padding: 0.5rem 0.75rem;
          border: 1px solid var(--border);
          border-radius: 4px;
          font-size: 0.8rem;
        }
        .landing-widget a {
          color: var(--accent);
          text-decoration: none;
          transition: opacity 0.15s;
        }
        .landing-widget a:visited { color: var(--accent); }
        .landing-widget a:hover { opacity: 0.7; }

        /* ── Right column — map ── */
        .landing-right {
          flex: 1;
          display: flex;
          flex-direction: column;
          padding: 2rem;
          position: relative;
        }

        /* ── Tab bar ── */
        .tab-bar {
          display: flex;
          gap: 0;
          border-bottom: 1.5px solid var(--border);
          margin-bottom: 0;
          padding: 0;
        }
        .tab-btn {
          background: none;
          border: none;
          padding: 0.6rem 1.2rem;
          font-family: 'Space Mono', monospace;
          font-size: 0.78rem;
          font-weight: 700;
          color: var(--fg-muted);
          cursor: pointer;
          border-bottom: 2px solid transparent;
          margin-bottom: -1.5px;
          transition: color 0.15s;
        }
        .tab-btn:hover { color: var(--fg); }
        .tab-btn.is-active {
          color: var(--fg);
          border-bottom-color: var(--border-strong);
        }
        .tab-panel { display: none; }
        .tab-panel.is-active { display: flex; align-items: center; justify-content: center; flex: 1; }

        /* ── Discover view ── */
        .discover-view {
          text-align: center;
          padding: 2rem;
        }
        .discover-name {
          font-size: 1.8rem;
          font-weight: 700;
          letter-spacing: -0.02em;
          color: var(--fg);
          margin-bottom: 0.3rem;
        }
        .discover-meta {
          font-size: 0.9rem;
          color: var(--fg-muted);
          margin-bottom: 1.8rem;
        }
        .discover-visit {
          display: inline-block;
          padding: 0.6rem 1.8rem;
          border: 1.5px solid var(--border-strong);
          border-radius: 4px;
          font-family: 'Space Mono', monospace;
          font-size: 0.85rem;
          font-weight: 700;
          color: var(--fg);
          text-decoration: none;
          transition: opacity 0.15s;
        }
        .discover-visit:hover { opacity: 0.6; }
        .discover-visit:visited { color: var(--fg); }
        .discover-shuffle {
          display: block;
          margin: 1rem auto 0;
          background: none;
          border: none;
          font-family: 'Space Mono', monospace;
          font-size: 0.8rem;
          color: var(--fg-muted);
          cursor: pointer;
          padding: 0.4rem 1rem;
          transition: color 0.15s;
        }
        .discover-shuffle:hover { color: var(--fg); }
        .discover-fade {
          transition: opacity 0.2s ease;
        }
        .landing-map-stage {
          width: min(100%, 640px);
          position: relative;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 2rem 1rem;
          isolation: isolate;
        }
        .landing-map-stage::before {
          content: '';
          position: absolute;
          inset: 10% 6% 14%;
          border-radius: 50%;
          background:
            radial-gradient(circle at 50% 45%,
              color-mix(in srgb, var(--accent) 11%, transparent) 0%,
              color-mix(in srgb, var(--accent) 6%, transparent) 28%,
              transparent 68%);
          opacity: 0.7;
          filter: blur(28px);
          z-index: 0;
          pointer-events: none;
        }
        .canada-map {
          width: 100%;
          height: auto;
          position: relative;
          z-index: 1;
        }
        .canada-silhouette {
          fill: color-mix(in srgb, var(--fg) 5%, var(--bg));
          opacity: 0.96;
        }
        .canada-shadow {
          fill: none;
          stroke: color-mix(in srgb, var(--fg) 8%, transparent);
          stroke-width: 7;
          stroke-linejoin: round;
          opacity: 0.28;
          filter: blur(10px);
        }
        .canada-outline {
          fill: none;
          stroke: color-mix(in srgb, var(--fg) 34%, var(--bg));
          stroke-width: 1.25;
          stroke-linejoin: round;
          vector-effect: non-scaling-stroke;
        }
        .canada-region {
          fill: none;
          stroke: color-mix(in srgb, var(--fg) 14%, var(--bg));
          stroke-width: 0.75;
          vector-effect: non-scaling-stroke;
          opacity: 0.9;
        }
        .canada-dot {
          fill: var(--accent);
          stroke: var(--bg);
          stroke-width: 3;
          filter: drop-shadow(0 4px 10px color-mix(in srgb, var(--accent) 24%, transparent));
          opacity: 0.95;
          transition: transform 0.2s ease, opacity 0.2s ease;
        }
        .canada-dot.is-highlighted {
          opacity: 1;
          transform: scale(1.22);
        }

        /* ── Landing theme toggle ── */
        .landing-theme-toggle {
          position: absolute;
          top: 1.5rem;
          right: 1.5rem;
          background: none;
          border: 1.5px solid var(--border-strong);
          border-radius: 50%;
          width: 36px;
          height: 36px;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          color: var(--fg);
          transition: opacity 0.2s;
          z-index: 10;
        }
        .landing-theme-toggle:hover { opacity: 0.6; }

        /* ── Responsive ── */
        @media (max-width: 767px) {
          .landing { flex-direction: column; height: auto; }
          .landing-left {
            border-left: none;
            border-right: none;
            border-bottom: 2px solid var(--border-strong);
          }
          .landing-title { font-size: 2.2rem; padding: 1.2rem 1.5rem; }
          .landing-intro { padding: 0 1.5rem 1rem; font-size: 0.95rem; }
          .member-count { padding: 0.6rem 1.5rem 0.3rem; }
          .member-list { padding: 0 1.5rem; }
          .member-list li { padding: 0.5rem 0; }
          .member-list-meta-type { display: none; }
          .landing-right { flex: none; min-height: 40vh; padding: 1.5rem; }
          .landing-map-stage { width: 100%; padding: 1.25rem 0.25rem 1.75rem; }
          .landing-theme-toggle { top: 1.2rem; right: 1rem; width: 30px; height: 30px; }
          .landing-theme-toggle svg { width: 14px; height: 14px; }
          .tab-bar { padding: 0; }
          .tab-btn { font-size: 0.72rem; padding: 0.5rem 0.8rem; }
          .discover-name { font-size: 1.4rem; }
          .discover-visit { font-size: 0.8rem; padding: 0.5rem 1.4rem; }
        }
      </style>`)}
      <div class="landing">
        {raw(`<button class="landing-theme-toggle" onclick="__toggleTheme()" aria-label="Toggle theme"><svg class="theme-icon-moon" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg><svg class="theme-icon-sun" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg></button>`)}
        <div class="landing-left" id="landing-left">
          <a href="/" class="landing-title">webring.ca <img src="https://upload.wikimedia.org/wikipedia/commons/d/d9/Flag_of_Canada_%28Pantone%29.svg" alt="Flag of Canada" class="landing-title-flag" /></a>

          <p class="landing-intro">A curated community of Canadian builders, designers, and creators sharing their work on the open web.</p>

          <div class="member-count">{active.length} Member{active.length !== 1 ? 's' : ''}</div>

          <div class="member-list-wrap">
            {active.length === 0 ? (
              <p class="landing-intro">No members yet.</p>
            ) : (
              <ul class="member-list">
                {active.map((m) => (
                  <li data-member-slug={m.slug}>
                    <a href={m.url} target="_blank" rel="noopener noreferrer" class="member-list-name">{m.name}</a>
                    <span class="member-list-meta">{m.city ?? ''}{m.city ? ' \u00b7 ' : ''}<span class="member-list-meta-type">{m.type}</span></span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div class="landing-widget">
            <div class="landing-widget-inner">
              <a href="/random">{raw('&larr;')}</a>
              <a href="/">{raw('&#x1F341;')} webring.ca</a>
              <a href="/random">{raw('&rarr;')}</a>
              <a href="/join">join</a>
            </div>
          </div>
        </div>

        <div class="landing-right">
          <div class="tab-bar" role="tablist">
            <button class="tab-btn is-active" role="tab" aria-selected="true" data-tab="map" aria-controls="tab-panel-map">Map</button>
            <button class="tab-btn" role="tab" aria-selected="false" data-tab="discover" aria-controls="tab-panel-discover">Discover</button>
          </div>

          <div class="tab-panel is-active" id="tab-panel-map" role="tabpanel">
            <div class="landing-map-stage">
              <svg
                class="canada-map"
                viewBox={CANADA_VIEWBOX}
                xmlns="http://www.w3.org/2000/svg"
                role="img"
                aria-label={`Map of Canada showing ${active.filter(m => m.lat != null).length} member locations`}
              >
                <path d={CANADA_OUTLINE_PATH} class="canada-shadow" />
                <path d={CANADA_OUTLINE_PATH} class="canada-silhouette" />
                {CANADA_REGION_PATHS.map((region) => (
                  <path d={region.d} class="canada-region" data-region={region.id}>
                    <title>{region.name}</title>
                  </path>
                ))}
                <path d={CANADA_OUTLINE_PATH} class="canada-outline" />
                {active.map((m) => {
                  if (m.lat == null || m.lng == null) return null
                  const { x, y } = projectToSvg(m.lat, m.lng)
                  return (
                    <circle
                      cx={x}
                      cy={y}
                      r="9"
                      class="canada-dot"
                      data-slug={m.slug}
                    >
                      <title>{m.name}{m.city ? ` — ${m.city}` : ''}</title>
                    </circle>
                  )
                })}
              </svg>
            </div>
          </div>

          <div class="tab-panel" id="tab-panel-discover" role="tabpanel">
            <div class="discover-view">
              <div class="discover-fade" id="discover-card">
                <div class="discover-name" id="discover-name"></div>
                <div class="discover-meta" id="discover-meta"></div>
                <a class="discover-visit" id="discover-visit" href="#" target="_blank" rel="noopener noreferrer">Visit site {raw('&rarr;')}</a>
              </div>
              <button class="discover-shuffle" id="discover-shuffle">{raw('&#x1F500;')} shuffle</button>
            </div>
          </div>
        </div>
      </div>
      {raw(`<script>var __discoverMembers = ${JSON.stringify(active.map(m => ({ slug: m.slug, name: m.name, url: m.url, city: m.city ?? '', type: m.type })))};</script>`)}
      {raw(`<script>
(function() {
  // Cross-panel hover: member list ↔ map dots
  var memberItems = document.querySelectorAll('[data-member-slug]');
  var mapDots = document.querySelectorAll('.canada-dot');

  memberItems.forEach(function(li) {
    var slug = li.getAttribute('data-member-slug');
    li.addEventListener('mouseenter', function() {
      mapDots.forEach(function(dot) {
        if (dot.getAttribute('data-slug') === slug) {
          dot.classList.add('is-highlighted');
        }
      });
    });
    li.addEventListener('mouseleave', function() {
      mapDots.forEach(function(dot) {
        dot.classList.remove('is-highlighted');
      });
    });
  });

  // Tab switching
  var tabs = document.querySelectorAll('.tab-btn');
  var panels = document.querySelectorAll('.tab-panel');

  tabs.forEach(function(tab) {
    tab.addEventListener('click', function() {
      tabs.forEach(function(t) {
        t.classList.remove('is-active');
        t.setAttribute('aria-selected', 'false');
      });
      panels.forEach(function(p) { p.classList.remove('is-active'); });

      tab.classList.add('is-active');
      tab.setAttribute('aria-selected', 'true');
      var panelId = 'tab-panel-' + tab.getAttribute('data-tab');
      document.getElementById(panelId).classList.add('is-active');
    });
  });

  // Discover — random member
  var discoverRecent = [];
  var discoverCard = document.getElementById('discover-card');
  var discoverName = document.getElementById('discover-name');
  var discoverMeta = document.getElementById('discover-meta');
  var discoverVisit = document.getElementById('discover-visit');

  function showRandomMember() {
    var available = __discoverMembers.filter(function(m) {
      return discoverRecent.indexOf(m.slug) === -1;
    });
    if (available.length === 0) {
      discoverRecent = [];
      available = __discoverMembers;
    }
    var member = available[Math.floor(Math.random() * available.length)];
    discoverRecent.push(member.slug);
    if (discoverRecent.length > Math.max(1, Math.floor(__discoverMembers.length / 2))) {
      discoverRecent.shift();
    }

    discoverCard.style.opacity = '0';
    setTimeout(function() {
      discoverName.textContent = member.name;
      discoverMeta.textContent = (member.city || '') + (member.city ? ' \u00b7 ' : '') + member.type;
      discoverVisit.href = member.url;
      discoverCard.style.opacity = '1';
    }, 150);
  }

  document.getElementById('discover-shuffle').addEventListener('click', showRandomMember);

  // Show first member when Discover tab is first opened
  var discoverInitialized = false;
  tabs.forEach(function(tab) {
    if (tab.getAttribute('data-tab') === 'discover') {
      tab.addEventListener('click', function() {
        if (!discoverInitialized) {
          discoverInitialized = true;
          showRandomMember();
        }
      });
    }
  });
})();
</script>`)}
    </Layout>
  )
})

export default app
