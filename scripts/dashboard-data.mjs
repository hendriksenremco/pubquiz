#!/usr/bin/env node
// Maakt activiteit.json, todos.json en prs.json voor het statusdashboard,
// volgens docs/dashboard-bijwerken.md. Alleen `gh`, geen model.
//
//   node scripts/dashboard-data.mjs [map]      standaard: <tmp>/quiznote-dashboard
//
// De uitvoer bevat geen tijdstip van maken: is er niets gebeurd, dan is hij gelijk
// aan de vorige keer en hoeft het bestand niet opnieuw naar het dashboard.

import { execFileSync } from 'node:child_process'
import { mkdirSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'

const OWNER = 'hendriksenremco'
const APP = 'pubquiz'
const SITE = 'pubquiz-site'
const REMCO = 'hendriksenremco'
const DAGEN = 30
const MAX_ACTIVITEIT = 60
const MAX_PRS = 15

const ONDERWERPEN = [
  'doorlopend',
  'beslissing',
  'release',
  'kwaliteit',
  'engels',
  'site',
  'beheer',
  'juridisch'
]
const MAANDEN = 'jan feb mrt apr mei jun jul aug sep okt nov dec'.split(' ')

const TIJD_NL = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Europe/Amsterdam',
  year: 'numeric',
  month: 'numeric',
  day: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23'
})

function delenNl(iso) {
  return Object.fromEntries(TIJD_NL.formatToParts(new Date(iso)).map((p) => [p.type, p.value]))
}

/** "1 nov 09:12", in de tijd van Amsterdam. */
export function wanneer(iso) {
  const d = delenNl(iso)
  return `${Number(d.day)} ${MAANDEN[Number(d.month) - 1]} ${d.hour}:${d.minute}`
}

/** YYYY-MM-DD, in de tijd van Amsterdam. */
export function datum(iso) {
  const d = delenNl(iso)
  return `${d.year}-${d.month.padStart(2, '0')}-${d.day.padStart(2, '0')}`
}

export function heeftClaudeTrailer(bericht) {
  return /^co-authored-by:\s*claude\b/im.test(bericht ?? '')
}

/** Wie deed een run of release: Remco alleen als hij het zelf deed, zonder Claude in de commit. */
export function doorVanActie(actor, doorClaude) {
  return actor === REMCO && !doorClaude ? 'Remco' : 'Claude'
}

export function doorVanPr(pr) {
  if (pr.labels.includes('agent')) return 'Agent'
  return doorVanActie(pr.auteur, pr.berichten.some(heeftClaudeTrailer))
}

export function resultaatVanRun(run) {
  if (run.status !== 'completed') return 'bezig'
  return run.conclusion === 'success' ? 'gelukt' : 'mislukt'
}

export function onderdeelVan(labels) {
  return ONDERWERPEN.find((o) => labels.includes(o)) ?? 'overig'
}

export function wieVan(labels) {
  if (labels.includes('claude') && labels.includes('remco')) return 'Samen'
  if (labels.includes('remco') || labels.includes('vraag')) return 'Remco'
  return 'Claude'
}

function prioVan(labels) {
  const prio = labels.find((l) => /^prio-\d+$/.test(l))
  return prio ? Number(prio.slice(5)) : Infinity
}

/** Elk open issue zonder `later` of `idee`, op prio en daarna op nummer. */
export function maakTodos(issues) {
  return issues
    .filter((i) => !i.labels.includes('later') && !i.labels.includes('idee'))
    .sort((a, b) => {
      const pa = prioVan(a.labels)
      const pb = prioVan(b.labels)
      return pa === pb ? a.number - b.number : pa - pb
    })
    .map((i) => ({
      onderdeel: onderdeelVan(i.labels),
      wie: wieVan(i.labels),
      taak: `#${i.number} ${i.title}`
    }))
}

function ghJson(args) {
  return JSON.parse(execFileSync('gh', args, { encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 }))
}

/** Alle rijen van een REST-lijst, over alle pagina's. */
function restLijst(pad, jq = '.[]') {
  const uit = execFileSync('gh', ['api', '--paginate', '--jq', `${jq} | tojson`, pad], {
    encoding: 'utf8',
    maxBuffer: 256 * 1024 * 1024
  })
  return uit
    .split('\n')
    .filter(Boolean)
    .map((regel) => JSON.parse(regel))
}

