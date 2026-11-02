import { describe, expect, it } from 'vitest'
import { hasAnswers } from '@shared/factory'
import { LOCALES } from '@shared/i18n'
import { migrateQuiz } from '@shared/migrate'
import { answerItems, findAssetUsages, findBrokenReferences } from '@shared/resolve'
import { freshTourQuiz } from './demo-fixture'

const tours = { nl: migrateQuiz(freshTourQuiz('nl')), en: migrateQuiz(freshTourQuiz('en')) }

describe.each(LOCALES)('rondleiding (%s)', (locale) => {
  const tour = tours[locale]
  const round = (id: string) => tour.rounds.find((r) => r.id === id)!
  const slides = tour.rounds.flatMap((r) => r.slides)

  it('is een geldige quiz die al zijn bestanden gebruikt, elk in een map', () => {
    expect(findBrokenReferences(tour)).toEqual([])
    expect(tour.assets.filter((a) => !findAssetUsages(tour, a.id).length)).toEqual([])
    expect(tour.assets.filter((a) => !a.folderId)).toEqual([])
  })

  it('legt elke ronde uit: een titelslide met uitleg, en notities voor de quizmaster', () => {
    for (const r of tour.rounds) {
      expect(r.slides[0], r.title).toMatchObject({ layout: 'title', body: expect.any(String) })
      expect(r.slides[0].body, r.title).not.toBe('')
      expect(r.hostNotes, r.title).toBeTruthy()
    }
  })

  it('laat de schermen en het geluid zien', () => {
    expect(tour.screens.map((s) => s.default.type).sort()).toEqual(['image', 'video'])
    // Slides op één scherm, en een vraag over de video heen.
    expect(slides.some((s) => s.targetScreens !== 'all')).toBe(true)
    expect(slides.some((s) => s.backdrop === 'over-video')).toBe(true)
    // Video met geluid via de speakers van het scherm.
    const screens = tour.rounds.flatMap((r) => Object.values(r.screens))
    expect(screens.some((c) => c.type === 'video' && c.volume)).toBe(true)
    // Achtergrondmuziek: alle vier de keuzes per ronde.
    const choices = tour.rounds.map((r) =>
      typeof r.background === 'object' ? 'replace' : r.background
    )
    expect(new Set(choices)).toEqual(new Set(['continue', 'duck', 'pause', 'replace']))
  })

  it('laat elke soort ronde zien', () => {
    // Vragen: met afbeelding, alleen het nummer, een eigen afbeelding bij het antwoord.
    expect(slides.some((s) => s.layout === 'question' && s.imageAssetId)).toBe(true)
    expect(slides.some((s) => s.numberOnly)).toBe(true)
    expect(slides.some((s) => s.answerImageAssetId)).toBe(true)
    // Muziek: nummer op één scherm, ingekorte fragmenten met fade, hoesjes bij de antwoorden.
    const music = round('muziek')
    expect(music.fragmentScreens).toEqual(['beamer'])
    expect(music.fragments.some((f) => f.end !== undefined && f.fadeOut)).toBe(true)
    expect(music.fragments.every((f) => f.answer && f.answerImageAssetId)).toBe(true)
    // Afbeeldingen die vanzelf rondgaan.
    expect(round('vlaggen').slideLoopSeconds).toBeGreaterThan(0)
    expect(round('vlaggen').slides.filter((s) => s.layout === 'image')).toHaveLength(6)
  })

  it('loopt in de antwoordenronde, na alle rondes, alle antwoorden langs', () => {
    const answers = round('antwoorden')
    const sources = tour.rounds.filter((r) => r !== answers && hasAnswers(r))
    expect(answers.answersFor).toEqual(sources.map((r) => r.id))
    const index = tour.rounds.indexOf(answers)
    expect(sources.every((r) => tour.rounds.indexOf(r) < index)).toBe(true)
    expect(answerItems(tour, answers).every((item) => item.answer)).toBe(true)
  })
})

const SAME_SONGS = [
  'Happy Birthday',
  'Jingle Bells',
  'Ode an die Freude (Beethoven)',
  'Für Elise (Beethoven)'
]

describe('Engelse rondleiding', () => {
  const { nl, en } = tours
  // Alle teksten van de quiz, zonder id's en bestandsnamen.
  const texts = (quiz: typeof en) => {
    const out: string[] = [quiz.title, ...quiz.folders.map((f) => f.name)]
    out.push(...quiz.screens.map((s) => s.name), ...quiz.channels.map((c) => c.name))
    for (const r of quiz.rounds) {
      out.push(r.title, r.hostNotes ?? '')
      for (const s of r.slides) out.push(s.title ?? '', s.body ?? '', s.answer ?? '')
      for (const f of r.fragments) out.push(f.label ?? '', f.answer ?? '')
    }
    return out
  }

  it('heeft dezelfde opbouw als de Nederlandse, met andere teksten en bestandsnamen', () => {
    const ids = (quiz: typeof en) => [
      ...quiz.assets.map((a) => a.id),
      ...quiz.rounds.flatMap((r) => [r.id, ...r.slides.map((s) => s.id)])
    ]
    expect(ids(en)).toEqual(ids(nl))
    expect(en.title).toBe('Tour')
    // Alleen antwoorden, titels van liedjes en de knop Start show heten in beide talen hetzelfde.
    const dutch = new Set(texts(nl))
    expect(new Set(texts(en).filter((text) => text && dutch.has(text)))).toEqual(
      new Set(['11', '1969', '7', 'Canberra', 'Japan', 'Start show', ...SAME_SONGS])
    )
    // De bestanden van die liedjes, en het logo.
    const files = new Set(nl.assets.map((a) => a.file))
    expect(en.assets.filter((a) => files.has(a.file)).map((a) => a.id)).toEqual([
      'liedje-3',
      'liedje-4',
      'liedje-5',
      'liedje-6',
      'hoes-3',
      'hoes-4',
      'hoes-5',
      'hoes-6',
      'logo'
    ])
  })
})
