/**
 * Plug-in Tussenstand: teams en hun punten per ronde, met de hand ingevuld op de Mac. Geen
 * telefoons van teams en geen automatisch nakijken. De teams en punten staan op de quiz zelf:
 * `plugins.scores`. Een titelslide met `plugins.scores.standings` toont de stand; staat de plug-in
 * uit (of kent een oudere app hem niet), dan blijft het een gewone titelslide.
 */
import { z } from 'zod'
import { definePlugin, pluginData, setPluginData, typeOnly, type HasPlugins } from './plugin'
import { createSlide, hasAnswers, newId } from './factory'
import type { Quiz, Round, Slide } from './types'

const TeamSchema = z.object({ id: z.string(), name: z.string() })

/** Punten: niet negatief, hooguit één decimaal (halve punten). */
const PointsSchema = z.number().min(0).max(9999)

export const ScoresSchema = z.object({
  teams: z.array(TeamSchema).default([]),
  /** Per ronde-id, per team-id: de punten. Ontbreekt = nog niet ingevuld. */
  points: z.record(z.string(), z.record(z.string(), PointsSchema)).default({}),
  /** Alleen op een slide: die toont de stand van dat moment. */
  standings: z.literal(true).optional()
})

export type Scores = z.output<typeof ScoresSchema>
export type Team = z.output<typeof TeamSchema>

export const SCORES = definePlugin({
  id: 'scores',
  text: {
    nl: {
      name: 'Tussenstand',
      description: 'Teams en hun punten per ronde bijhouden, en de stand laten zien.'
    },
    en: {
      name: 'Scoreboard',
      description: 'Keep track of teams and their points per round, and show the standings.'
    }
  },
  config: z.object({}).catch({}),
  data: ScoresSchema,
  status: typeOnly<null>(),
  actions: {}
})

const EMPTY: Scores = { teams: [], points: {} }

/** De teams en punten van de quiz; nog niets = leeg. */
export function scoresOf(quiz: HasPlugins): Scores {
  return pluginData(SCORES, quiz) ?? structuredClone(EMPTY)
}

function save(quiz: HasPlugins, scores: Scores): void {
  const empty = !scores.teams.length && !Object.keys(scores.points).length
  setPluginData(SCORES, quiz, empty ? undefined : scores)
}

/**
 * De rondes met punten. Niet: antwoordenrondes (daar kijk je een andere ronde na) en rondes
 * zonder vragen, nummers, afbeeldingen of fragmenten, zoals een pauze (`hasAnswers`, issue #116).
 * Een ronde waar al punten in staan, houdt zijn kolom.
 */
export function scoredRounds(quiz: Quiz): Round[] {
  const { points } = scoresOf(quiz)
  return quiz.rounds.filter((r) => !r.answersFor.length && (hasAnswers(r) || r.id in points))
}

/**
 * Voor welke rondes vul je tijdens deze ronde punten in? Een gewone ronde: zichzelf, als die
 * punten krijgt (een pauze niet). Een antwoordenronde: de rondes die je dan nakijkt.
 */
export function roundsToScore(quiz: Quiz, round: Round): Round[] {
  const rounds = scoredRounds(quiz)
  if (!round.answersFor.length) return rounds.filter((r) => r.id === round.id)
  return rounds.filter((r) => round.answersFor.includes(r.id))
}

export function addTeam(quiz: HasPlugins, name: string): Team {
  const scores = scoresOf(quiz)
  const team = { id: newId(), name }
  scores.teams.push(team)
  save(quiz, scores)
  return team
}

export function renameTeam(quiz: HasPlugins, teamId: string, name: string): void {
  const scores = scoresOf(quiz)
  const team = scores.teams.find((t) => t.id === teamId)
  if (!team) return
  team.name = name
  save(quiz, scores)
}

/** Haalt een team weg, met al zijn punten. */
export function removeTeam(quiz: HasPlugins, teamId: string): void {
  const scores = scoresOf(quiz)
  scores.teams = scores.teams.filter((t) => t.id !== teamId)
  for (const [roundId, perTeam] of Object.entries(scores.points)) {
    delete perTeam[teamId]
    if (!Object.keys(perTeam).length) delete scores.points[roundId]
  }
  save(quiz, scores)
}

/** De punten van een team in een ronde; null of iets ongeldigs = niet ingevuld. */
export function setPoints(
  quiz: HasPlugins,
  roundId: string,
  teamId: string,
  points: number | null
): void {
  const scores = scoresOf(quiz)
  if (!scores.teams.some((t) => t.id === teamId)) return
  const perTeam = scores.points[roundId] ?? {}
  const valid = points !== null && PointsSchema.safeParse(points).success
  if (valid) perTeam[teamId] = Math.round(points * 10) / 10
  else delete perTeam[teamId]
  if (Object.keys(perTeam).length) scores.points[roundId] = perTeam
  else delete scores.points[roundId]
  save(quiz, scores)
}

/** Alle punten weg; de teams blijven staan. Voor een nieuwe avond met dezelfde quiz. */
export function clearPoints(quiz: HasPlugins): void {
  const scores = scoresOf(quiz)
  scores.points = {}
  save(quiz, scores)
}

export function pointsOf(scores: Scores, roundId: string, teamId: string): number | undefined {
  return scores.points[roundId]?.[teamId]
}

export interface Standing {
  team: Team
  total: number
  /** 1 = bovenaan; teams met evenveel punten delen een plaats. */
  place: number
}

/**
 * De stand: alle teams, de meeste punten bovenaan. Alleen rondes die nog in de quiz staan en
 * punten hebben, tellen mee. Gelijk = dezelfde plaats, en dan in de volgorde van de teams.
 */
export function standings(quiz: Quiz): Standing[] {
  const scores = scoresOf(quiz)
  const rounds = scoredRounds(quiz)
  const totals = scores.teams.map((team, index) => ({
    team,
    index,
    total:
      Math.round(
        rounds.reduce((sum, round) => sum + (pointsOf(scores, round.id, team.id) ?? 0), 0) * 10
      ) / 10
  }))
  totals.sort((a, b) => b.total - a.total || a.index - b.index)
  let place = 0
  return totals.map(({ team, total }, i) => {
    if (i === 0 || total !== totals[i - 1].total) place = i + 1
    return { team, total, place }
  })
}

/** Toont deze slide de stand? Alleen een titelslide. */
export function isStandingsSlide(slide: Slide): boolean {
  return slide.layout === 'title' && pluginData(SCORES, slide)?.standings === true
}

/** Een titelslide die de stand toont; de titel staat erboven. */
export function createStandingsSlide(title: string): Slide {
  const slide = createSlide('title', title)
  setPluginData(SCORES, slide, { standings: true })
  return slide
}
