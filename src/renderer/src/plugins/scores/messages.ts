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
    removeTeam: 'Team weghalen',
    removeTeamTitle: '{name} weghalen?',
    removeTeamMessage: 'De punten van dit team verdwijnen ook.',
    remove: 'Weghalen',
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
      removeTeam: 'Remove team',
      removeTeamTitle: 'Remove {name}?',
      removeTeamMessage: "This team's points will be removed too.",
      remove: 'Remove',
      points: 'Points for {team} in {round}',
      clearPoints: 'Clear points',
      clearTitle: 'Clear all points?',
      clearMessage: 'The teams stay. Handy for a new night with the same quiz.',
      clear: 'Clear'
    }
  }
)
