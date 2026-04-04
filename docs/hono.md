# Hono Reference — Cloudflare Workers + JSX

Condensed reference for this project. Full docs: https://hono.dev/docs

## Setup (Cloudflare Workers)

```bash
npm create hono@latest my-app  # select cloudflare-workers template
cd my-app && npm i
npm run dev     # starts wrangler dev server at localhost:8787
npm run deploy  # deploys via wrangler
```

## Basic App

```typescript
import { Hono } from 'hono'

const app = new Hono()
app.get('/', (c) => c.text('Hello!'))

export default app
```

## Typed Bindings (KV, env vars)

Pass bindings as a generic to Hono. Access via `c.env`.

```typescript
type Bindings = {
  WEBRING: KVNamespace
  MY_VAR: string
}

const app = new Hono<{ Bindings: Bindings }>()

app.get('/', async (c) => {
  const data = await c.env.WEBRING.get('members')
  return c.text(data ?? 'empty')
})
```

## Routing

```typescript
// Path parameters
app.get('/next/:slug', (c) => {
  const slug = c.req.param('slug')
  return c.redirect(`https://example.com`, 302)
})

// Multiple methods
app.on(['GET', 'POST'], '/path', handler)

// Route groups via .route()
const api = new Hono()
api.get('/members', handler)
app.route('/api', api)
```

## Responses

```typescript
c.text('plain text')
c.json({ key: 'value' })
c.html(<Component />)          // JSX — returns text/html
c.redirect('/target', 302)     // redirect
c.body(null, 204)              // empty response with status
c.header('Cache-Control', 'public, max-age=300')  // set header before returning
```

## JSX (Server-Side Rendering)

Files must use `.tsx` extension. JSX is rendered to HTML strings on the server — no client hydration.

```tsx
import { Hono } from 'hono'
import type { FC } from 'hono/jsx'

const Layout: FC = (props) => {
  return (
    <html>
      <head>
        <meta charset="UTF-8" />
        <title>My Site</title>
      </head>
      <body>{props.children}</body>
    </html>
  )
}

const Page: FC<{ title: string }> = ({ title }) => {
  return (
    <Layout>
      <h1>{title}</h1>
    </Layout>
  )
}

const app = new Hono()
app.get('/', (c) => {
  return c.html(<Page title="Home" />)
})
```

## JSX Renderer Middleware

Sets a shared layout for all routes under a path. Use `c.render()` instead of `c.html()`.

```tsx
import { jsxRenderer } from 'hono/jsx-renderer'

app.use(
  '*',
  jsxRenderer(({ children }) => {
    return (
      <html>
        <body>
          <nav>Menu</nav>
          <div>{children}</div>
        </body>
      </html>
    )
  })
)

app.get('/', (c) => {
  return c.render(<h1>Hello!</h1>)
})

// Pass props to the layout:
app.get('/about', (c) => {
  return c.render(<h1>About</h1>, { title: 'About Page' })
})
```

## Middleware

```typescript
import { cors } from 'hono/cors'
import { logger } from 'hono/logger'
import { cache } from 'hono/cache'

// Apply to all routes
app.use('*', logger())

// Apply to specific paths
app.use('/api/*', cors({ origin: '*' }))

// Custom middleware
app.use('*', async (c, next) => {
  c.header('X-Custom', 'value')
  await next()
})
```

## Cron / Scheduled Events

Export a `scheduled` handler alongside the fetch handler.

```typescript
export default {
  fetch: app.fetch,
  scheduled: async (event: ScheduledEvent, env: Bindings, ctx: ExecutionContext) => {
    switch (event.cron) {
      case '0 0 * * *':   // daily
        await runHealthCheck(env)
        break
      case '0 0 * * 0':   // weekly (Sunday)
        await runShuffle(env)
        break
    }
  }
}
```

Configure in `wrangler.toml`:
```toml
[triggers]
crons = ["0 0 * * *", "0 0 * * 0"]
```

## wrangler.toml

```toml
name = "webring-ca"
main = "src/index.tsx"
compatibility_date = "2024-01-01"

[[kv_namespaces]]
binding = "WEBRING"
id = "your-kv-id"
preview_id = "your-preview-kv-id"

[triggers]
crons = ["0 0 * * *", "0 0 * * 0"]
```

## Testing

```typescript
import { describe, expect, it } from 'vitest'
import app from './index'

describe('routes', () => {
  it('should return 200 on /', async () => {
    const res = await app.request('http://localhost/')
    expect(res.status).toBe(200)
  })
})
```

## Hono + htmx Integration

To get TypeScript support for htmx attributes in JSX:

```typescript
// src/types.ts or global.d.ts
import type { HtmxAttributes } from 'typed-htmx'

declare module 'hono/jsx' {
  namespace JSX {
    interface HTMLAttributes extends HtmxAttributes {}
  }
}
```

Then use htmx attributes directly in JSX:
```tsx
<button hx-get="/api/data" hx-target="#result" hx-swap="innerHTML">
  Load
</button>
```