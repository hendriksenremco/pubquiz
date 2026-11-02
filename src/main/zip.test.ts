import { execFileSync } from 'child_process'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { describe, expect, it } from 'vitest'
import { readZip, writeZip, ZipError } from './zip'

describe('zip', () => {
  it('leest terug wat hij schrijft, ook met een naam met accenten', () => {
    const big = Buffer.alloc(100_000, 7)
    const zip = writeZip([
      { name: 'ronde.json', data: '{"a":1}' },
      { name: 'media/Venetië.jpg', data: big }
    ])
    const entries = readZip(zip)
    expect(entries.map((e) => [e.name, e.size])).toEqual([
      ['ronde.json', 7],
      ['media/Venetië.jpg', 100_000]
    ])
    expect(entries[0].read().toString()).toBe('{"a":1}')
    expect(entries[1].read().equals(big)).toBe(true)
  })

  it('schrijft een zip die unzip ook kan lezen', () => {
    const dir = mkdtempSync(join(tmpdir(), 'pubquiz-zip-'))
    try {
      const file = join(dir, 'test.zip')
      writeFileSync(file, writeZip([{ name: 'map/a.txt', data: 'hallo' }]))
      let out: string
      try {
        out = execFileSync('unzip', ['-p', file, 'map/a.txt'], { encoding: 'utf8' })
      } catch {
        return // geen unzip op deze machine
      }
      expect(out).toBe('hallo')
      expect(readZip(readFileSync(file))[0].read().toString()).toBe('hallo')
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  it('weigert iets wat geen zip is', () => {
    expect(() => readZip(Buffer.from('dit is tekst, geen zip'))).toThrow(ZipError)
    expect(() => readZip(Buffer.alloc(0))).toThrow(ZipError)
  })

  it('weigert kapotte inhoud en pakt nooit meer uit dan beloofd', () => {
    const zip = writeZip([{ name: 'a.txt', data: Buffer.alloc(5000, 1) }])
    // Beloof minder bytes dan erin zit, in de inhoudsopgave.
    const central = zip.indexOf(Buffer.from([0x50, 0x4b, 0x01, 0x02]))
    zip.writeUInt32LE(10, central + 24)
    expect(() => readZip(zip)[0].read()).toThrow(ZipError)
  })
})
