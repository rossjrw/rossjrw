import { Octokit } from "@octokit/rest/index"
import { Context } from "@actions/github/lib/context"
import { compress } from "compress-tag"
import {
  countBy, entries, flow, head, last, maxBy, partialRight,
  uniq
} from "lodash"
import humanizeDuration from "humanize-duration"
import dateformat from "dateformat"

import { Log, LogItem } from '@/log'
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

export async function listPreviousGames (
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

  const gameFiles = logDir.data.filter(dirObject => {
    return dirObject.type === "file"
  })

  const gameLogs: LogItem[][] = await Promise.all(gameFiles.map(
    async (file): Promise<LogItem[]> => {
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
        Buffer.from(gameFile.data.content!, "base64").toString()
      )
    }
  ))

  const gameStrings = gameLogs.map(log => {
    const firstMove = log[0]
    const lastMove = log[log.length - 1]
    const playerCount = uniq(log.map(entry => entry.username)).length
    const mvp = flow(countBy, entries, partialRight(maxBy, last), head)(
      log.filter(
        logItem => logItem.team === lastMove.team
      ).map(logItem => logItem.username)
    )
    return compress`
      A game was started
      on ${dateformat(new Date(firstMove.time), "dS mmm yyyy")}
      by **[@${firstMove.username}](https://github.com/${firstMove.username})**
      and ended on ${dateformat(new Date(lastMove.time), "dS mmm yyyy")}.
      <> The ${
        lastMove.team === "b" ?
          ":black_circle:black" :
          ":white_circle:white"
      } team won.
      <> ${playerCount} players played ${log.length} moves across ${
        humanizeDuration(
          new Date(lastMove.time).getTime() -
            new Date(firstMove.time).getTime(),
          { largest: 2, delimiter: " and " }
        )
      }.
      <> The :black_circle:black team captured ${
        log.filter(logItem => {
          return logItem.team === "b" && logItem.events?.captureHappened
        }).length
      } white pieces and claimed ${
        log.filter(logItem => {
          return logItem.team === "b" && logItem.events?.rosetteClaimed
        }).length
      } rosettes.
      <> The :white_circle:white team captured ${
        log.filter(logItem => {
          return logItem.team === "w" && logItem.events?.captureHappened
        }).length
      } black pieces and claimed ${
        log.filter(logItem => {
          return logItem.team === "w" && logItem.events?.rosetteClaimed
        }).length
      } rosettes.
      <> The MVP of the winning team was
      **[@${mvp}](https://github.com/${mvp})**,
      who played ${
        log.filter(logItem => logItem.username === mvp).length
      } moves.
      <> The winning move was made
      by **[@${lastMove.username}](https://github.com/${lastMove.username})**
      ([#${lastMove.issue}](https://github.com/${context.repo.owner}/${context.repo.repo}/issues/${lastMove.issue})).
    `.replace(/<>/g, "\n   *")
  })

  return gameStrings
}
