import { Octokit } from "@octokit/rest"
import { Context } from "@actions/github/lib/context"
import Ur from "ur-game"

export function resetGame (
  gamePath: string,
  octokit: Octokit,
  context: Context,
): void {
  /**
   * Called when a player uses the "new" command.
   *
   * I don't want this to happen willy-nilly, so I might add some restriction
   * here - maybe no moves for a few hours or something.
   */
  // Delete the current game state
  octokit.repos.getContent({
    owner: context.issue.owner,
    repo: context.issue.repo,
    path: gamePath,
  }).then(stateFile => {
    octokit.repos.deleteFile({
      owner: context.issue.owner,
      repo: context.issue.repo,
      path: gamePath,
      branch: 'play',
      message: `@${context.actor} Start a new game (#${context.issue.number})`,
      sha: stateFile.data.sha,
    })
  })
}

export function makeMove (
  state: unknown,
  octokit: Octokit,
  context: Context,
): void {
  /**
   * Called when a player uses the "move" command.
   */
  // First I need to validate which team the user is on
}
