import { Octokit } from "@octokit/rest"
import { Context } from "@actions/github/lib/context"
import Ur from "ur-game"

import { getPlayerTeam } from '@/player'
import { generateReadme } from '@/generateReadme'

export async function resetGame (
  gamePath: string,
  octokit: Octokit,
  context: Context,
): Promise<void> {
  /**
   * Called when a player uses the "new" command.
   *
   * I don't want this to happen willy-nilly, so I might add some restriction
   * here - maybe no moves for a few hours or something.
   */
  // Get the current game state file
  let stateFile
  try {
    stateFile = await octokit.repos.getContents({
      owner: context.issue.owner,
      repo: context.issue.repo,
      path: `${gamePath}/state.json`,
    })
  } catch (error) {
    if (error.status === 404) {
      // There's no game file! That's probably fine
      stateFile = null
    } else {
      throw error
    }
  }

  // Make a new game state
  const newState = Ur.startGame(7, 4, getPlayerTeam(context.actor))

  // Save the new state
  const update: Octokit.ReposCreateOrUpdateFileParams = {
    owner: context.repo.owner,
    repo: context.repo.repo,
    branch: "play",
    path: `${gamePath}/state.json`,
    message: `@${context.actor} Start a new game (#${context.issue.number})`,
    content: Buffer.from(JSON.stringify(newState)).toString("base64"),
  }
  if (stateFile) {
    if (Array.isArray(stateFile.data)) {
      throw new Error('FILE_IS_DIR')
    }
    update.sha = stateFile.data.sha
  }
  await octokit.repos.createOrUpdateFile(update)

  // Add a comment to the issue to indicate that a new board was made
  octokit.issues.createComment({
    owner: context.repo.owner,
    repo: context.repo.repo,
    issue_number: context.issue.number,
    body: `@${context.actor} Done! You started a new game.\n\nMake the next move yourself, or ask a friend: [share on Twitter](https://twitter.com/share?text=I'm+playing+The+Royal+Game+of+Ur+on+a+GitHub+profile.+A+new+game+just+started+%E2%80%94+take+your+turn+at+https://github.com/rossjrw+%23ur+%23github`
  })
  octokit.issues.update({
    owner: context.repo.owner,
    repo: context.repo.repo,
    issue_number: context.issue.number,
    state: "closed",
  })

  // Update README.md with the new state
  await generateReadme(newState, gamePath, octokit, context)
}
