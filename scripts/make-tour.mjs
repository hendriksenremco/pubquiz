#!/usr/bin/env node
// Genereert fixtures/rondleiding.pubquiz: een korte quiz die alle functies laat zien en op de
// slides zelf uitlegt. Beelden maakt ffmpeg; de muziek (bekende, rechtenvrije melodietjes)
// wordt hier gesynthetiseerd.
// Gebruik: pnpm tour [--force]
//          node scripts/make-tour.mjs --quiz-only <map>   (alleen een verse quiz.json, voor tests)
//          node scripts/make-tour.mjs --into <map>        (alles vers in een lege map, voor de build)
import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const argAfter = (flag) => {
  const index = process.argv.indexOf(flag)
  return index === -1 ? null : (process.argv[index + 1] ?? '')
}
const quizOnly = argAfter('--quiz-only') !== null
// Voor de build: altijd vers, zodat de app nooit een aangepaste of verouderde rondleiding meekrijgt.
const into = argAfter('--into')
const quizDir = argAfter('--quiz-only') ?? into ?? join(root, 'fixtures', 'rondleiding.pubquiz')
if (!quizDir) throw new Error('Gebruik: --quiz-only <map> of --into <map>')
// De map wordt eerst leeggemaakt; alleen binnen dist/, zodat een verkeerd pad niets wist.
if (into && !resolve(into).startsWith(join(root, 'dist') + sep)) {
  throw new Error('--into moet een map in dist/ zijn')
}
if (into) rmSync(into, { recursive: true, force: true })
const mediaDir = join(quizDir, 'media')
const force = process.argv.includes('--force') || into !== null
mkdirSync(mediaDir, { recursive: true })

const font = [
  '/System/Library/Fonts/Supplemental/Arial Bold.ttf',
  '/System/Library/Fonts/Helvetica.ttc'
].find((f) => existsSync(f))
const fontfile = font ? `fontfile='${font}':` : ''

/** Tekst gecentreerd op x, met `dy` pixels verschuiving vanaf het midden. */
const text = (label, size, color = 'white', dy = 0) =>
  `drawtext=${fontfile}text='${label}':fontcolor=${color}:fontsize=${size}:` +
  `x=(w-text_w)/2:y=(h-text_h)/2+${dy}`

function ffmpeg(output, args, input) {
  const target = join(mediaDir, output)
  if (quizOnly || (existsSync(target) && !force)) return
  execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', ...args, target], {
    input,
    stdio: [input ? 'pipe' : 'ignore', 'inherit', 'inherit'],
    maxBuffer: 1 << 30
  })
  console.log('✓', output)
}

// ── Geluid ──────────────────────────────────────────────────────────────────

const RATE = 44100
const pcmIn = ['-f', 's16le', '-ar', String(RATE), '-ac', '1', '-i', 'pipe:0']
const aacOut = ['-c:a', 'aac', '-b:a', '160k']

