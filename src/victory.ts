import { Octokit } from "@octokit/rest/index"
import { Context } from "@/gh"
import { compress } from "compress-tag"
import {
  countBy,
  entries,
  flow,
  head,
  last,
  maxBy,
  partialRight,
  uniq,
} from "lodash"
import humanizeDuration from "humanize-duration"
import dateformat from "dateformat"

import { Log, LogItem } from "@/log"
import { teamName, makeTeamStats, makeTeamListTable } from "@/teams"

export function makeVictoryMessage(log: Log): string {
  /**
   * Called at the end of a game. Produces a message to ping participants in a
   * game, show teams, give stats, etc.
   */
  const players = makeTeamStats(log)

  const winningTeam = teamName(
    log.internalLog[log.internalLog.length - 1].team,
  )
  const moves = players.reduce((moves, player) => moves + player.moves, 0)

  const startingDate = new Date(log.internalLog[0].time)
  const endingDate = new Date(
    log.internalLog[log.internalLog.length - 1].time,
  )
  const hours = (endingDate.getTime() - startingDate.getTime()) / 1000 / 3600

  return compress`
    This game has ended!
    Congratulations to the ${winningTeam} team for their victory.
    \n\n
    This game had ${players.length} players,
    ${moves} moves,
    and took ${hours} hours.
    \n\n
    ${makeTeamListTable(log, false)}
  `
}

export async function getPreviousGameLogs(
  gamePath: string,
  octokit: Octokit,
  context: Context,
): Promise<LogItem[][]> {
  const gameDirPath = gamePath.substring(0, gamePath.lastIndexOf("/"))
  let logDir
  try {
    logDir = await octokit.repos.getContents({
      owner: context.repo.owner,
      repo: context.repo.repo,
      ref: "play",
      path: gameDirPath,
      mediaType: { format: "raw" },
    })
  } catch (e) {
    return []
  }
  if (!Array.isArray(logDir.data)) {
    throw new Error("GAMEDIR_IS_FILE")
  }

  const gameFiles = logDir.data.filter((dirObject) => {
    return dirObject.type === "file"
  })

  return Promise.all(
    gameFiles.map(async (file): Promise<LogItem[]> => {
      const gameFile = await octokit.repos.getContents({
        owner: context.repo.owner,
        repo: context.repo.repo,
        ref: "play",
        path: file.path,
        mediaType: { format: "raw" },
      })
      if (Array.isArray(gameFile.data)) {
        throw new Error("GAMEFILE_IS_DIR")
      }
      return JSON.parse(
        Buffer.from(gameFile.data.content!, "base64").toString(),
      )
    }),
  )
}

export async function listPreviousGames(
  gamePath: string,
  octokit: Octokit,
  context: Context,
  gameLogs?: LogItem[][],
): Promise<string[]> {
  /**
   * Generates a list of previous games from the logs in the game directory.
   *
   * @param gamePath: The path to the directory that contains the current game.
   * This is expected to be inside the directory that contains previous games.
   */
  const logs = gameLogs || await getPreviousGameLogs(gamePath, octokit, context)

  const gameStrings = logs.map((log) => {
    const firstMove = log[0]
    const lastMove = log[log.length - 1]
    const playerCount = uniq(log.map((entry) => entry.username)).length
    const mvp = flow(
      countBy,
      entries,
      partialRight(maxBy, last),
      head,
    )(
      log
        .filter((logItem) => logItem.team === lastMove.team)
        .map((logItem) => logItem.username),
    )
    return compress`
      A game was started
      on ${dateformat(new Date(firstMove.time), "dS mmm yyyy")}
      by <img src="https://github.com/${firstMove.username}.png?size=16" alt="" width="16">
      **[${firstMove.username}](https://github.com/${firstMove.username})**
      and ended on ${dateformat(new Date(lastMove.time), "dS mmm yyyy")}.
      <> The ${
        lastMove.team === "b" ? ":black_circle:black" : ":white_circle:white"
      } team won.
      <> ${playerCount} players played ${
        log.length
      } moves across ${humanizeDuration(
        new Date(lastMove.time).getTime() -
          new Date(firstMove.time).getTime(),
        { largest: 2, delimiter: " and " },
      )}.
      <> The :black_circle:black team captured ${
        log.filter((logItem) => {
          return logItem.team === "b" && logItem.events?.captureHappened
        }).length
      } white pieces and claimed ${
        log.filter((logItem) => {
          return logItem.team === "b" && logItem.events?.rosetteClaimed
        }).length
      } rosettes.
      <> The :white_circle:white team captured ${
        log.filter((logItem) => {
          return logItem.team === "w" && logItem.events?.captureHappened
        }).length
      } black pieces and claimed ${
        log.filter((logItem) => {
          return logItem.team === "w" && logItem.events?.rosetteClaimed
        }).length
      } rosettes.
      <> The MVP of the winning team was
      <img src="https://github.com/${mvp}.png?size=16" alt="" width="16">
      **[${mvp}](https://github.com/${mvp})**,
      who played ${
        log.filter((logItem) => logItem.username === mvp).length
      } moves.
      <> The winning move was made
      by <img src="https://github.com/${lastMove.username}.png?size=16" alt="" width="16">
      **[${lastMove.username}](https://github.com/${lastMove.username})**
      ([#${lastMove.issue}](https://github.com/${context.repo.owner}/${
        context.repo.repo
      }/issues/${lastMove.issue})).
    `.replace(/<>/g, "\n   *")
  })

  return gameStrings
}

