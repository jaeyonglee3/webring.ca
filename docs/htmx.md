# htmx Reference

Condensed reference for webring.ca v2 features. Full docs: https://htmx.org/docs/

NOTE: htmx is NOT used in v1. It's included in the layout via CDN for future use. Do not add htmx interactions until v2 features are being built.

## Installation

CDN script in the `<head>`:

```html
<script src="https://cdn.jsdelivr.net/npm/htmx.org@2.0.8/dist/htmx.min.js"></script>
```

No build step needed. ~14KB min+gzip.

## Core Concept

htmx lets any HTML element make AJAX requests and swap content, using HTML attributes instead of JavaScript.

```html
<!-- When clicked, GET /api/data and replace #result's content -->
<button hx-get="/api/data" hx-target="#result" hx-swap="innerHTML">
  Load Data
</button>
<div id="result"></div>
```

The server returns **HTML fragments**, not JSON. htmx swaps the fragment into the DOM.

## AJAX Attributes

| Attribute   | Description                          |
|-------------|--------------------------------------|
| `hx-get`    | Issues a GET to the given URL        |
| `hx-post`   | Issues a POST to the given URL       |
| `hx-put`    | Issues a PUT to the given URL        |
| `hx-patch`  | Issues a PATCH to the given URL      |
| `hx-delete` | Issues a DELETE to the given URL     |

## Targeting

`hx-target` specifies which element gets the response content.

```html
<!-- Replace a different element -->
<button hx-get="/search" hx-target="#results">Search</button>
<div id="results"></div>

<!-- CSS selectors work -->
<button hx-get="/data" hx-target="closest tr">Load</button>

<!-- Special values -->
hx-target="this"          <!-- the element itself -->
hx-target="closest .card" <!-- nearest ancestor matching selector -->
hx-target="next .output"  <!-- next sibling matching selector -->
hx-target="previous .msg" <!-- previous sibling matching selector -->
```

## Swapping

`hx-swap` controls how response content is inserted.

| Value         | Description                                    |
|---------------|------------------------------------------------|
| `innerHTML`   | Replace target's inner HTML (default)          |
| `outerHTML`   | Replace the entire target element              |
| `beforebegin` | Insert before the target                       |
| `afterbegin`  | Insert as first child of target                |
| `beforeend`   | Insert as last child of target (append)        |
| `afterend`    | Insert after the target                        |
| `delete`      | Delete the target element                      |
| `none`        | Don't swap (useful for side-effect-only calls) |

## Triggers

`hx-trigger` specifies what event triggers the request.

Defaults: `click` for most elements, `change` for inputs/selects, `submit` for forms.

```html
<!-- Trigger on keyup with 500ms debounce -->
<input hx-get="/search" hx-trigger="keyup changed delay:500ms"
       hx-target="#results" name="q">

<!-- Trigger once -->
<div hx-get="/load" hx-trigger="revealed">  <!-- fires when scrolled into view -->

<!-- Trigger on load -->
<div hx-get="/init" hx-trigger="load">

<!-- Polling -->
<div hx-get="/updates" hx-trigger="every 5s">
```

Trigger modifiers: `once`, `changed`, `delay:<time>`, `throttle:<time>`, `from:<selector>`

## Request Parameters

htmx includes the triggering element's `name` and `value` in the request. For inputs within a form, use `hx-include` to send additional fields:

```html
<input id="search" name="q" hx-get="/search" hx-include="[name='filter']">
<select name="filter">...</select>
```

## Indicators

Show a loading spinner during requests:

```html
<button hx-get="/slow" hx-indicator="#spinner">Load</button>
<img id="spinner" class="htmx-indicator" src="/spinner.svg">
```

The `htmx-indicator` class hides the element (opacity: 0). During a request, htmx adds `htmx-request` to the triggering element, which reveals child indicators.

## Common Patterns for webring.ca

### Tag filtering on directory (v2)

Server returns HTML fragment with filtered members:

```html
<!-- In directory page -->
<div id="member-list">
  <!-- Full member list rendered server-side -->
</div>

<button hx-get="/directory/filter?tag=rust" hx-target="#member-list" hx-swap="innerHTML">
  Rust
</button>
```

Hono route returns just the member list HTML fragment:
```tsx
app.get('/directory/filter', (c) => {
  const tag = c.req.query('tag')
  const members = filterByTag(tag)
  return c.html(<MemberList members={members} />)
})
```

### Live search (v2)

```html
<input name="q" hx-get="/directory/search" hx-trigger="keyup changed delay:300ms"
       hx-target="#member-list" hx-swap="innerHTML" placeholder="Search members...">
```

### Load more (v2)

```html
<button hx-get="/directory?page=2" hx-target="#member-list" hx-swap="beforeend">
  Load More
</button>
```

## Response Headers

Server can control htmx behavior via response headers:

| Header              | Effect                          |
|---------------------|---------------------------------|
| `HX-Redirect`      | Client-side redirect            |
| `HX-Refresh`       | Full page refresh               |
| `HX-Retarget`      | Override hx-target              |
| `HX-Reswap`        | Override hx-swap                |
| `HX-Push-Url`      | Push URL to browser history     |

## Out-of-Band Swaps

Update multiple elements from a single response:

```html
<!-- Response can include OOB elements -->
<div id="member-list">...filtered list...</div>
<div id="member-count" hx-swap-oob="true">42 members</div>
```

This replaces both `#member-list` (via normal swap) and `#member-count` (via OOB).