#!/usr/bin/env node
// Bouwt de app (pnpm build:unpack) en zet hem in /Applications, zonder de omweg via de dmg.
// Gebruik: pnpm install:mac
import { execFileSync, spawnSync } from 'node:child_process'
import { existsSync, readFileSync, rmSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const { productName } = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'))
const app = `${productName}.app`

// Een draaiende app vervangen kan een show onderbreken; eerst afsluiten, vóór het bouwen.
if (spawnSync('pgrep', ['-x', productName]).status === 0) {
  console.error(`${productName} draait nog. Sluit de app en probeer het opnieuw.`)
  process.exit(1)
}

execFileSync('pnpm', ['build:unpack'], { cwd: root, stdio: 'inherit' })

// electron-builder zet de app in dist/mac-arm64 (Apple Silicon) of dist/mac (Intel).
const source = ['mac-arm64', 'mac', 'mac-universal']
  .map((dir) => join(root, 'dist', dir, app))
  .find((path) => existsSync(path))
if (!source) throw new Error(`${app} niet gevonden in dist/`)

const target = join('/Applications', app)
rmSync(target, { recursive: true, force: true })
// ditto houdt de bundel intact: symlinks, rechten en de handtekening.
execFileSync('ditto', [source, target])
console.log(`${app} staat in /Applications`)