const STEPS = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 }
/** 'C4', 'F#4', 'Bb3' → frequentie; `shift` in halve tonen. */
function pitch(name, shift = 0) {
  const [, step, accidental, octave] = /^([A-G])([#b]?)(\d)$/.exec(name)
  const alter = accidental === '#' ? 1 : accidental === 'b' ? -1 : 0
  const midi = 12 * (Number(octave) + 1) + STEPS[step] + alter + shift
  return 440 * 2 ** ((midi - 69) / 12)
}

// Klankkleuren: deeltonen [verhouding, sterkte], uitsterven per seconde, aanzet en loslaten.
const PIANO = {
  partials: [
    [1, 1],
    [2, 0.45],
    [3, 0.2],
    [4, 0.08]
  ],
  decay: 2.4,
  attack: 0.005,
  release: 0.2
}
const MUSIC_BOX = {
  partials: [
    [1, 1],
    [3, 0.25],
    [5.2, 0.08]
  ],
  decay: 3.5,
  attack: 0.002,
  release: 0.3
}
const ORGAN = {
  partials: [
    [1, 1],
    [2, 0.6],
    [3, 0.35],
    [4, 0.2]
  ],
  decay: 0.1,
  attack: 0.03,
  release: 0.1
}
const BELL = {
  partials: [
    [1, 1],
    [2, 0.55],
    [2.76, 0.4],
    [5.4, 0.2]
  ],
  decay: 1.3,
  attack: 0.002,
  release: 0.5
}
const PAD = {
  partials: [
    [1, 1],
    [2, 0.3]
  ],
  decay: 0,
  attack: 0.6,
  release: 0.8
}
const BASS = {
  partials: [
    [1, 1],
    [2, 0.25]
  ],
  decay: 0.9,
  attack: 0.01,
  release: 0.3
}
const KEYS = {
  partials: [
    [1, 1],
    [2, 0.15],
    [3, 0.05]
  ],
  decay: 1.1,
  attack: 0.01,
  release: 0.4
}

/**
 * Telt een toon op in `buffer`. Met `wrap` loopt de staart door aan het begin, zodat een loop
 * naadloos rondgaat.
 */
function addNote(buffer, start, length, freq, timbre, gain, wrap = false) {
  const first = Math.round(start * RATE)
  const total = Math.round((length + timbre.release) * RATE)
  for (let i = 0; i < total; i++) {
    const t = i / RATE
    const release = t > length ? Math.max(0, 1 - (t - length) / timbre.release) : 1
    const env = Math.min(1, t / timbre.attack) * Math.exp(-timbre.decay * t) * release
    let value = 0
    for (const [ratio, strength] of timbre.partials) {
      value += strength * Math.sin(2 * Math.PI * freq * ratio * t)
    }
    let j = first + i
    if (j >= buffer.length) {
      if (!wrap) break
      j -= buffer.length
    }
    buffer[j] += gain * env * value
  }
}

/** 'C4 D4*2 -*.5 …': noot en lengte in tellen (standaard 1), '-' is een rust. */
function parse(score) {
  return score
    .trim()
    .split(/\s+/)
    .map((token) => {
      const [name, beats = '1'] = token.split('*')
      return { name, beats: Number(beats) }
    })
}

/** Melodie als los fragment, met een korte stilte ervoor en een staart erna. */
function melody(score, bpm, timbre, shift = 0) {
  const notes = parse(score)
  const beat = 60 / bpm
  const lead = 0.2
  const seconds = lead + notes.reduce((sum, n) => sum + n.beats, 0) * beat + 1
  const buffer = new Float32Array(Math.round(seconds * RATE))
  let at = lead
  for (const { name, beats } of notes) {
    if (name !== '-') addNote(buffer, at, beats * beat * 0.92, pitch(name, shift), timbre, 0.3)
    at += beats * beat
  }
  return buffer
}

/** Akkoordenschema als loop: bas, zacht tapijt en gebroken akkoorden; naadloos rond. */
function loopMusic({ chords, secondsPerChord, repeats, pattern, arpTimbre, shift = 0 }) {
  const seconds = chords.length * secondsPerChord * repeats
  const buffer = new Float32Array(Math.round(seconds * RATE))
  const step = secondsPerChord / pattern.length
  for (let r = 0; r < repeats; r++) {
    chords.forEach(({ bass, tones }, c) => {
      const start = (r * chords.length + c) * secondsPerChord
      addNote(buffer, start, secondsPerChord, pitch(bass, shift), BASS, 0.22, true)
      for (const tone of tones) {
        addNote(buffer, start, secondsPerChord * 0.9, pitch(tone, shift - 12), PAD, 0.035, true)
      }
      pattern.forEach((index, k) => {
        const tone = tones[index % tones.length]
        const up = index >= tones.length ? 12 : 0
        addNote(
          buffer,
          start + k * step,
          step * 1.6,
          pitch(tone, shift + up),
          arpTimbre,
          0.11,
          true
        )
      })
    })
  }
  return buffer
}

/** Klokslagen op vaste momenten (seconden). */
function bells(times, seconds, freq) {
  const buffer = new Float32Array(Math.round(seconds * RATE))
  for (const t of times) addNote(buffer, t, 1.2, freq, BELL, 0.4)
  return buffer
}

/** Naar 16-bit PCM, genormaliseerd zodat alles even luid klinkt. */
function pcm(buffer, peak = 0.85) {
  const max = buffer.reduce((m, v) => Math.max(m, Math.abs(v)), 0) || 1
  const out = Buffer.alloc(buffer.length * 2)
  buffer.forEach((v, i) => out.writeInt16LE(Math.round((v / max) * peak * 32767), i * 2))
  return out
}

const durationOf = (buffer) => Math.round((buffer.length / RATE) * 100) / 100

// ── Muziek ──────────────────────────────────────────────────────────────────

const background = loopMusic({
  chords: [
    { bass: 'C3', tones: ['C4', 'E4', 'G4'] },
    { bass: 'G2', tones: ['B3', 'D4', 'G4'] },
    { bass: 'A2', tones: ['A3', 'C4', 'E4'] },
    { bass: 'F2', tones: ['A3', 'C4', 'F4'] }
  ],
  secondsPerChord: 2,
  repeats: 4,
  pattern: [0, 1, 2, 3, 2, 1, 2, 1],
  arpTimbre: PIANO
})
ffmpeg('achtergrond.m4a', [...pcmIn, ...aacOut], pcm(background, 0.7))

const breakMusic = loopMusic({
  chords: [
    { bass: 'A2', tones: ['A3', 'C4', 'E4'] },
    { bass: 'F2', tones: ['A3', 'C4', 'F4'] },
    { bass: 'C3', tones: ['G3', 'C4', 'E4'] },
    { bass: 'G2', tones: ['G3', 'B3', 'D4'] }
  ],
  secondsPerChord: 2,
  repeats: 4,
  pattern: [0, 2, 1, 2, 3, 2, 1, 2],
  arpTimbre: KEYS
})
ffmpeg('pauzemuziek.m4a', [...pcmIn, ...aacOut], pcm(breakMusic, 0.7))

const SONGS = [
  {
    file: 'vader-jacob.m4a',
    answer: 'Vader Jacob',
    audio: melody('C4 D4 E4 C4 C4 D4 E4 C4 E4 F4 G4*2 E4 F4 G4*2', 120, PIANO)
  },
  {
    file: 'kortjakje.m4a',
    answer: 'Altijd is Kortjakje ziek',
    cover: ['Altijd is', 'Kortjakje ziek'],
    audio: melody('C4 C4 G4 G4 A4 A4 G4*2 F4 F4 E4 E4 D4 D4 C4*2', 110, MUSIC_BOX, 12)
  },
  {
    file: 'happy-birthday.m4a',
    answer: 'Happy Birthday',
    audio: melody(
      'G4*.75 G4*.25 A4 G4 C5 B4*2 G4*.75 G4*.25 A4 G4 D5 C5*2 ' +
        'G4*.75 G4*.25 G5 E5 C5 B4 A4*2 F5*.75 F5*.25 E5 C5 D5 C5*2',
      150,
      PIANO
    )
  },
  {
    file: 'jingle-bells.m4a',
    answer: 'Jingle Bells',
    audio: melody(
      'E4 E4 E4*2 E4 E4 E4*2 E4 G4 C4*1.5 D4*.5 E4*4 ' +
        'F4 F4 F4*1.5 F4*.5 F4 E4 E4 E4*.5 E4*.5 E4 D4 D4 E4 D4*2 G4*2',
      150,
      MUSIC_BOX,
      12
    )
  },
  {
    file: 'ode-an-die-freude.m4a',
    answer: 'Ode an die Freude (Beethoven)',
    cover: ['Ode an', 'die Freude'],
    // Ingekort met een fade: alleen de eerste helft.
    end: 8.5,
    fadeOut: 1.5,
    audio: melody(
      'E4 E4 F4 G4 G4 F4 E4 D4 C4 C4 D4 E4 E4*1.5 D4*.5 D4*2 ' +
        'E4 E4 F4 G4 G4 F4 E4 D4 C4 C4 D4 E4 D4*1.5 C4*.5 C4*2',
      120,
      ORGAN
    )
  },
  {
    file: 'fur-elise.m4a',
    answer: 'Für Elise (Beethoven)',
    end: 7,
    fadeOut: 1.5,
    audio: melody(
      'E5*.5 D#5*.5 E5*.5 D#5*.5 E5*.5 B4*.5 D5*.5 C5*.5 A4*1.5 C4*.5 E4*.5 A4*.5 B4*1.5 ' +
        'E4*.5 G#4*.5 B4*.5 C5*1.5 E4*.5 E5*.5 D#5*.5 E5*.5 D#5*.5 E5*.5 B4*.5 D5*.5 C5*.5 ' +
        'A4*1.5 C4*.5 E4*.5 A4*.5 B4*1.5 E4*.5 C5*.5 B4*.5 A4*3',
      132,
      PIANO
    )
  }
]
for (const song of SONGS) ffmpeg(song.file, [...pcmIn, ...aacOut], pcm(song.audio))

// ── Video's ─────────────────────────────────────────────────────────────────

// H.264, faststart, keyframe op 0; loops zonder geluidsspoor.
const h264 = ['-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '20', '-movflags', '+faststart']
const silent = [...h264, '-g', '30', '-an']

// Twee zachte gloeden die in 20 s rondcirkelen en precies terugkomen: naadloos te loopen.
// Klein berekend en opgeschaald; een gloed is toch al vaag.
const glow = (phase, rx, ry, size) =>
  `exp(-(pow(X-W*(0.5+${rx}*cos(2*PI*T/20+${phase})),2)+pow(Y-H*(0.5+${ry}*sin(2*PI*T/20+${phase})),2))/(2*pow(W*${size},2)))`
const amber = glow(0, 0.32, 0.28, 0.26)
const blue = glow(3.4, 0.3, 0.26, 0.24)
ffmpeg('welkom-loop.mp4', [
  '-f',
  'lavfi',
  '-i',
  'color=c=black:s=320x180:r=24:d=20',
  '-vf',
  `format=rgb24,geq=r='15+90*${amber}+30*${blue}':g='20+58*${amber}+38*${blue}':b='32+22*${amber}+95*${blue}',scale=1280:720:flags=bicubic`,
  ...silent
])

// Muziekronde: het spectrum van de achtergrondmuziek, in de kleuren van de app.
ffmpeg(
  'muziek-loop.mp4',
  [
    ...pcmIn,
    '-filter_complex',
    '[0:a]showcqt=s=1280x720:r=30:axis=0:basefreq=80:endfreq=2400:bar_v=6:sono_v=10:bar_g=2:cscheme=1|0.65|0.24|1|0.65|0.24[v]',
    '-map',
    '[v]',
    ...silent
  ],
  pcm(background)
)

ffmpeg('pauze-loop.mp4', [
  '-f',
  'lavfi',
  '-i',
  'life=size=320x180:rate=15:mold=10:ratio=0.1:seed=1:life_color=#ffa53d:death_color=#1a1208',
  '-t',
  '20',
  '-vf',
  'scale=1280:720:flags=neighbor',
  ...silent
])

// Ronde 4: een schijf die oplicht bij elke klokslag; het geluid zit in de video zelf.
const STRIKES = Array.from({ length: 7 }, (_, i) => 1.5 + i * 1.3)
const CLOCK_SECONDS = 12.5
const strike = `gte(T,1.5)*lt(T,${1.5 + 7 * 1.3})*exp(-2.6*mod(T-1.5,1.3))`
const disc = 'lt(hypot(X-W/2,Y-H/2),H*0.3)'
const halo = `(1-${disc})*exp(-(hypot(X-W/2,Y-H/2)-H*0.3)/(H*0.07))`
const channel = (base, dim, bright) =>
  `${base}+${disc}*(${dim - base}+${bright - dim}*${strike})+${halo}*${bright - base}*0.6*${strike}`
ffmpeg(
  'klokslagen.mp4',
  [
    '-f',
    'lavfi',
    '-i',
    `color=c=black:s=640x360:r=25:d=${CLOCK_SECONDS}`,
    ...pcmIn,
    '-vf',
    `format=rgb24,geq=r='${channel(15, 70, 255)}':g='${channel(20, 46, 165)}':b='${channel(32, 22, 61)}',scale=1280:720:flags=bicubic`,
    ...h264,
    '-g',
    '25',
    ...aacOut,
    '-shortest'
  ],
  pcm(bells(STRIKES, CLOCK_SECONDS, 330))
)

// ── Afbeeldingen ────────────────────────────────────────────────────────────

const still = (size, color = '0x0f1420') => [
  '-f',
  'lavfi',
  '-i',
  `color=c=${color}:s=${size}`,
  '-frames:v',
  '1'
]

// Standaard van de tv: een warme gloed met het logo klein in de hoek, zoals bij een zender.
// Zo botst het niet met de tekst van slides die eroverheen komen. Een achtergrond vult het hele
// scherm, dus op een 21:9-scherm valt er boven en onder 13% af en op een 4:3-beamer links en
// rechts; het logo staat daarom zo ver van de rand dat het altijd in beeld blijft.
const center = 'exp(-(pow(X-W/2,2)+pow(Y-H/2,2))/(2*pow(W*0.3,2)))'
ffmpeg('logo.png', [
  ...still('1280x720'),
  '-vf',
  `format=rgb24,geq=r='15+60*${center}':g='20+38*${center}':b='32+14*${center}',` +
    `drawtext=${fontfile}text='QuizNote':fontcolor=0xffa53d:fontsize=64:x=192:y=112`
])

/** Gekleurde schijven op een doorzichtige achtergrond: [x als deel van de breedte, rgb]. */
function discs(file, items) {
  const inside = (x) => `lt(hypot(X-W*${x},Y-H/2),H*0.24)`
  const mix = (k) => items.reduceRight((rest, [x, rgb]) => `if(${inside(x)},${rgb[k]},${rest})`, 0)
  const alpha = items.map(([x]) => inside(x)).join('+')
  ffmpeg(file, [
    ...still('1280x720'),
    '-vf',
    `format=rgba,geq=r='${mix(0)}':g='${mix(1)}':b='${mix(2)}':a='255*gt(${alpha},0)'`
  ])
}
discs('blauw-en-geel.png', [
  [0.34, [47, 111, 228]],
  [0.66, [255, 214, 10]]
])
discs('groen.png', [[0.5, [43, 179, 74]]])

// Vlaggen: drie banen, of een eigen tekening.
const bands = (direction, colors) => {
  const [a, b, c] = colors
  const box = (i, color) =>
    direction === 'vertical'
      ? `drawbox=x=${i * 300}:y=0:w=300:h=600:color=${color}:t=fill`
      : `drawbox=x=0:y=${i * 200}:w=900:h=200:color=${color}:t=fill`
  return [...still('900x600', a), '-vf', `${box(1, b)},${box(2, c)}`]
}
const FLAGS = [
  {
    file: 'vlag-italie.png',
    country: 'Italië',
    args: bands('vertical', ['0x009246', '0xffffff', '0xce2b37'])
  },
  {
    file: 'vlag-ierland.png',
    country: 'Ierland',
    args: bands('vertical', ['0x169b62', '0xffffff', '0xff883e'])
  },
  {
    file: 'vlag-belgie.png',
    country: 'België',
    args: bands('vertical', ['0x2d2926', '0xfdda24', '0xef3340'])
  },
  {
    file: 'vlag-oostenrijk.png',
    country: 'Oostenrijk',
    args: bands('horizontal', ['0xc8102e', '0xffffff', '0xc8102e'])
  },
  {
    file: 'vlag-japan.png',
    country: 'Japan',
    crop: '300:200:500:150',
    args: [
      ...still('900x600', 'white'),
      '-vf',
      "format=rgb24,geq=r='if(lt(hypot(X-W/2,Y-H/2),H*0.3),188,255)':g='if(lt(hypot(X-W/2,Y-H/2),H*0.3),0,255)':b='if(lt(hypot(X-W/2,Y-H/2),H*0.3),45,255)'"
    ]
  },
  {
    file: 'vlag-zweden.png',
    country: 'Zweden',
    crop: '300:200:220:180',
    args: [
      ...still('960x600', '0x006aa7'),
      '-vf',
      'drawbox=x=300:y=0:w=120:h=600:color=0xfecc00:t=fill,drawbox=x=0:y=240:w=960:h=120:color=0xfecc00:t=fill'
    ]
  }
]
for (const flag of FLAGS) {
  ffmpeg(flag.file, flag.args)
  // Een uitsnede als vraag; de hele vlag komt pas in de antwoordenronde in beeld.
  if (flag.crop) {
    ffmpeg(flag.file.replace('.png', '-uitsnede.png'), [
      '-i',
      join(mediaDir, flag.file),
      '-vf',
      `crop=${flag.crop},scale=900:600:flags=bicubic`
    ])
  }
}

// Hoesjes bij de liedjes, voor de antwoordenronde.
const COVER_COLORS = ['0xffa53d', '0x4fd69c', '0x8f7cff', '0xff4d6a', '0x3d9bff', '0xffd60a']
SONGS.forEach((song, i) => {
  const lines = song.cover ?? [song.answer.replace(/ \(.*\)$/, '')]
  const titles = lines.map((line, k) =>
    text(line, 64, '0x141414', (k - (lines.length - 1) / 2) * 78)
  )
  ffmpeg(song.file.replace('.m4a', '.png'), [
    ...still('800x800', COVER_COLORS[i]),
    '-vf',
    titles.join(',')
  ])
})

// ── De quiz ─────────────────────────────────────────────────────────────────

const asset = (id, kind, file, folderId, duration) => ({
  id,
  kind,
  file: `media/${file}`,
  name: file,
  ...(duration !== undefined ? { duration } : {}),
  folderId
})

const slide = (id, layout, title, body = '', extra = {}) => ({
  id,
  layout,
  title,
  body,
  targetScreens: 'all',
  backdrop: 'dim',
  ...extra
})
const beamerOnly = { targetScreens: ['beamer'] }

const round = (fields) => ({
  screens: {},
  mutedScreens: [],
  fragmentScreens: [],
  answersFor: [],
  slideLoopSeconds: null,
  background: 'continue',
  fragments: [],
  autoplay: { gapSeconds: 4, countdownOnScreen: true },
  ...fields
})

const quiz = {
  schemaVersion: 3,
  id: 'rondleiding',
  title: 'Rondleiding',
  folders: [
    { id: 'videos', name: "Video's" },
    { id: 'muziek', name: 'Muziek' },
    { id: 'liedjes', name: 'Liedjes' },
    { id: 'vlaggen', name: 'Vlaggen' },
    { id: 'afbeeldingen', name: 'Afbeeldingen' }
  ],
  assets: [
    asset('welkom-loop', 'video', 'welkom-loop.mp4', 'videos', 20),
    asset('muziek-loop', 'video', 'muziek-loop.mp4', 'videos', durationOf(background)),
    asset('pauze-loop', 'video', 'pauze-loop.mp4', 'videos', 20),
    asset('klokslagen', 'video', 'klokslagen.mp4', 'videos', CLOCK_SECONDS),
    asset('achtergrond', 'audio', 'achtergrond.m4a', 'muziek', durationOf(background)),
    asset('pauzemuziek', 'audio', 'pauzemuziek.m4a', 'muziek', durationOf(breakMusic)),
    ...SONGS.map((song, i) =>
      asset(`liedje-${i + 1}`, 'audio', song.file, 'liedjes', durationOf(song.audio))
    ),
    ...SONGS.map((song, i) =>
      asset(`hoes-${i + 1}`, 'image', song.file.replace('.m4a', '.png'), 'afbeeldingen')
    ),
    ...FLAGS.map((flag, i) => asset(`vlag-${i + 1}`, 'image', flag.file, 'vlaggen')),
    ...FLAGS.filter((f) => f.crop).map((flag) =>
      asset(
        `${flag.file.replace('.png', '')}-uitsnede`,
        'image',
        flag.file.replace('.png', '-uitsnede.png'),
        'vlaggen'
      )
    ),
    asset('logo', 'image', 'logo.png', 'afbeeldingen'),
    asset('blauw-en-geel', 'image', 'blauw-en-geel.png', 'afbeeldingen'),
    asset('groen', 'image', 'groen.png', 'afbeeldingen')
  ],
  screens: [
    { id: 'beamer', name: 'Beamer', default: { type: 'video', assetId: 'welkom-loop' } },
    { id: 'tv', name: 'TV bar', default: { type: 'image', assetId: 'logo' } }
  ],
  channels: [
    { id: 'zaal', name: 'Zaal', volume: 0.9 },
    { id: 'fragmenten', name: 'Fragmenten', volume: 1 }
  ],
  background: { assetId: 'achtergrond', channelId: 'zaal', volume: 0.5, duckTo: 0.25 },
  rounds: [
    round({
      id: 'welkom',
      title: 'Welkom',
      hostNotes:
        'Alleen jij ziet deze notities. Blader met → door de slides en start ronde 1 met Enter. ' +
        'In de mixer rechts zet je het volume per uitgang.',
      slides: [
        slide(
          'welkom-1',
          'title',
          'Welkom bij QuizNote',
          'Een korte quiz die laat zien wat de app kan.\nDruk op → voor de volgende slide.',
          beamerOnly
        ),
        slide(
          'welkom-2',
          'title',
          'Elk scherm z’n eigen beeld',
          'Deze slides staan alleen op de beamer; de tv in de bar houdt zijn logo.\n' +
            'Tussen de rondes tonen ze allebei hun standaard.',
          beamerOnly
        ),
        slide(
          'welkom-3',
          'title',
          'Achtergrondmuziek',
          'Speelt de hele avond door.\n' +
            'Elke ronde kiest zelf: doorspelen, zachter, pauzeren of andere muziek.',
          beamerOnly
        ),
        slide(
          'welkom-4',
          'title',
          'Bedienen',
          'Enter start de volgende ronde, E beëindigt hem.\n' +
            'B zet alle schermen op zwart, M zet het geluid uit.',
          beamerOnly
        ),
        slide('welkom-5', 'title', 'Klaar voor ronde 1?', 'Druk op Enter.', beamerOnly)
      ]
    }),
    round({
      id: 'vragen',
      title: 'Ronde 1: algemene kennis',
      background: 'duck',
      hostNotes:
        'Vraag 3 lees je zelf voor: op het scherm staat alleen het nummer. ' +
        'De achtergrondmuziek speelt in deze ronde zachter. ' +
        'Onder Afdrukken maak je van deze vragen een antwoordformulier.',
      slides: [
        slide(
          'vragen-titel',
          'title',
          'Ronde 1: algemene kennis',
          'Een vraag per slide, met het antwoord erbij.\n' +
            'Bij vraag 3 staat alleen het nummer in beeld: die leest de quizmaster voor.'
        ),
        slide('vragen-1', 'question', 'Vraag 1', 'Wat is de hoofdstad van Australië?', {
          answer: 'Canberra'
        }),
        slide('vragen-2', 'question', 'Vraag 2', 'Welke kleur krijg je als je deze twee mengt?', {
          imageAssetId: 'blauw-en-geel',
          answer: 'Groen',
          answerImageAssetId: 'groen'
        }),
        slide(
          'vragen-3',
          'question',
          'Vraag 3',
          'Hoeveel spelers van één team staan er bij voetbal op het veld?',
          { numberOnly: true, answer: '11' }
        ),
        slide('vragen-4', 'question', 'Vraag 4', 'Welk element heeft het symbool Fe?', {
          answer: 'IJzer'
        }),
        slide(
          'vragen-5',
          'question',
          'Vraag 5',
          'In welk jaar zette de eerste mens voet op de maan?',
          { answer: '1969' }
        )
      ]
    }),
    round({
      id: 'muziek',
      title: 'Ronde 2: muziek',
      screens: { beamer: { type: 'video', assetId: 'muziek-loop' } },
      fragmentScreens: ['beamer'],
      background: 'pause',
      hostNotes:
        'Druk op → of 1 voor het eerste liedje. A speelt ze allemaal na elkaar, met aftellen ' +
        'ertussen; spatie stopt. Liedje 5 en 6 zijn ingekort en faden uit. ' +
        'De achtergrondmuziek staat in deze ronde op pauze.',
      slides: [
        slide(
          'muziek-titel',
          'title',
          'Ronde 2: muziek',
          'Welk liedje hoor je?\n' +
            'De quizmaster speelt ze met 1–6 of →, of in één reeks met aftellen (A).\n' +
            'Het nummer staat alleen op de beamer.'
        )
      ],
      fragments: SONGS.map((song, i) => ({
        id: `liedje-${i + 1}`,
        label: `Liedje ${i + 1}`,
        assetId: `liedje-${i + 1}`,
        channelId: 'fragmenten',
        ...(song.end !== undefined ? { start: 0, end: song.end } : {}),
        fadeIn: 0,
        fadeOut: song.fadeOut ?? 0.5,
        answer: song.answer,
        answerImageAssetId: `hoes-${i + 1}`
      }))
    }),
    round({
      id: 'pauze',
      title: 'Pauze',
      screens: {
        beamer: { type: 'video', assetId: 'pauze-loop' },
        tv: { type: 'video', assetId: 'pauze-loop' }
      },
      background: { replaceAssetId: 'pauzemuziek' },
      hostNotes: 'Tijdens de pauze speelt andere muziek. Daarna start Enter de volgende ronde.',
      slides: [
        slide(
          'pauze-titel',
          'title',
          'Pauze',
          'Even andere muziek, en alle schermen tonen de pauze-loop.\n' +
            'Na de pauze start Enter de volgende ronde.'
        )
      ]
    }),
    round({
      id: 'vlaggen',
      title: 'Ronde 3: vlaggen',
      slideLoopSeconds: 5,
      hostNotes:
        'De vlaggen wisselen na de titelslide vanzelf, elke 5 seconden. Met L pauzeer je de ' +
        'loop, met ← → blader je zelf. In de antwoordenronde komt bij 5 en 6 de hele vlag in beeld.',
      slides: [
        slide(
          'vlaggen-titel',
          'title',
          'Ronde 3: vlaggen',
          'Van welk land is deze vlag?\n' +
            'De vlaggen lopen vanzelf rond. Bij 5 en 6 zie je maar een stukje.'
        ),
        ...FLAGS.map((flag, i) =>
          slide(`vlaggen-${i + 1}`, 'image', '', '', {
            imageAssetId: flag.crop ? `${flag.file.replace('.png', '')}-uitsnede` : `vlag-${i + 1}`,
            backdrop: { color: '#000000' },
            answer: flag.country,
            ...(flag.crop ? { answerImageAssetId: `vlag-${i + 1}` } : {})
          })
        )
      ]
    }),
    round({
      id: 'kijken',
      title: 'Ronde 4: kijken en luisteren',
      screens: { beamer: { type: 'video', assetId: 'klokslagen', volume: 1 } },
      background: 'pause',
      hostNotes:
        'Het geluid van deze video komt uit de speakers van de beamer; kies die bij Show ' +
        'voorbereiden. Druk op → voor de vraag: die staat over de video heen. ' +
        'Heeft een standaardvideo geluid, dan zet je dat per ronde uit bij Geluid van de video.',
      slides: [
        slide(
          'kijken-titel',
          'title',
          'Ronde 4: kijken en luisteren',
          'Deze video speelt zijn geluid af via de speakers van de beamer zelf.'
        ),
        slide('kijken-1', 'question', 'Vraag 1', 'Hoe vaak slaat de klok?', {
          backdrop: 'over-video',
          answer: '7'
        })
      ]
    }),
    round({
      id: 'antwoorden',
      title: 'Antwoorden',
      answersFor: ['vragen', 'muziek', 'vlaggen', 'kijken'],
      fragmentScreens: ['beamer'],
      background: 'duck',
      hostNotes:
        '← → lopen door de antwoorden van ronde 1 tot en met 4: eerst de vraag, dan het ' +
        'antwoord. Bij de liedjes, vraag 2 en vlag 5 en 6 komt een eigen afbeelding in beeld.',
      slides: [
        slide(
          'antwoorden-titel',
          'title',
          'Antwoorden',
          'Met → komt eerst de vraag terug (een liedje speelt opnieuw), daarna het antwoord.\n' +
            'Deze ronde zet je waar je wilt, ook pas aan het eind.'
        )
      ]
    }),
    round({
      id: 'slot',
      title: 'Tot slot',
      hostNotes:
        'Stop de show met Stop show. Valt de app tijdens een show uit, dan kun je bij het ' +
        'opnieuw openen verder waar je was.',
      slides: [
        slide(
          'slot-1',
          'title',
          'Afdrukken',
          'Een antwoordformulier voor de teams, een nakijkformulier en vragenkaarten voor jou.\n' +
            'In de editor onder Afdrukken.',
          beamerOnly
        ),
        slide(
          'slot-2',
          'title',
          'Show voorbereiden',
          'Koppel je schermen en speakers, speel een testtoon en zie vooraf of er bestanden ontbreken.',
          beamerOnly
        ),
        slide(
          'slot-3',
          'title',
          'Je eigen quiz',
          'Sleep je video’s, muziek en foto’s in Media en klik je rondes in elkaar.\n' +
            'Of begin met Nieuwe quiz op basis van deze.',
          beamerOnly
        ),
        slide('slot-4', 'title', 'Veel plezier!', '', beamerOnly)
      ]
    })
  ]
}

// Nooit een bestaande quiz.json overschrijven: wie de rondleiding opent en aanpast, houdt dat.
const quizFile = join(quizDir, 'quiz.json')
if (quizOnly || force || !existsSync(quizFile)) {
  writeFileSync(quizFile, JSON.stringify(quiz, null, 2))
  console.log(`✓ ${quizFile}`)
} else {
  console.log('• quiz.json bestaat al, niet overschreven (gebruik --force)')
}
