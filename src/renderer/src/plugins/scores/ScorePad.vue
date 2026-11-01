<script setup lang="ts">
import { computed } from 'vue'
import { pointsOf, roundsToScore, scoresOf, standings } from '@shared/scores'
import type { Round } from '@shared/types'
import { locale } from '../../lib/locale'
import { useSession } from '../../stores/session'
import { enterPoints } from './enter-points'
import { SCORE_PAD_MESSAGES } from './messages'

/**
 * Tijdens de show: per team de punten van de ronde die nu loopt, of bij een antwoordenronde van
 * de rondes die je nakijkt. Teams toevoegen doe je bij Quiz-instellingen.
 */
const props = defineProps<{ round: Round }>()
const session = useSession()
const t = SCORE_PAD_MESSAGES.in(locale)
const quiz = computed(() => session.quiz!)
const scores = computed(() => scoresOf(quiz.value))
const rounds = computed(() => roundsToScore(quiz.value, props.round))
const totals = computed(
  () => new Map(standings(quiz.value).map((s) => [s.team.id, s.total] as const))
)
</script>

<template>
  <section class="card pad" data-testid="score-pad">
    <header class="card-head">
      <h3 class="grow">{{ t('title') }}</h3>
    </header>
    <div class="card-body">
      <p v-if="!scores.teams.length" class="muted empty">{{ t('noTeams') }}</p>
      <p v-else-if="!rounds.length" class="muted empty">{{ t('noRounds') }}</p>
      <table v-else>
        <thead>
          <tr>
            <th class="team">{{ t('team') }}</th>
            <th v-for="r in rounds" :key="r.id" class="round" :title="r.title">{{ r.title }}</th>
            <th class="total">{{ t('total') }}</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="team in scores.teams" :key="team.id">
            <td class="team">{{ team.name }}</td>
            <td v-for="r in rounds" :key="r.id" class="round">
              <input
                :value="pointsOf(scores, r.id, team.id) ?? ''"
                type="text"
                inputmode="decimal"
                class="input input-sm points mono"
                :aria-label="t('points', { team: team.name, round: r.title })"
                @change="enterPoints(quiz, r.id, team.id, $event)"
              />
            </td>
            <td class="total mono">{{ totals.get(team.id) ?? 0 }}</td>
          </tr>
        </tbody>
      </table>
    </div>
  </section>
</template>

<style scoped>
.empty {
  margin: 0;
}
table {
  border-collapse: collapse;
}
th {
  padding: 0 8px 6px;
  font-weight: 500;
  font-size: 12px;
  color: var(--muted);
  text-align: left;
  white-space: nowrap;
}
th.round {
  max-width: 120px;
  overflow: hidden;
  text-overflow: ellipsis;
}
td {
  padding: 3px 8px;
  border-top: 1px solid var(--line);
}
td.team {
  min-width: 180px;
  font-weight: 550;
}
.points {
  width: 64px;
  text-align: right;
}
.total {
  text-align: right;
  font-weight: 600;
}
</style>
