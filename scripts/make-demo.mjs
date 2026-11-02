#!/usr/bin/env node
// Genereert fixtures/demo.pubquiz met testvideo's, -beelden en -tonen via ffmpeg.
// Gebruik: pnpm demo [--force]
//          node scripts/make-demo.mjs --quiz-only <map>   (alleen een verse quiz.json, voor tests)
import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const quizOnlyIndex = process.argv.indexOf('--quiz-only')
const quizOnly = quizOnlyIndex !== -1
const quizDir = quizOnly ? process.argv[quizOnlyIndex + 1] : join(root, 'fixtures', 'demo.pubquiz')
if (!quizDir) throw new Error('Gebruik: --quiz-only <map>')
const mediaDir = join(quizDir, 'media')
const force = process.argv.includes('--force')
mkdirSync(mediaDir, { recursive: true })

const font = [
  '/System/Library/Fonts/Supplemental/Arial Bold.ttf',
  '/System/Library/Fonts/Helvetica.ttc'
].find((f) => existsSync(f))
const text = (label, size = 96) =>
  `drawtext=${font ? `fontfile='${font}':` : ''}text='${label}':fontcolor=white:fontsize=${size}:` +
  'x=(w-text_w)/2:y=(h-text_h)/2:box=1:boxcolor=black@0.5:boxborderw=24'

function ffmpeg(output, args) {
  const target = join(mediaDir, output)
  if (quizOnly || (existsSync(target) && !force)) return
  execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', ...args, target], {
    stdio: 'inherit'
  })
  console.log('✓', output)
}

// Video's voor loops: H.264, faststart, keyframe op 0, geen audiotrack.
const videoOut = [
  '-c:v',
  'libx264',
  '-pix_fmt',
  'yuv420p',
  '-g',
  '30',
  '-an',
  '-movflags',
  '+faststart'
]
ffmpeg('default-loop.mp4', [
  '-f',
  'lavfi',
  '-i',
  'testsrc2=size=1280x720:rate=30:duration=8',
  '-vf',
  text('STANDAARD LOOP'),
  ...videoOut
])
ffmpeg('music-loop.mp4', [
  '-f',
  'lavfi',
  '-i',
  'mandelbrot=size=1280x720:rate=30',
  '-t',
  '8',
  '-vf',
  text('MUZIEKRONDE'),
  ...videoOut
])
ffmpeg('pause-loop.mp4', [
  '-f',
  'lavfi',
  '-i',
  'life=size=320x180:rate=15:mold=10:ratio=0.1:seed=1:life_color=#ff7a1a:death_color=#20120a',
  '-t',
  '8',
  '-vf',
  `scale=1280:720:flags=neighbor,${text('PAUZE')}`,
  ...videoOut
])
ffmpeg('logo.png', [
  '-f',
  'lavfi',
  '-i',
  'color=c=0x1d2433:size=1280x720',
  '-frames:v',
  '1',
  '-vf',
  text('PUBQUIZ', 160)
])

// Achtergrondmuziek: zacht akkoord dat langzaam pulseert (30 s, naadloos te loopen).
const chord = (base) =>
  `0.12*sin(2*PI*${base}*t)+0.08*sin(2*PI*${base * 1.25}*t)+0.08*sin(2*PI*${base * 1.5}*t)`
ffmpeg('background.m4a', [
  '-f',
  'lavfi',
  '-i',
  `aevalsrc='(${chord(220)})*(0.6+0.4*sin(2*PI*t/7.5))':s=44100:d=30`,
  '-c:a',
  'aac',
  '-b:a',
  '128k'
])
ffmpeg('background-break.m4a', [
  '-f',
  'lavfi',
  '-i',
  `aevalsrc='(${chord(174.6)})*(0.6+0.4*sin(2*PI*t/5))':s=44100:d=30`,
  '-c:a',
  'aac',
  '-b:a',
  '128k'
])

// 8 fragmenten: elk een eigen toonhoogte en ritme, 6 s.
const notes = [262, 294, 330, 349, 392, 440, 494, 523]
notes.forEach((freq, i) => {
  const beeps = i + 1
  ffmpeg(`fragment-${i + 1}.m4a`, [
    '-f',
    'lavfi',
    '-i',
    `aevalsrc='0.4*sin(2*PI*${freq}*t)*lt(mod(t*${beeps}/2,1),0.6)':s=44100:d=6`,
    '-c:a',
    'aac',
    '-b:a',
    '128k'
  ])
})

const asset = (id, kind, file, duration, folderId) => ({
  id,
  kind,
  file: `media/${file}`,
  name: file,
  duration,
  ...(folderId ? { folderId } : {})
})
const fragments = (round, ids) =>
  ids.map((n) => ({
    id: `${round}-f${n}`,
    label: `Fragment ${n}`,
    assetId: `frag${n}`,
    channelId: 'fragmenten',
    start: 0,
    end: 5,
    fadeIn: 0,
    fadeOut: 0.5,
    answer: `Antwoord ${n}`
  }))
