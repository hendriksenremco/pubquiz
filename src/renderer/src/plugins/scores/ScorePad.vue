<script setup lang="ts">
import { computed } from 'vue'
import { formatPoints, pointsText, roundsToScore, scoresOf, standings } from '@shared/scores'
import { roundTitle } from '@shared/quiz-messages'
import type { Round } from '@shared/types'
import { locale } from '../../lib/locale'
import { useSession } from '../../stores/session'
import { enterPoints } from './enter-points'
import { SCORE_PAD_MESSAGES } from './messages'

/**
 * Tijdens de show: per team de punten van de ronde die nu loopt, of bij een antwoordenronde van
 * de rondes die je nakijkt. Teams toevoegen doe je bij Quiz-instellingen. Een ronde zonder punten
 * (een pauze, of een antwoordenronde die niets nakijkt) krijgt geen blok.
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
  <section v-if="rounds.length" class="card pad" data-testid="score-pad">
    <header class="card-head">
      <h3 class="grow">{{ t('title') }}</h3>
    </header>
    <div class="card-body">
      <p v-if="!scores.teams.length" class="muted empty">{{ t('noTeams') }}</p>
      <table v-else>
        <thead>
          <tr>
            <th class="team">{{ t('team') }}</th>
            <th v-for="r in rounds" :key="r.id" class="round" :title="roundTitle(r, locale)">
              {{ roundTitle(r, locale) }}
            </th>
            <th class="total">{{ t('total') }}</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="team in scores.teams" :key="team.id">
            <td class="team">{{ team.name }}</td>
            <td v-for="r in rounds" :key="r.id" class="round">
              <input
                :value="pointsText(scores, r.id, team.id, locale)"
                type="text"
                inputmode="decimal"
                class="input input-sm points mono"
                :aria-label="t('points', { team: team.name, round: roundTitle(r, locale) })"
                @change="enterPoints(quiz, r.id, team.id, $event, locale)"
              />
            </td>
            <td class="total mono">{{ formatPoints(totals.get(team.id) ?? 0, locale) }}</td>
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
/* De naam van een ronde past op één regel als er ruimte is; anders loopt hij door op de volgende. */
th.round {
  min-width: 80px;
  white-space: normal;
  overflow-wrap: anywhere;
  vertical-align: bottom;
}
td {
  padding: 3px 8px;
  border-top: 1px solid var(--line);
}
td.team {
  min-width: 180px;
  font-weight: 550;
  overflow-wrap: anywhere;
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
