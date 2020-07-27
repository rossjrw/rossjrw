import { Octokit } from "@octokit/rest"
import { Context } from "@actions/github/lib/context"
import Ur from "ur-game"

import { getPlayerTeam } from '@/player'
import { generateReadme } from '@/generateReadme'
import { Change } from '@/play'

export async function resetGame (
  gamePath: string,
  octokit: Octokit,
  context: Context,
): Promise<Change[]> {
  /**
   * Called when a player uses the "new" command.
   *
   * I don't want this to happen willy-nilly, so I might add some restriction
   * here - maybe no moves for a few hours or something.
   */
  let changes: Change[] = []

  // Make a new game state
  const newState = Ur.startGame(7, 4, getPlayerTeam(context.actor))

  // Save the new state
  changes.push({
    path: `${gamePath}/state.json`,
    content: Buffer.from(JSON.stringify(newState)).toString("base64"),
  })

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

  // Update README.md with the new state
  changes = changes.concat(
    await generateReadme(newState, gamePath, octokit, context)
  )

  return changes
}
