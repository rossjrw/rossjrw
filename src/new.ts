import { Octokit } from "@octokit/rest"
import { Context } from "@actions/github/lib/context"
import Ur from "ur-game"

import { getPlayerTeam } from '@/player'
import { generateReadme } from '@/generateReadme'
import { Change } from '@/play'
import { Log } from '@/log'

export async function resetGame (
  gamePath: string,
  octokit: Octokit,
  context: Context,
  log: Log,
): Promise<Change[]> {
  /**
   * Called when a player uses the "new" command.
   *
   * I don't want this to happen willy-nilly, so I might add some restriction
   * here - maybe no moves for a few hours or something.
   */
  let changes: Change[] = []

  // Move the old log.json to another directory - don't care about state
  // Get the contents of the log from the log object
  changes.push({
    path: `${gamePath}/../log.${log.internalLog[0].time}.json`,
    content: JSON.stringify(log.internalLog, null, 2),
  })
  // This only creates a new file with the same content, but that's okay,
  // because the old file is about to be overwritten with a new log

  // Make a new game state
  const newState = Ur.startGame(7, 4, getPlayerTeam(context.actor))

  // Save the new state
  changes.push({
    path: `${gamePath}/state.json`,
    content: JSON.stringify(newState),
  })

  // Wipe the log for the new game
  log.internalLog = []

  // Update the log with this action
  log.addToLog(
    "new",
    "started a new game",
    newState.currentPlayer!,
  )

  // Update README.md with the new state
  changes = changes.concat(
    await generateReadme(newState, gamePath, octokit, context, log)
  )

  // Add a comment to the issue to indicate that a new board was made
  octokit.issues.createComment({
    owner: context.repo.owner,
    repo: context.repo.repo,
    issue_number: context.issue.number,
    body: `@${context.actor} Done! You started a new game.\n\nMake the next move yourself, or ask a friend: [share on Twitter](https://twitter.com/share?text=I'm+playing+The+Royal+Game+of+Ur+on+a+GitHub+profile.+A+new+game+just+started+%E2%80%94+take+your+turn+at+https://github.com/rossjrw+%23ur+%23github)`
  })
  octokit.issues.update({
    owner: context.repo.owner,
    repo: context.repo.repo,
    issue_number: context.issue.number,
    state: "closed",
  })

  return changes
}