const autoplay = { gapSeconds: 4, countdownOnScreen: true }
const titleSlide = (id, title, body = '') => ({
  id,
  layout: 'title',
  title,
  body,
  targetScreens: 'all',
  backdrop: 'dim'
})

const quiz = {
  schemaVersion: 3,
  id: 'demo',
  title: 'Demo-pubquiz',
  folders: [
    { id: 'loops', name: 'Loops' },
    { id: 'fragmenten', name: 'Fragmenten' }
  ],
  assets: [
    asset('loop', 'video', 'default-loop.mp4', 8, 'loops'),
    asset('music-loop', 'video', 'music-loop.mp4', 8, 'loops'),
    asset('pause-loop', 'video', 'pause-loop.mp4', 8, 'loops'),
    asset('logo', 'image', 'logo.png'),
    asset('bg', 'audio', 'background.m4a', 30),
    asset('bg-break', 'audio', 'background-break.m4a', 30),
    ...notes.map((_, i) => asset(`frag${i + 1}`, 'audio', `fragment-${i + 1}.m4a`, 6, 'fragmenten'))
  ],
  screens: [
    { id: 'beamer', name: 'Beamer', default: { type: 'video', assetId: 'loop' } },
    { id: 'tv', name: 'TV bar', default: { type: 'image', assetId: 'logo' } }
  ],
  channels: [
    { id: 'zaal', name: 'Zaal', volume: 0.9 },
    { id: 'fragmenten', name: 'Fragmenten', volume: 1 }
  ],
  background: { assetId: 'bg', channelId: 'zaal', volume: 0.6, duckTo: 0.2 },
  rounds: [
    {
      id: 'r1',
      title: 'Ronde 1: algemeen',
      hostNotes: 'Vragen staan op papier. Antwoorden: zie map.',
      screens: {},
      slides: [
        titleSlide('r1-s0', 'Ronde 1', 'Algemene kennis'),
        {
          id: 'r1-s1',
          layout: 'question',
          title: 'Vraag 1',
          body: 'Wat is de hoofdstad van Australië?',
          targetScreens: 'all',
          backdrop: 'dim',
          answer: 'Canberra'
        },
        {
          id: 'r1-s2',
          layout: 'number',
          title: '2',
          targetScreens: 'all',
          backdrop: 'over-video',
          answer: 'Mount Everest'
        }
      ],
      background: 'continue',
      fragments: [],
      fragmentScreens: [],
      autoplay
    },
    {
      id: 'r2',
      title: 'Ronde 2: muziek',
      hostNotes: 'Speel de 8 fragmenten; achtergrond staat op pauze.',
      screens: { beamer: { type: 'video', assetId: 'music-loop' } },
      slides: [titleSlide('r2-s0', 'Ronde 2', 'Muziek: 8 fragmenten')],
      background: 'pause',
      fragments: fragments('r2', [1, 2, 3, 4, 5, 6, 7, 8]),
      fragmentScreens: ['beamer'],
      autoplay
    },
    {
      id: 'r3',
      title: 'Pauze',
      screens: {
        beamer: { type: 'video', assetId: 'pause-loop' },
        tv: { type: 'video', assetId: 'pause-loop' }
      },
      slides: [titleSlide('r3-s0', 'Pauze', 'Tot zo!')],
      background: { replaceAssetId: 'bg-break' },
      fragments: [],
      fragmentScreens: [],
      autoplay
    },
    {
      id: 'r4',
      title: 'Ronde 4: intro’s',
      screens: { beamer: { type: 'video', assetId: 'music-loop' } },
      slides: [titleSlide('r4-s0', 'Ronde 4', 'Herken de intro')],
      background: 'duck',
      fragments: fragments('r4', [8, 7, 6, 5, 4, 3, 2, 1]),
      fragmentScreens: ['beamer'],
      autoplay: { ...autoplay, gapSeconds: 3 }
    }
  ]
}

// Een bestaande demo-quiz nooit overschrijven: daar kan echt werk in zitten (geïmporteerde media,
// eigen rondes). Alleen met --force, of bij --quiz-only (verse kopie in een tijdelijke testmap).
const quizFile = join(quizDir, 'quiz.json')
if (quizOnly || force || !existsSync(quizFile)) {
  writeFileSync(quizFile, JSON.stringify(quiz, null, 2) + '\n')
  if (!quizOnly) console.log('✓ quiz.json →', quizDir)
} else {
  console.log('• quiz.json bestaat al, niet overschreven (gebruik --force)')
}
