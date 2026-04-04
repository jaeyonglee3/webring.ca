import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { geocodeCity } from './geocode'
import { getMemberCoordinates } from '../src/utils/member-coords'
import type { Member } from '../src/types'

const membersPath = resolve(import.meta.dirname!, '..', 'members.json')
const members = JSON.parse(readFileSync(membersPath, 'utf-8')) as Member[]

let updated = 0

for (const member of members) {
  if (getMemberCoordinates(member)) {
    continue
  }

  if (!member.city) {
    process.stderr.write(`Skipping ${member.slug}: no city or coordinates available.\n`)
    continue
  }

  const coords = await geocodeCity(member.city)
  if (!coords) {
    process.stderr.write(`Could not resolve ${member.slug} (${member.city}). Add lat/lng manually.\n`)
    continue
  }

  member.lat = coords.lat
  member.lng = coords.lng
  updated += 1
  process.stdout.write(`Resolved ${member.slug} (${member.city}) -> ${coords.lat}, ${coords.lng}\n`)
}

writeFileSync(membersPath, JSON.stringify(members, null, 2) + '\n')

process.stdout.write(updated > 0
  ? `Updated coordinates for ${updated} member${updated === 1 ? '' : 's'}.\n`
  : 'No member coordinates needed updates.\n')