interface PlayerStats {
  username: string
  victories: number
  mvps: number
  rosettes: number
  captures: number
  moves: number
}

function renderLeaderboardTable(
  statName: string,
  players: PlayerStats[],
  valueKey: keyof Omit<PlayerStats, "username">,
): string {
  if (players.length === 0) {
    return `*No stats recorded yet.*`
  }

  let table = `<table>
  <thead>
    <tr>
      <th align="left">Rank</th>
      <th align="left">Player</th>
      <th align="right">${statName}</th>
    </tr>
  </thead>
  <tbody>`

  players.forEach((player, index) => {
    const rankEmoji = ["🥇", "🥈", "🥉"][index] || `${index + 1}`
    table += `
    <tr>
      <td>${rankEmoji}</td>
      <td><img src="https://github.com/${player.username}.png?size=16" alt="" width="16"> <a href="https://github.com/${player.username}"><b>${player.username}</b></a></td>
      <td align="right">${player[valueKey]}</td>
    </tr>`
  })

  table += `
  </tbody>
</table>`

  return table
}

export function generateLeaderboardTable(gameLogs: LogItem[][]): string {
  const statsMap = new Map<string, PlayerStats>()

  const getOrCreateStats = (username: string): PlayerStats => {
    let stats = statsMap.get(username)
    if (!stats) {
      stats = {
        username,
        victories: 0,
        mvps: 0,
        rosettes: 0,
        captures: 0,
        moves: 0,
      }
      statsMap.set(username, stats)
    }
    return stats
  }

  gameLogs.forEach((log) => {
    if (log.length === 0) return

    const lastMove = log[log.length - 1]
    const winningTeam = lastMove.team

    // 1. Victories: Players on the winning team who made at least one move
    const winningPlayers = new Set<string>()
    log.forEach((item) => {
      if (item.action === "move" && item.team === winningTeam && item.username) {
        winningPlayers.add(item.username)
      }
    })
    winningPlayers.forEach((player) => {
      getOrCreateStats(player).victories++
    })

    // 2. MVPs: Player on the winning team who made the most moves in this game
    const teamMovesCount = new Map<string, number>()
    log.forEach((item) => {
      if (item.action === "move" && item.team === winningTeam && item.username) {
        teamMovesCount.set(item.username, (teamMovesCount.get(item.username) || 0) + 1)
      }
    })

    let mvp: string | null = null
    let maxMoves = 0
    teamMovesCount.forEach((moves, player) => {
      if (moves > maxMoves) {
        maxMoves = moves
        mvp = player
      }
    })
    if (mvp) {
      getOrCreateStats(mvp).mvps++
    }

    // 3. Moves, Rosettes, Captures
    log.forEach((item) => {
      if (item.action === "move" && item.username) {
        const stats = getOrCreateStats(item.username)
        stats.moves++
        if (item.events?.rosetteClaimed) {
          stats.rosettes++
        }
        if (item.events?.captureHappened) {
          stats.captures++
        }
      }
    })
  })

  const allStats = Array.from(statsMap.values())

  const topVictories = allStats.slice().sort((a, b) => b.victories - a.victories || b.moves - a.moves).slice(0, 5).filter(p => p.victories > 0)
  const topMvps = allStats.slice().sort((a, b) => b.mvps - a.mvps || b.moves - a.moves).slice(0, 5).filter(p => p.mvps > 0)
  const topRosettes = allStats.slice().sort((a, b) => b.rosettes - a.rosettes || b.moves - a.moves).slice(0, 5).filter(p => p.rosettes > 0)
  const topCaptures = allStats.slice().sort((a, b) => b.captures - a.captures || b.moves - a.moves).slice(0, 5).filter(p => p.captures > 0)
  const topMoves = allStats.slice().sort((a, b) => b.moves - a.moves).slice(0, 5).filter(p => p.moves > 0)

  return `
### 🥇 Most Victories
${renderLeaderboardTable("Victories", topVictories, "victories")}

### 🏅 Top MVPs
${renderLeaderboardTable("MVP Titles", topMvps, "mvps")}

### 🚀 Most Rosette Claims
${renderLeaderboardTable("Rosette Claims", topRosettes, "rosettes")}

### ⚔️ Most Captured Pieces
${renderLeaderboardTable("Captures", topCaptures, "captures")}

### 🎲 Total Moves Played
${renderLeaderboardTable("Moves", topMoves, "moves")}
`
}
