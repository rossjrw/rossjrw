import Ur from "ur-game"
import ejs from "ejs"

import { Log } from "@/log"

interface TeamPlayer {
  name: string
  team: Ur.Player
  moves: number
}

export function teamName(team: Ur.Player | undefined): string {
  if (team === Ur.BLACK) {
    return "black"
  }
  if (team === Ur.WHITE) {
    return "white"
  }
  return "unknown"
}

export function getOppositeTeam(
  team: Ur.Player | undefined
): Ur.Player | undefined {
  if (team === Ur.BLACK) {
    return Ur.WHITE
  }
  if (team === Ur.WHITE) {
    return Ur.BLACK
  }
  return undefined
}

/**
 * Makes a table containing team members.
 *
 * @param hasPlayerLinks: Players as hyperlinks? Required for README, but not
 * required for issues.
 */
export function makeTeamListTable(
  log: Log,
  hasPlayerLinks: boolean
): string {
  const PLAYERS_TABLE = `<table>
    <thead>
      <tr><th colspan=2>Players in this game</th></tr>
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

  const players = makeTeamStats(log)

  const blackPlayers = makeTeamListColumn(players, Ur.BLACK, hasPlayerLinks)
  const whitePlayers = makeTeamListColumn(players, Ur.WHITE, hasPlayerLinks)

  return ejs.render(PLAYERS_TABLE, { blackPlayers, whitePlayers })
}

export function makeTeamStats(log: Log): TeamPlayer[] {
  const players: TeamPlayer[] = []

  log.internalLog.forEach((logItem) => {
    if (logItem.action === "pass") {
      return
    }
    const playerIndex = players.findIndex((player) => {
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

  return players
}

function makeTeamListColumn(
  players: TeamPlayer[],
  team: Ur.Player,
  hasLinks: boolean
): string[] {
  return players
    .filter((player) => {
      return player.team === team
    })
    .sort((a, b) => {
      if (a.moves > b.moves) return -1
      if (a.moves < b.moves) return 1
      return 0
    })
    .map((player) => {
      if (hasLinks) {
        return `<b><a href="https://github.com/${player.name}">@${player.name}</a></b> (${player.moves})`
      } else {
        return `@${player.name} (${player.moves})`
      }
    })
}
