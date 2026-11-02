import { crc32, deflateRawSync, inflateRawSync } from 'zlib'

/**
 * Een kleine zip-lezer en -schrijver voor rondebestanden (issue #99), zonder `ditto`, zodat hij
 * ook in de tests op Linux werkt. Hij kent alleen wat rondebestanden nodig hebben: opgeslagen
 * (methode 0) en deflate (methode 8), zonder zip64 en zonder versleuteling.
 */

export class ZipError extends Error {}

export interface ZipEntry {
  /** Pad in de zip, met `/`; mappen staan er niet in. */
  name: string
  size: number
  read(): Buffer
}

const EOCD = 0x06054b50
const CENTRAL = 0x02014b50
const LOCAL = 0x04034b50

/** Leest de inhoudsopgave van een zip. De inhoud zelf pakt `read()` pas uit als je hem vraagt. */
export function readZip(zip: Buffer): ZipEntry[] {
  // Het einde van de inhoudsopgave staat in de laatste 22 bytes, plus hooguit 64 kB commentaar.
  let eocd = -1
  for (let i = zip.length - 22; i >= Math.max(0, zip.length - 22 - 0xffff); i--) {
    if (zip.readUInt32LE(i) === EOCD) {
      eocd = i
      break
    }
  }
  if (eocd < 0) throw new ZipError('Not a zip file')

  const count = zip.readUInt16LE(eocd + 10)
  const dirSize = zip.readUInt32LE(eocd + 12)
  let at = zip.readUInt32LE(eocd + 16)
  if (count === 0xffff || at === 0xffffffff || at + dirSize > eocd) {
    throw new ZipError('Unsupported zip file (zip64 or damaged)')
  }

  const entries: ZipEntry[] = []
  for (let n = 0; n < count; n++) {
    if (at + 46 > zip.length || zip.readUInt32LE(at) !== CENTRAL) {
      throw new ZipError('Damaged zip file')
    }
    const flags = zip.readUInt16LE(at + 8)
    const method = zip.readUInt16LE(at + 10)
    const packed = zip.readUInt32LE(at + 20)
    const size = zip.readUInt32LE(at + 24)
    const nameLength = zip.readUInt16LE(at + 28)
    const extraLength = zip.readUInt16LE(at + 30)
    const commentLength = zip.readUInt16LE(at + 32)
    const local = zip.readUInt32LE(at + 42)
    const name = zip.toString(flags & 0x800 ? 'utf8' : 'latin1', at + 46, at + 46 + nameLength)
    at += 46 + nameLength + extraLength + commentLength

    if (name.endsWith('/')) continue
    if (flags & 0x1) throw new ZipError(`Encrypted file in zip: ${name}`)
    if (method !== 0 && method !== 8) throw new ZipError(`Unsupported compression: ${name}`)
    if (packed === 0xffffffff || size === 0xffffffff) throw new ZipError('Unsupported zip64 file')

    entries.push({
      name,
      size,
      read() {
        if (local + 30 > zip.length || zip.readUInt32LE(local) !== LOCAL) {
          throw new ZipError(`Damaged zip file: ${name}`)
        }
        const start = local + 30 + zip.readUInt16LE(local + 26) + zip.readUInt16LE(local + 28)
        if (start + packed > zip.length) throw new ZipError(`Damaged zip file: ${name}`)
        const data = zip.subarray(start, start + packed)
        // Nooit meer uitpakken dan de zip belooft: geen zip-bom.
        let out: Buffer
        try {
          out =
            method === 0
              ? Buffer.from(data)
              : inflateRawSync(data, { maxOutputLength: Math.max(size, 1) })
        } catch {
          throw new ZipError(`Damaged zip file: ${name}`)
        }
        if (out.length !== size) throw new ZipError(`Damaged zip file: ${name}`)
        return out
      }
    })
  }
  return entries
}

/** Schrijft een zip met deflate. Voor de tests, en later om rondes te exporteren. */
export function writeZip(files: { name: string; data: Buffer | string }[]): Buffer {
  const locals: Buffer[] = []
  const central: Buffer[] = []
  let offset = 0
  for (const file of files) {
    const data = Buffer.isBuffer(file.data) ? file.data : Buffer.from(file.data)
    const packed = deflateRawSync(data)
    const name = Buffer.from(file.name)
    const crc = crc32(data)

    const local = Buffer.alloc(30)
    local.writeUInt32LE(LOCAL, 0)
    local.writeUInt16LE(20, 4)
    local.writeUInt16LE(0x800, 6)
    local.writeUInt16LE(8, 8)
    local.writeUInt32LE(crc, 14)
    local.writeUInt32LE(packed.length, 18)
    local.writeUInt32LE(data.length, 22)
    local.writeUInt16LE(name.length, 26)
    locals.push(local, name, packed)

    const entry = Buffer.alloc(46)
    entry.writeUInt32LE(CENTRAL, 0)
    entry.writeUInt16LE(20, 4)
    entry.writeUInt16LE(20, 6)
    entry.writeUInt16LE(0x800, 8)
    entry.writeUInt16LE(8, 10)
    entry.writeUInt32LE(crc, 16)
    entry.writeUInt32LE(packed.length, 20)
    entry.writeUInt32LE(data.length, 24)
    entry.writeUInt16LE(name.length, 28)
    entry.writeUInt32LE(offset, 42)
    central.push(entry, name)

    offset += local.length + name.length + packed.length
  }
  const dir = Buffer.concat(central)
  const end = Buffer.alloc(22)
  end.writeUInt32LE(EOCD, 0)
  end.writeUInt16LE(files.length, 8)
  end.writeUInt16LE(files.length, 10)
  end.writeUInt32LE(dir.length, 12)
  end.writeUInt32LE(offset, 16)
  return Buffer.concat([...locals, dir, end])
}
