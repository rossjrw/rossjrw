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
import Ur from "ur-game"

import { Log, LogItem } from "@/log"
import { teamName, makeTeamStats, makeTeamListTable } from "@/teams"

export async function getPreviousPlayers(
  gamePath: string,
  octokit: Octokit,
  context: Context,
): Promise<Map<string, number>> {
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
    return new Map()
  }

  if (!Array.isArray(logDir.data)) {
    throw new Error("GAMEDIR_IS_FILE")
  }

  const gameFiles = logDir.data.filter((dirObject) => {
    return dirObject.type === "file"
  })

  const previousGamesCount = new Map<string, number>()

  await Promise.all(
    gameFiles.map(async (file): Promise<void> => {
      try {
        const gameFile = await octokit.repos.getContents({
          owner: context.repo.owner,
          repo: context.repo.repo,
          ref: "play",
          path: file.path,
          mediaType: { format: "raw" },
        })
        if (Array.isArray(gameFile.data)) {
          return
        }
        const logItems: LogItem[] = JSON.parse(
          Buffer.from(gameFile.data.content!, "base64").toString(),
        )
        const playersInGame = new Set(logItems.map((item) => item.username))
        playersInGame.forEach((player) => {
          if (player) {
            previousGamesCount.set(player, (previousGamesCount.get(player) || 0) + 1)
          }
        })
      } catch (e) {
        // Ignore single file failures
      }
    })
  )

  return previousGamesCount
}

export async function makeVictoryMessage(
  log: Log,
  octokit: Octokit,
  context: Context,
): Promise<string> {
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

  // 1. Exclude the repository owner
  const owner = context.repo.owner
  const eligiblePlayers = players.filter((p) => p.name !== owner)

  // 2. Fetch previous games data
  const previousGamesCount = await getPreviousPlayers(log.gamePath, octokit, context)

  // 3. Assign random keys for tie-breaking
  const sortablePlayers = eligiblePlayers.map((p) => ({
    name: p.name,
    team: p.team,
    moves: p.moves,
    previousGames: previousGamesCount.get(p.name) || 0,
    randomKey: Math.random(),
  }))

  // 4. Group by team
  const blackTeam = sortablePlayers.filter((p) => p.team === Ur.BLACK)
  const whiteTeam = sortablePlayers.filter((p) => p.team === Ur.WHITE)

  // 5. Sort each team individually
  const sortTeam = (teamPlayers: typeof sortablePlayers) => {
    return teamPlayers.slice().sort((a, b) => {
      if (a.moves !== b.moves) {
        return b.moves - a.moves
      }
      if (a.previousGames !== b.previousGames) {
        return b.previousGames - a.previousGames
      }
      return a.randomKey - b.randomKey
    })
  }

  const sortedBlack = sortTeam(blackTeam)
  const sortedWhite = sortTeam(whiteTeam)

  // 6. Assign rank in team (number of players on the same team above them)
  const rankedBlack = sortedBlack.map((p, index) => ({ ...p, rankInTeam: index }))
  const rankedWhite = sortedWhite.map((p, index) => ({ ...p, rankInTeam: index }))

  // 7. Combine and sort to balance teams and prioritize
  const combined = rankedBlack.concat(rankedWhite).sort((a, b) => {
    if (a.rankInTeam !== b.rankInTeam) {
      return a.rankInTeam - b.rankInTeam
    }
    if (a.moves !== b.moves) {
      return b.moves - a.moves
    }
    if (a.previousGames !== b.previousGames) {
      return b.previousGames - a.previousGames
    }
    return a.randomKey - b.randomKey
  })

  // 8. Pick top 50
  const chosenPlayers = combined.slice(0, 50)
  const pingablePlayers = new Set(chosenPlayers.map((p) => p.name))

  return compress`
    This game has ended!
    Congratulations to the ${winningTeam} team for their victory.
    \n\n
    This game had ${players.length} players,
    ${moves} moves,
    and took ${hours} hours.
    \n\n
    ${makeTeamListTable(log, false, pingablePlayers)}
  `
}

export async function listPreviousGames(
  gamePath: string,
  octokit: Octokit,
  context: Context,
): Promise<string[]> {
  /**
   * Generates a list of previous games from the logs in the game directory.
   *
   * @param gamePath: The path to the directory that contains the current game.
   * This is expected to be inside the directory that contains previous games.
   */
  const gameDirPath = gamePath.substring(0, gamePath.lastIndexOf("/"))
  const logDir = await octokit.repos.getContents({
    owner: context.repo.owner,
    repo: context.repo.repo,
    ref: "play",
    path: gameDirPath,
    mediaType: { format: "raw" },
  })
  if (!Array.isArray(logDir.data)) {
    throw new Error("GAMEDIR_IS_FILE")
  }

  const gameFiles = logDir.data.filter((dirObject) => {
    return dirObject.type === "file"
  })

  const gameLogs: LogItem[][] = await Promise.all(
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

  const gameStrings = gameLogs.map((log) => {
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
