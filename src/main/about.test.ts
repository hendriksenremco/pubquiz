import { readFileSync } from 'fs'
import { join } from 'path'
import { describe, expect, it } from 'vitest'
import { aboutPanelOptions } from './about'

const root = join(__dirname, '../..')
const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')) as { version: string }

describe('Over QuizNote', () => {
  it('toont de naam en het versienummer, zonder buildnummer erachter', () => {
    const options = aboutPanelOptions('QuizNote', '1.2.3')
    expect(options.applicationName).toBe('QuizNote')
    expect(options.applicationVersion).toBe('1.2.3')
    expect(options.version).toBe('')
  })
})

describe('CHANGELOG.md', () => {
  it('heeft een kop voor de versie in package.json', () => {
    const changelog = readFileSync(join(root, 'CHANGELOG.md'), 'utf8')
    const versions = [...changelog.matchAll(/^## (\d+\.\d+\.\d+)/gm)].map((m) => m[1])
    expect(versions[0]).toBe(pkg.version)
  })
})