function graphql(query, velden) {
  const args = ['api', 'graphql', '-f', `query=${query}`]
  for (const [naam, waarde] of Object.entries(velden)) {
    if (waarde !== null) args.push('-f', `${naam}=${waarde}`)
  }
  return ghJson(args).data.repository
}

const PR_VELDEN = `number title state createdAt closedAt updatedAt mergedAt
  author { login } mergeCommit { oid }
  labels(first: 30) { nodes { name } }
  commits(last: 100) { nodes { commit { message } } }`

const PR_QUERY = `query($owner: String!, $repo: String!, $cursor: String, $veld: IssueOrderField!) {
  repository(owner: $owner, name: $repo) {
    pullRequests(first: 50, after: $cursor, orderBy: { field: $veld, direction: DESC }) {
      pageInfo { hasNextPage endCursor }
      nodes { ${PR_VELDEN} }
    }
  }
}`

const ISSUE_QUERY = `query($owner: String!, $repo: String!, $cursor: String) {
  repository(owner: $owner, name: $repo) {
    issues(first: 50, after: $cursor, states: CLOSED, orderBy: { field: UPDATED_AT, direction: DESC }) {
      pageInfo { hasNextPage endCursor }
      nodes {
        number title closedAt updatedAt stateReason
        timelineItems(last: 1, itemTypes: [CLOSED_EVENT]) {
          nodes {
            ... on ClosedEvent {
              actor { login }
              closer { __typename ... on PullRequest { number } ... on Commit { message } }
            }
          }
        }
      }
    }
  }
}`

function naarPr(n) {
  return {
    ...n,
    labels: n.labels.nodes.map((l) => l.name),
    auteur: n.author?.login ?? '',
    berichten: n.commits.nodes.map((c) => c.commit.message),
    sha: n.mergeCommit?.oid ?? null
  }
}

/** Pull requests op volgorde van `veld`, tot `genoeg` zegt dat het klaar is. */
function haalPrs(repo, veld, genoeg) {
  const prs = []
  let cursor = null
  for (;;) {
    const pagina = graphql(PR_QUERY, { owner: OWNER, repo, cursor, veld }).pullRequests
    for (const n of pagina.nodes) {
      if (genoeg(n, prs.length)) return prs
      prs.push(naarPr(n))
    }
    if (!pagina.pageInfo.hasNextPage) return prs
    cursor = pagina.pageInfo.endCursor
  }
}

function haalGeslotenIssues(repo, grens) {
  const issues = []
  let cursor = null
  for (;;) {
    const pagina = graphql(ISSUE_QUERY, { owner: OWNER, repo, cursor }).issues
    for (const n of pagina.nodes) {
      if (n.updatedAt < grens) return issues
      issues.push(n)
    }
    if (!pagina.pageInfo.hasNextPage) return issues
    cursor = pagina.pageInfo.endCursor
  }
}

function haalRuns(repo, workflow, grens, branch) {
  const filter = `created=>=${grens.slice(0, 10)}&per_page=100${branch ? `&branch=${branch}` : ''}`
  return restLijst(
    `repos/${OWNER}/${repo}/actions/workflows/${workflow}/runs?${filter}`,
    '.workflow_runs[]'
  ).filter((r) => r.created_at >= grens)
}

function prRij(repo, pr) {
  return {
    id: `pr-${repo}-${pr.number}`,
    tijd: pr.mergedAt,
    wanneer: wanneer(pr.mergedAt),
    soort: 'PR',
    wat: `${repo === SITE ? 'Site: ' : ''}#${pr.number} ${pr.title}`,
    door: doorVanPr(pr),
    resultaat: 'samengevoegd'
  }
}

