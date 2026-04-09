import { raw } from 'hono/html'
import type { Member } from '../types'

export function DirectoryContent({ active }: { active: Member[] }) {
  const uniqueCities = new Set(active.map(m => m.city).filter(Boolean)).size

  const ringData = active.map(m => ({
    slug: m.slug,
    name: m.name,
    url: m.url,
    city: m.city,
  }))

  return (
    <div class="directory-inner">
      {raw(`<script id="ring-data" type="application/json">${JSON.stringify(ringData)}</script>`)}

      {/* Left: member directory */}
      <div class="directory-list-wrap">
        <div class="directory-list">
          <div class="directory-header">
            <span class="directory-header-name">Name</span>
            <span class="directory-header-site">Site</span>
            <span class="directory-header-city">City</span>
          </div>
          {active.map((m) => {
            const domain = m.url.replace(/^https?:\/\//, '').replace(/\/$/, '')
            return (
              <a
                href={m.url}
                target="_blank"
                rel="noopener noreferrer"
                class="directory-row"
                data-member={m.slug}
              >
                <span class="directory-row-name">{m.name}</span>
                <span class="directory-row-site">{domain}</span>
                <span class="directory-row-city">{m.city ?? ''}</span>
              </a>
            )
          })}
        </div>
      </div>

      {/* Right: D3 interactive ring */}
      <div class="directory-ring-wrap" id="directory-ring">
        <div id="ring-viz"></div>

      </div>
    </div>
  )
}
