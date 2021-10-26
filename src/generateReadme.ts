import { Octokit } from "@octokit/rest/index"
import { Context } from "@actions/github/lib/context"
import Ur from "ur-game"
import ejs from "ejs"
import { compress, compressTight } from "compress-tag"
import dateformat from "dateformat"

import { analyseMove } from "@/analyseMove"
import { updateSvg } from "@/updateSvg"
import { Change } from "@/play"
import { Log } from "@/log"
import { getOppositeTeam, makeTeamListTable, teamName } from "@/teams"
import { listPreviousGames } from "@/victory"

export async function generateReadme(
  state: Ur.State,
  gamePath: string,
  octokit: Octokit,
  context: Context,
  log: Log
): Promise<Change[]> {
  /**
   * Generates the new README file based on the current state of the game.
   *
   * @param state: The current state of the board, as of right now.
   * @param gamePath: The location of the current game's state file.
   * @returns An array of changes to add to the commit.
   */
  let changes: Change[] = []

  // Update the SVG to represent the new game board
  changes = changes.concat(
    await updateSvg(
      state,
      gamePath,
      "assets/board.optimised.svg", // TODO change for compiled branch
      octokit,
      context
    )
  )

  // Grab the EJS template
  const readmeFile = await octokit.repos.getContents({
    owner: context.repo.owner,
    repo: context.repo.repo,
    ref: "source",
    path: "src/README.ejs",
    mediaType: { format: "raw" },
  })
  // If a file was queried then data is not an array
  if (Array.isArray(readmeFile.data)) {
    throw new Error("FILE_IS_DIR")
  }
  const template = Buffer.from(readmeFile.data.content!, "base64").toString()

  // Make a list of possible actions that can be taken this turn, structured
  // into an array of links
  let actions
  if (state.possibleMoves) {
    actions = Object.keys(state.possibleMoves)
      .map((key) => {
        return {
          from: Number(key),
          to: state.possibleMoves![key],
        }
      })
      .map((move) => {
        const events = analyseMove(state, move.from, move.to)
        return {
          text: compress`
          ${events.ascensionHappened ? "Ascend" : "Move"}
          a ${move.from === 0 ? "new piece" : `piece from tile ${move.from}`}
          ${events.ascensionHappened ? "" : `to tile ${move.to}`}
          ${events.rosetteClaimed ? "(:rosette:)" : ""}
          ${events.captureHappened ? "(:crossed_swords:)" : ""}
          ${events.ascensionHappened ? "(:rocket:)" : ""}
          ${events.gameWon ? "(:crown:)" : ""}
        `,
          url: issueLink(
            `ur-move-${state.diceResult}%40${move.from}-0`,
            context
          ),
        }
      })
  } else {
    actions = [
      {
        text: "Start a new game",
        url: issueLink("ur-new", context),
      },
    ]
  }

  // Trigger the log to update the second-to-last board image URL
  log.linkPreviousBoardState()

  // Make a list of moves that have happened so far this game, as markdown
  const logItems = log.internalLog.map((logItem) => {
    return [
      `${dateformat(new Date(logItem.time), "dS mmm yyyy HH:MM")}`,
      compress`
        :${teamName(logItem.team)}_circle:
        ${
          logItem.action === "pass"
            ? ""
            : `**[@${logItem.username}](https://github.com/${logItem.username})**`
        }
        ${
          {
            new: "started a new game",
            pass: compress`
              The ${teamName(logItem.team)} team rolled a ${logItem.roll}
              and their turn was automatically passed
            `,
            move: compress`
              ${logItem.events?.ascensionHappened ? "ascended" : "moved"}
              a ${teamName(logItem.team)} piece
              ${
                logItem.fromPosition === 0
                  ? "onto the board"
                  : `from position ${logItem.fromPosition}`
              }
              ${
                logItem.events?.ascensionHappened
                  ? ":rocket:"
                  : `to position ${logItem.toPosition}`
              }
              ${
                logItem.events?.captureHappened
                  ? compress`
                  — captured a
                  ${teamName(getOppositeTeam(logItem.team))} piece
                  :crossed_swords:
                `
                  : ""
              }
              ${
                logItem.events?.rosetteClaimed
                  ? "— claimed a rosette :rosette:"
                  : ""
              }
              ${logItem.events?.gameWon ? "— won the game :crown:" : ""}
            `,
          }[logItem.action]
        }
      `,
      `[#${logItem.issue}](https://github.com/${context.repo.owner}/${context.repo.repo}/issues/${logItem.issue})`,
      `${
        logItem.boardImage === null ? "" : `[link](${logItem.boardImage})`
      }`,
    ]
  })

  const teamTable = makeTeamListTable(log, true)

  const previousGames = await listPreviousGames(gamePath, octokit, context)

  const readme = ejs.render(template, {
    actions,
    state,
    logItems,
    context,
    teamTable,
    previousGames,
  })

  const currentReadmeFile = await octokit.repos.getContents({
    owner: context.repo.owner,
    repo: context.repo.repo,
    ref: "play",
    path: "README.md",
    mediaType: { format: "raw" },
  })
  // If a file was queried then data is not an array
  if (Array.isArray(currentReadmeFile.data)) {
    throw new Error("FILE_IS_DIR")
  }

  changes.push({
    path: "README.md",
    content: readme,
  })

  return changes
}

function issueLink(issueTitle: string, context: Context): string {
  return compressTight`
    https://github.com/${context.repo.owner}/${context.repo.repo}/issues/new
      ?title=${issueTitle}
      &body=
        Press+Submit%21+You+don%27t+need+to+edit+this+text+or+do+anything+else.
        %0D%0A%0D%0A
        Be+aware+that+your+move+can+take+a+minute+or+two+to+process.
  `
}
