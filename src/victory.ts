import Ur from "ur-game"
import ejs from "ejs"

import { Log } from '@/log'

const PLAYERS_TABLE = `<table>
  <thead>
    <tr><th colspan=2>Players this game</th></tr>
  </thead>
  <tbody>
    <tr>
      <td align="right"><b>Black team</b> :black_circle:</td>
      <td>:white_circle: <b> White team</b></td>
    </tr>
    <tr align="center">
      <td><%- blackPlayers.join("<br>") %></td>
      <td><%- whitePlayers.join("<br>") %></td>
    </tr>
  </tbody>
</table>`

interface TeamPlayer {
  name: string
  team: Ur.Player
  moves: number
}

export function makeVictoryMessage (
  log: Log,
): string {
  /**
   * Called at the end of a game. Produces a message to ping participants in a
   * game, show teams, give stats, etc.
   */
  const players: TeamPlayer[] = []

  log.internalLog.forEach(logItem => {
    const playerIndex = players.findIndex(player => {
      return player.name === logItem.username && player.team === logItem.team
    })
    if (playerIndex === -1) {
      players.push({
        name: logItem.username,
        team: logItem.team,
        moves: 1,
      })
    } else {
      players[playerIndex].moves++
    }
  })

  const winningTeam = log.internalLog[log.internalLog.length - 1].team === Ur.BLACK ? "black" : "white"
  const moves = players.reduce((moves, player) => moves + player.moves, 0)

  const startingDate = new Date(
    log.internalLog[0].time
  )
  const endingDate = new Date(
    log.internalLog[log.internalLog.length - 1].time
  )
  const hours = (endingDate.getTime() - startingDate.getTime()) / 1000 / 3600

  const blackPlayers = players.filter(player => {
    return player.team === Ur.BLACK
  }).sort((a, b) => {
    if (a.moves > b.moves) return -1
    if (a.moves < b.moves) return 1
    return 0
  }).map(player => {
    return `@${player.name} (${player.moves})`
  })

  const whitePlayers = players.filter(player => {
    return player.team === Ur.WHITE
  }).sort((a, b) => {
    if (a.moves > b.moves) return -1
    if (a.moves < b.moves) return 1
    return 0
  }).map(player => {
    return `@${player.name} (${player.moves})`
  })

  return `This game has ended! Congratulations to the ${winningTeam} team for their victory.\n\nThis game had ${players.length} players, ${moves} moves, and took ${hours} hours.\n\n${ejs.render(PLAYERS_TABLE, { blackPlayers, whitePlayers })}`
}
