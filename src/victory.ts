import { Log } from '@/log'
import { teamName, makeTeamStats, makeTeamListTable } from '@/teams'

export function makeVictoryMessage (
  log: Log,
): string {
  /**
   * Called at the end of a game. Produces a message to ping participants in a
   * game, show teams, give stats, etc.
   */
  const players = makeTeamStats(log)

  const winningTeam = teamName(log.internalLog[log.internalLog.length - 1].team)
  const moves = players.reduce((moves, player) => moves + player.moves, 0)

  const startingDate = new Date(log.internalLog[0].time)
  const endingDate = new Date(log.internalLog[log.internalLog.length - 1].time)
  const hours = (endingDate.getTime() - startingDate.getTime()) / 1000 / 3600

  return `This game has ended! Congratulations to the ${winningTeam} team for their victory.\n\nThis game had ${players.length} players, ${moves} moves, and took ${hours} hours.\n\n${makeTeamListTable(log)}`
}