function maakActiviteit(grens) {
  // Per repo de samengevoegde PR's, ook om van een run te weten of Claude de commit maakte.
  const prsVan = (repo) =>
    haalPrs(repo, 'UPDATED_AT', (n) => n.updatedAt < grens).filter(
      (pr) => pr.mergedAt && pr.mergedAt >= grens
    )
  const appPrs = prsVan(APP)
  const sitePrs = prsVan(SITE)
  const perSha = new Map([...appPrs, ...sitePrs].filter((pr) => pr.sha).map((pr) => [pr.sha, pr]))
  const doorClaude = (sha, bericht) =>
    heeftClaudeTrailer(bericht) || (perSha.get(sha)?.berichten.some(heeftClaudeTrailer) ?? false)

  const rijen = [...appPrs.map((pr) => prRij(APP, pr)), ...sitePrs.map((pr) => prRij(SITE, pr))]

  const appRuns = haalRuns(APP, 'release.yml', grens)
  const runDoor = (r) =>
    doorVanActie(r.actor?.login, doorClaude(r.head_sha, r.head_commit?.message))
  const runRij = (repo, r, wat) => ({
    id: `run-${repo}-${r.id}`,
    tijd: r.created_at,
    wanneer: wanneer(r.created_at),
    soort: 'Deploy',
    wat,
    door: runDoor(r),
    resultaat: resultaatVanRun(r)
  })
  for (const r of appRuns) rijen.push(runRij(APP, r, `App: ${r.name}`))
  for (const r of haalRuns(SITE, 'deploy-site.yml', grens, 'master')) {
    const eerste = (r.head_commit?.message ?? '').split('\n')[0]
    rijen.push(runRij(SITE, r, `Site: ${eerste}`))
  }

  for (const rel of restLijst(`repos/${OWNER}/${APP}/releases?per_page=100`)) {
    const tijd = rel.published_at ?? rel.created_at
    if (tijd < grens) continue
    // Een release maakt de workflow (github-actions[bot]); wie hem startte, staat op de run.
    const run = appRuns
      .filter((r) => r.created_at <= tijd && r.conclusion === 'success')
      .sort((a, b) => b.created_at.localeCompare(a.created_at))[0]
    rijen.push({
      id: `rel-${rel.tag_name}`,
      tijd,
      wanneer: wanneer(tijd),
      soort: 'Release',
      wat: rel.tag_name,
      door: run ? runDoor(run) : 'Claude',
      resultaat: rel.draft || rel.prerelease ? 'concept' : 'gelukt'
    })
  }

  const prNummers = new Map(appPrs.map((pr) => [pr.number, pr]))
  for (const issue of haalGeslotenIssues(APP, grens)) {
    if (issue.stateReason !== 'COMPLETED' || issue.closedAt < grens) continue
    const gesloten = issue.timelineItems.nodes[0]
    const pr = gesloten?.closer?.number ? prNummers.get(gesloten.closer.number) : undefined
    rijen.push({
      id: `issue-${issue.number}`,
      tijd: issue.closedAt,
      wanneer: wanneer(issue.closedAt),
      soort: 'Taak',
      wat: `#${issue.number} ${issue.title}`,
      door: pr
        ? doorVanPr(pr)
        : doorVanActie(gesloten?.actor?.login, heeftClaudeTrailer(gesloten?.closer?.message)),
      resultaat: 'af'
    })
  }

  return rijen
    .sort((a, b) => b.tijd.localeCompare(a.tijd) || a.id.localeCompare(b.id))
    .slice(0, MAX_ACTIVITEIT)
}

function maakPrs() {
  return haalPrs(APP, 'CREATED_AT', (_n, aantal) => aantal >= MAX_PRS).map((pr) => ({
    nummer: pr.number,
    titel: pr.title,
    status: pr.mergedAt ? 'samengevoegd' : pr.state === 'OPEN' ? 'open' : 'gesloten',
    door: pr.labels.includes('agent') ? 'Agent' : 'Claude',
    datum: datum(pr.mergedAt ?? pr.closedAt ?? pr.createdAt)
  }))
}

function haalOpenIssues() {
  return restLijst(`repos/${OWNER}/${APP}/issues?state=open&per_page=100`)
    .filter((i) => !i.pull_request)
    .map((i) => ({ number: i.number, title: i.title, labels: i.labels.map((l) => l.name) }))
}

function main() {
  const map = process.argv[2] ?? join(tmpdir(), 'quiznote-dashboard')
  mkdirSync(map, { recursive: true })
  const grens = new Date(Date.now() - DAGEN * 24 * 60 * 60 * 1000).toISOString()
  const bestanden = {
    'activiteit.json': maakActiviteit(grens),
    'todos.json': maakTodos(haalOpenIssues()),
    'prs.json': maakPrs()
  }
  for (const [naam, rijen] of Object.entries(bestanden)) {
    const pad = join(map, naam)
    writeFileSync(pad, `${JSON.stringify(rijen, null, 2)}\n`)
    console.log(`${pad}: ${rijen.length} rijen`)
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main()
