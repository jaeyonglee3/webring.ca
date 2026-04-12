import type { FC, PropsWithChildren } from 'hono/jsx'
import { raw } from 'hono/html'

const Layout: FC<PropsWithChildren<{ title?: string }>> = ({ title, children }) => {
  const pageTitle = title ? `${title} — webring.ca` : 'webring.ca'

  return (
    <>
      {raw('<!DOCTYPE html>')}
      <html lang="en">
        <head>
          <meta charset="UTF-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1.0" />
          <title>{pageTitle}</title>
          <meta name="robots" content="noindex" />
          <meta name="theme-color" content="#AF272F" />
          <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
          <link rel="preconnect" href="https://fonts.googleapis.com" />
          <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin="" />
          <link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&amp;display=swap" rel="stylesheet" />
          <style>{raw(`
            *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
            body {
              font-family: 'Space Grotesk', -apple-system, BlinkMacSystemFont, sans-serif;
              -webkit-font-smoothing: antialiased;
              line-height: 1.6;
              color: #1c1917;
              background: #f5f3f0;
              padding: 2.5rem;
            }
            @media (prefers-color-scheme: dark) {
              body { color: #e0ddd8; background: #13120f; }
              a { color: #f55; }
            }
            a { color: #AF272F; }
            :focus-visible { outline: 2px solid #AF272F; outline-offset: 2px; }
            h1 { font-size: 1.5rem; margin-bottom: 1rem; font-weight: 700; letter-spacing: -0.03em; }
            p { margin-bottom: 1rem; }
          `)}</style>
        </head>
        <body>
          {children}
        </body>
      </html>
    </>
  )
}

export default Layout
