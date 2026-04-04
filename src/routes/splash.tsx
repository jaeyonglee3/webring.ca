import { Hono } from 'hono'
import { raw } from 'hono/html'
import type { Bindings } from '../types'
import { getActiveMembers } from '../data'
import { CANADA_VIEWBOX, CANADA_OUTLINE_PATH, projectToSvg } from '../lib/canada-map'
import { getMemberCoordinates } from '../utils/member-coords'

const app = new Hono<{ Bindings: Bindings }>()

app.get('/', async (c) => {
  c.header('Cache-Control', 'public, max-age=300')
  const active = await getActiveMembers(c.env.WEBRING)

  return c.html(
    <>
      {raw('<!DOCTYPE html>')}
      <html lang="en">
        <head>
          <meta charset="UTF-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1.0" />
          <title>webring.ca</title>
          <meta name="description" content="A webring for Canadian builders — developers, designers, and founders." />
          <link rel="preconnect" href="https://fonts.googleapis.com" />
          <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin="" />
          <link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700;800;900&amp;family=Space+Mono:wght@400;700&amp;display=swap" rel="stylesheet" />
          <style>{raw(`
            *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

            body {
              background-color: #F8F9FA;
              background-image: radial-gradient(circle at 2px 2px, #E5E7EB 1px, transparent 0);
              background-size: 40px 40px;
              overflow: hidden;
              height: 100vh;
              margin: 0;
              display: flex;
              align-items: center;
              justify-content: center;
              font-family: 'Space Grotesk', -apple-system, BlinkMacSystemFont, sans-serif;
              -webkit-font-smoothing: antialiased;
              user-select: none;
            }

            .splash-container {
              width: calc(100% - 5rem);
              height: calc(100% - 5rem);
              display: flex;
              flex-direction: column;
              justify-content: space-between;
              position: relative;
            }

            /* ── Poster typography ── */
            .poster-text {
              line-height: 0.72;
              letter-spacing: -0.05em;
              transform-origin: left top;
              text-transform: uppercase;
              font-weight: 900;
            }

            .stretch-wide {
              display: block;
            }

            .hero-top {
              font-size: 11vw;
              color: #111827;
              display: flex;
              flex-direction: column;
              align-items: flex-start;
            }

            .hero-bottom {
              width: 100%;
              container-type: inline-size;
            }

            .hero-bottom-inner {
              display: flex;
              align-items: center;
              justify-content: space-between;
              gap: 2cqw;
            }

            .hero-bottom-text {
              font-size: 14cqw;
              line-height: 0.75;
              white-space: nowrap;
            }

            .canada-flag {
              height: 10cqw;
              width: auto;
              flex-shrink: 0;
            }

            .flag-red { color: #AF272F; }

            .flag-white-outline {
              color: transparent;
              -webkit-text-stroke: 4px #AF272F;
            }

            /* ── Map ── */
            .canada-map-wrap {
              position: absolute;
              top: 50%;
              left: 50%;
              transform: translate(-50%, -50%);
            }

            .canada-map {
              width: 95vw;
              max-width: 1200px;
              height: auto;
            }

            .canada-outline {
              fill: none;
              stroke: #D1D5DB;
              stroke-width: 1.5;
              stroke-linejoin: round;
            }

            .canada-dot {
              fill: #AF272F;
              opacity: 0.7;
            }


            /* ── Responsive ── */
            @media (max-width: 767px) {
              .splash-container { width: calc(100% - 2.5rem); height: calc(100% - 2.5rem); }
              .hero-top { font-size: 16vw; }
              .flag-white-outline { -webkit-text-stroke: 2px #AF272F; }
            }
          `)}</style>
        </head>
        <body>
          <div class="splash-container">
            <header>
              <h1 class="poster-text hero-top">
                <span class="stretch-wide">WEBRING</span>
                <span class="stretch-wide">FOR</span>
              </h1>
            </header>

            <div class="canada-map-wrap">
              <svg
                class="canada-map"
                viewBox={CANADA_VIEWBOX}
                xmlns="http://www.w3.org/2000/svg"
                role="img"
                aria-label={`Map of Canada showing ${active.filter(m => getMemberCoordinates(m) != null).length} member locations`}
              >
                <path d={CANADA_OUTLINE_PATH} class="canada-outline" />
                {active.map((m) => {
                  const coords = getMemberCoordinates(m)
                  if (!coords) return null
                  const { x, y } = projectToSvg(coords.lat, coords.lng)
                  return (
                    <circle cx={x} cy={y} r="8" class="canada-dot">
                      <title>{m.name}{m.city ? ` — ${m.city}` : ''}</title>
                    </circle>
                  )
                })}
              </svg>
            </div>

            <footer>
              <div class="hero-bottom">
                <div class="hero-bottom-inner">
                  <h2 class="poster-text hero-bottom-text"><span class="flag-red">CA</span><span class="flag-white-outline">NA</span><span class="flag-red">DA</span></h2>
                  <img src="/canada-flag.svg" alt="Flag of Canada" class="canada-flag" />
                </div>
              </div>
            </footer>
          </div>


        </body>
      </html>
    </>
  )
})

export default app
