export function AboutContent() {
  return (
    <div class="about-inner">
      {/* Left: text */}
      <div class="about-left">
        <h2 class="about-headline poster-text">What is a<br />Webring?</h2>
        <div class="about-lead">
          <p>
            Webrings were one of the earliest ways people discovered new
            corners of the web. Each member links to the next, forming
            a loop you can follow from site to site.
          </p>
          <p>
            We're bringing that idea back for Canadian builders.
            Developers, designers, and founders with personal sites,
            connected across the country.
          </p>
          <p>
            Open source and community-run. No algorithms, no feeds, no ads.
            Just people linking to people.
          </p>
        </div>
      </div>

      {/* Right: visuals */}
      <div class="about-right">
        <img src="/maple-leaf.svg" alt="" aria-hidden="true" class="about-leaf-bg" />
        <picture>
          <source srcset="/old-webrings.webp" type="image/webp" />
          <img src="/old-webrings.png" alt="" aria-hidden="true" class="about-nostalgia" loading="lazy" width="1013" height="740" />
        </picture>
      </div>
    </div>
  )
}
