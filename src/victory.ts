import { Octokit } from "@octokit/rest/index"
import { Context } from "@actions/github/lib/context"
import { compress } from "compress-tag"
import { uniq } from "lodash"
import humanizeDuration from "humanize-duration"

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
   * Generates a list of previous games.
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
    const game = {
      firstMove: log[0],
      lastMove: log[log.length - 1],
      playerCount: uniq(log.map(entry => entry.username)).length,
    }
    return compress`
      A game started on ${new Date(game.firstMove.time).toUTCString()}
      by <b>
        <a href="https://github.com/${game.firstMove.username}">
          @${game.firstMove.username}
        </a>
      </b>
      and ended on ${new Date(game.lastMove.time).toUTCString()}
      in a win for the ${
        game.lastMove.team === "b" ?
          ":black_circle:black" :
          ":white_circle:white"
      } team.
      ${game.playerCount} players
      played ${log.length} moves
      across ${
        humanizeDuration(
          new Date(game.lastMove.time).getTime() -
            new Date(game.firstMove.time).getTime(),
          { largest: 2, delimiter: " and " }
        )
      }.
      Winning move:
      [#${game.lastMove.issue}](https://github.com/rossjrw/rossjrw/issues/${game.lastMove.issue})
    `
  })

  return gameStrings
}
