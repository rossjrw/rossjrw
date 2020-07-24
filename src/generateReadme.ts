import { Octokit } from "@octokit/rest"
import { Context } from "@actions/github/lib/context"
import Ur from "ur-game"
import ejs from "ejs"

import { analyseMove } from '@/analyseMove'

export async function generateReadme (
  state: Ur.State,
  boardImageHash: string,
  octokit: Octokit,
  context: Context,
): Promise<string> {
  /**
   * Generates the new README file based on the current state of the game.
   *
   * @param state: The current state of the board, as of right now.
   * @param boardImageHash: The hash in the name of the board image file.
   * @returns The new content of README.md.
   */

  const readmeFile = await octokit.repos.getContent({
    owner: context.repo.owner,
    repo: context.repo.repo,
    ref: "source",
    path: "src/README.ejs",
    mediaType: { format: "raw" },
  })

  const template = Buffer.from(readmeFile.data.content, "base64").toString()

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
        text: `${events.ascensionHappened ? "Ascend" : "Move"} a${move.from === 0 ? "new piece" : `piece from ${move.from}`}${events.ascensionHappened ? "" : ` to ${move.to}`}${events.rosetteClaimed ? " (:rosette:)" : ""}${events.captureHappened ? " (:crossed_swords:)" : ""}${events.ascensionHappened ? " (:rocket:)" : ""}${events.gameWon ? " (:crown:)" : ""}`,
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
  return readme
}

function issueLink (
  issueTitle: string,
  context: Context,
): string {
  return `https://github.com/${context.repo.owner}/${context.repo.repo}/issues/new?title=${issueTitle}&body=Press+Submit%21+You+don%27t+need+to+edit+this+text+or+do+anything+else.`
}
