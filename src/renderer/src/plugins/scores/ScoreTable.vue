<script setup lang="ts">
import { computed } from 'vue'
import {
  addTeam,
  clearPoints,
  pointsOf,
  removeTeam,
  renameTeam,
  scoredRounds,
  scoresOf,
  setPoints,
  standings
} from '@shared/scores'
import Icon from '../../components/Icon.vue'
import { ask } from '../../lib/confirm'
import { locale } from '../../lib/locale'
import { useSession } from '../../stores/session'
import { SCORE_TABLE_MESSAGES } from './messages'

/** Bij Quiz-instellingen: de teams, en per ronde hun punten. De stand komt op een slide. */
const session = useSession()
const t = SCORE_TABLE_MESSAGES.in(locale)
const quiz = computed(() => session.quiz!)
const scores = computed(() => scoresOf(quiz.value))
const rounds = computed(() => scoredRounds(quiz.value))
const totals = computed(
  () => new Map(standings(quiz.value).map((s) => [s.team.id, s.total] as const))
)
const hasPoints = computed(() => Object.keys(scores.value.points).length > 0)

function add() {
  addTeam(quiz.value, t('newTeam', { number: scores.value.teams.length + 1 }))
}

function rename(teamId: string, event: Event) {
  renameTeam(quiz.value, teamId, (event.target as HTMLInputElement).value)
}

function enter(roundId: string, teamId: string, event: Event) {
  const input = event.target as HTMLInputElement
  const raw = input.value.trim().replace(',', '.')
  setPoints(quiz.value, roundId, teamId, raw === '' ? null : Number(raw))
  // Ongeldig: het veld laat weer zien wat er bewaard is.
  input.value = String(pointsOf(scoresOf(quiz.value), roundId, teamId) ?? '')
}

async function remove(teamId: string, name: string) {
  const ok = await ask({
    title: t('removeTeamTitle', { name }),
    message: t('removeTeamMessage'),
    confirm: t('remove'),
    danger: true
  })
  if (ok) removeTeam(quiz.value, teamId)
}

async function clear() {
  const ok = await ask({
    title: t('clearTitle'),
    message: t('clearMessage'),
    confirm: t('clear'),
    danger: true
  })
  if (ok) clearPoints(quiz.value)
}
</script>

<template>
  <section data-testid="score-table">
    <div class="section-head">
      <h3>{{ t('title') }}</h3>
    </div>
    <div class="tile scores">
      <p v-if="!scores.teams.length" class="muted empty">{{ t('empty') }}</p>
      <div v-else class="table-wrap">
        <table>
          <thead>
            <tr>
              <th class="team">{{ t('team') }}</th>
              <th v-for="round in rounds" :key="round.id" class="round" :title="round.title">
                {{ round.title }}
              </th>
              <th class="total">{{ t('total') }}</th>
              <th />
            </tr>
          </thead>
          <tbody>
            <tr v-for="team in scores.teams" :key="team.id">
              <td class="team">
                <input
                  :value="team.name"
                  class="quiet"
                  :aria-label="t('teamName')"
                  @change="rename(team.id, $event)"
                />
              </td>
              <td v-for="round in rounds" :key="round.id" class="round">
                <input
                  :value="pointsOf(scores, round.id, team.id) ?? ''"
                  type="text"
                  inputmode="decimal"
                  class="input input-sm points mono"
                  :aria-label="t('points', { team: team.name, round: round.title })"
                  @change="enter(round.id, team.id, $event)"
                />
              </td>
              <td class="total mono">{{ totals.get(team.id) ?? 0 }}</td>
              <td class="del">
                <button
                  class="btn btn-ghost btn-sm btn-icon"
                  :aria-label="t('removeTeam')"
                  :title="t('removeTeam')"
                  @click="remove(team.id, team.name)"
                >
                  <Icon name="x" :size="14" />
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <div class="actions">
        <button class="btn btn-sm" @click="add">
          <Icon name="plus" :size="14" /> {{ t('addTeam') }}
        </button>
        <button v-if="hasPoints" class="btn btn-sm" @click="clear">
          <Icon name="trash" :size="14" /> {{ t('clearPoints') }}
        </button>
      </div>
    </div>
  </section>
</template>

<style scoped>
.scores {
  display: grid;
  gap: 12px;
  padding: 14px 16px;
}
.empty {
  margin: 0;
}
.table-wrap {
  overflow-x: auto;
}
table {
  border-collapse: collapse;
}
th {
  padding: 0 6px 6px;
  font-weight: 500;
  font-size: 12px;
  color: var(--muted);
  text-align: left;
  white-space: nowrap;
}
th.round {
  max-width: 96px;
  overflow: hidden;
  text-overflow: ellipsis;
}
td {
  padding: 3px 6px;
  border-top: 1px solid var(--line);
}
td.team {
  min-width: 160px;
}
td.team input {
  width: 100%;
}
.points {
  width: 64px;
  text-align: right;
}
.total {
  text-align: right;
  font-weight: 600;
}
.actions {
  display: flex;
  gap: 8px;
}
</style>
