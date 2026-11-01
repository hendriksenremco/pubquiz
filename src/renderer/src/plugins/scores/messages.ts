import { defineMessages } from '@shared/i18n'

/** De tabel met teams en punten, bij Quiz-instellingen (ScoreTable). */
export const SCORE_TABLE_MESSAGES = defineMessages(
  {
    title: 'Tussenstand',
    team: 'Team',
    total: 'Totaal',
    empty: 'Nog geen teams. Voeg ze toe en vul na elke ronde de punten in.',
    teamName: 'Naam van het team',
    newTeam: 'Team {number}',
    addTeam: 'Team toevoegen',
    removeTeam: 'Verwijder team',
    removeTeamTitle: 'Team “{name}” verwijderen?',
    removeTeamMessage: 'De punten van dit team verdwijnen ook.',
    remove: 'Verwijder',
    points: 'Punten van {team} in {round}',
    clearPoints: 'Punten wissen',
    clearTitle: 'Alle punten wissen?',
    clearMessage: 'De teams blijven staan. Handig voor een nieuwe avond met dezelfde quiz.',
    clear: 'Wissen'
  },
  {
    en: {
      title: 'Scoreboard',
      team: 'Team',
      total: 'Total',
      empty: 'No teams yet. Add them and enter the points after each round.',
      teamName: 'Team name',
      newTeam: 'Team {number}',
      addTeam: 'Add team',
      removeTeam: 'Delete team',
      removeTeamTitle: 'Delete team “{name}”?',
      removeTeamMessage: "This team's points will be removed too.",
      remove: 'Delete',
      points: 'Points for {team} in {round}',
      clearPoints: 'Clear points',
      clearTitle: 'Clear all points?',
      clearMessage: 'The teams stay. Handy for a new night with the same quiz.',
      clear: 'Clear'
    }
  }
)

/** Tijdens de show: de punten van de ronde die nu loopt (ScorePad). */
export const SCORE_PAD_MESSAGES = defineMessages(
  {
    title: 'Punten',
    team: 'Team',
    total: 'Totaal',
    noTeams: 'Nog geen teams. Voeg ze toe bij Quiz-instellingen.',
    points: 'Punten van {team} in {round}'
  },
  {
    en: {
      title: 'Points',
      team: 'Team',
      total: 'Total',
      noTeams: 'No teams yet. Add them in Quiz settings.',
      points: 'Points for {team} in {round}'
    }
  }
)
