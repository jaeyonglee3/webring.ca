# webring.ca

A webring for Canadian builders — developers, designers, and founders sharing their work on the open web. Members link their personal sites together in a ring that visitors can navigate, discovering new Canadian creators along the way.

## Join the ring

1. Add the webring widget to your site (see below)
2. Fork this repo and add yourself to `members.json`:
   ```json
   {
     "slug": "your-name",
     "name": "Your Name",
     "url": "https://yoursite.ca",
     "city": "Toronto",
     "type": "developer",
     "active": true
   }
   ```
   Append your entry to the **bottom** of the array. `type` is one of: `developer`, `designer`, `founder`, `other`.
3. Open a pull request — CI will verify your site and we'll merge you in

**Requirements:** A personal site or project by a Canadian builder, with real content and the webring widget installed.

## Add the widget

### Option 1: Script embed (recommended)

Works with all frameworks and is always detectable by our health check. This is the recommended method.

```html
<div data-webring="ca" data-member="your-slug"></div>
<script src="https://webring.ca/embed.js" defer></script>
```

Add `data-theme="dark"` to the div if your site has a dark background.

If your site is a single-page app, always use this option. The plain HTML option may not be detectable by our health check on client-rendered sites.

### Option 2: Pure HTML (static sites only)

For simple static sites that don't load external scripts:

```html
<a href="https://webring.ca/prev/your-slug">&larr; prev</a>
<a href="https://webring.ca/random">🍁 webring.ca</a>
<a href="https://webring.ca/next/your-slug">next &rarr;</a>
```

### Framework examples

The script embed works with any framework. Place the snippet in your site's shared layout:

- **Next.js** — `app/layout.tsx` (in the `<body>`, before the closing tag)
- **Astro** — `src/layouts/Layout.astro` (in the `<body>`)
- **SvelteKit** — `src/app.html` (in the `<body>`)
- **Hugo** — `layouts/partials/footer.html`
- **Jekyll** — `_includes/footer.html`

These are the most common setups. The script embed works with any framework that renders HTML.

## API

`GET /api/members` — returns the active member list as JSON.

## Development

```bash
npm install
npm run dev        # starts wrangler dev server at localhost:8787
```

## Seed data

After creating a KV namespace, seed it with the member list:

```bash
npm run seed       # prints wrangler commands to run
```

The seed step now uses committed repo data only. Every member must already have resolvable coordinates from either:
- explicit `lat`/`lng` in `members.json`, or
- a city covered by the committed city map

If a contributor adds a city that is not yet covered, a maintainer can enrich coordinates locally before merge:

```bash
npm run enrich:coords
```

## Deploy

```bash
npm run deploy     # deploys via wrangler
```

## License

MIT
