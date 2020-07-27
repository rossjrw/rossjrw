import { Octokit } from "@octokit/rest/index"
import { Context } from "@actions/github/lib/context"
import Ur from "ur-game"
import ejs from "ejs"
import cryptoRandomString from "crypto-random-string"

import { analyseMove } from '@/analyseMove'
import { updateSvg } from '@/updateSvg'
import { Change } from '@/play'

export async function generateReadme (
  state: Ur.State,
  gamePath: string,
  octokit: Octokit,
  context: Context,
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
  const boardImageHash = cryptoRandomString({length: 16, type: "numeric"})
  changes = changes.concat(
    await updateSvg(
      state,
      gamePath,
      "assets/board.optimised.svg", // TODO change for compiled branch
      boardImageHash,
      octokit,
      context
    )
  )

  const readmeFile = await octokit.repos.getContents({
    owner: context.repo.owner,
    repo: context.repo.repo,
    ref: "source",
    path: "src/README.ejs",
    mediaType: { format: "raw" },
  })
  // If a file was queried then data is not an array
  if(Array.isArray(readmeFile.data)) {
    throw new Error('FILE_IS_DIR')
  }

  const template = Buffer.from(readmeFile.data.content!, "base64").toString()

  let actions
  if (state.possibleMoves) {
    actions = Object.keys(state.possibleMoves).map(key => {
      return {
        from: Number(key),
        to: state.possibleMoves![key],
      }
    }).map(move => {
      const events = analyseMove(state, move.from, move.to)
      return {
        text: `${events.ascensionHappened ? "Ascend" : "Move"} a ${move.from === 0 ? "new piece" : `piece from tile ${move.from}`}${events.ascensionHappened ? "" : ` to tile ${move.to}`}${events.rosetteClaimed ? " (:rosette:)" : ""}${events.captureHappened ? " (:crossed_swords:)" : ""}${events.ascensionHappened ? " (:rocket:)" : ""}${events.gameWon ? " (:crown:)" : ""}`,
        url: issueLink(
          `ur-move-${state.diceResult}%40${move.from}-0`,
          context,
        ),
      }
    })
  } else {
    actions = [
      {
        text: "Start a new game",
        url: issueLink("ur-new", context)
      }
    ]
  }

  const readme = ejs.render(template, { actions, state, boardImageHash })

  const currentReadmeFile = await octokit.repos.getContents({
    owner: context.repo.owner,
    repo: context.repo.repo,
    ref: "play",
    path: "README.md",
    mediaType: { format: "raw" },
  })
  // If a file was queried then data is not an array
  if(Array.isArray(currentReadmeFile.data)) {
    throw new Error('FILE_IS_DIR')
  }

  changes.push({
    path: "README.md",
    content: readme,
  })

  return changes
}

function issueLink (
  issueTitle: string,
  context: Context,
): string {
  return `https://github.com/${context.repo.owner}/${context.repo.repo}/issues/new?title=${issueTitle}&body=Press+Submit%21+You+don%27t+need+to+edit+this+text+or+do+anything+else.`
}
