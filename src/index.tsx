import { Hono } from 'hono'
import type { Bindings } from './types'
import Layout from './templates/Layout'
import splash from './routes/splash'
import redirect from './routes/redirect'
import api from './routes/api'
import { runHealthCheck } from './cron/healthcheck'
import { runShuffle } from './cron/shuffle'

const app = new Hono<{ Bindings: Bindings }>()

app.route('/', splash)
app.route('/', redirect)
app.route('/api', api)

app.notFound((c) => {
  return c.html(
    <Layout title="Not Found">
      <h1>404</h1>
      <p>Page not found. <a href="/">Go home</a></p>
    </Layout>,
    404
  )
})

app.onError((_err, c) => {
  return c.html(
    <Layout title="Error">
      <h1>Something went wrong</h1>
      <p>Please try again later. <a href="/">Go home</a></p>
    </Layout>,
    500
  )
})

export default {
  fetch: app.fetch,
  scheduled: async (event: ScheduledEvent, env: { WEBRING: KVNamespace }, ctx: ExecutionContext) => {
    switch (event.cron) {
      case '0 0 * * *':
        ctx.waitUntil(runHealthCheck(env.WEBRING))
        break
      case '0 0 * * SUN':
        ctx.waitUntil(runShuffle(env.WEBRING))
        break
    }
  },
}
