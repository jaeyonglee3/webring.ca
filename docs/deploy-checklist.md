# Pre-Deploy Checklist

## 1. Cloudflare Setup

- Create production and preview KV namespaces for `WEBRING`.
- Replace placeholder IDs in `wrangler.toml`.
- Confirm cron triggers are enabled for the deployed Worker.

## 2. Seed Initial Data

- Decide whether `members.json` is launch data or demo data.
- Remove any fake or placeholder members before launch.
- Run `npm run seed -- --remote` for production data.
- Run `npm run seed -- --remote --preview` for preview data.
- Verify both `members` and `ring-order` keys exist in KV.

## 3. Member Readiness

- Run `npm run validate` against the launch roster.
- Confirm every member site is reachable over HTTPS.
- Confirm every member site has the correct widget for its own slug.
- Confirm each member should start as `active: true`.

## 4. Local Verification

- Run `npm test`.
- Run `npm run typecheck`.
- Run `npm run typecheck:scripts`.
- Start `npm run dev` and manually test `/`, `/directory`, `/join`, `/api/members`, `/random`, `/next/:slug`, `/prev/:slug`, and `/embed.js`.

## 5. Launch Safety

- Verify redirects still work if KV `ring-order` is empty or stale.
- Verify scheduled health checks do not incorrectly deactivate valid members.
- Decide whether the 7-failure deactivation threshold is the launch policy.
- Check Worker logs after first deploy and after the first cron execution.

## 6. Public Launch Polish

- Add final metadata and social preview tags.
- Confirm the landing page content and member list are real.
- Confirm caching behavior matches how often membership changes.
- Document who owns post-launch triage for failed health checks and membership updates.
