import { Octokit, RestEndpointMethodTypes } from "@octokit/rest"
import { Context } from "@actions/github/lib/context"
import { State } from "ur-game"

export function updateSvg(
  state: State,
  gamePath: string,
  octokit: Octokit,
  context: Context,
): string {
  /**
   * Generates an SVG to visually represent the current board state.
   *
   * Does this by taking the base SVG and adding "display: none" to all objects
   * that aren't visible in the current state.
   *
   * Saves the resulting SVG to games/current/board.[hash].svg.
   *
   * @param state: The current state of the game board.
   * @param gamePath: The path to the current game's info.
   * @returns The hash of the newly-created file, so that README.md can
   * correctly reference it (this avoids cache issues).
   */
  // Delete the current board image - we didn't save the hash, so we'll have to
  // trawl through that directory and delete any matching files
  octokit.repos.getContent({
    owner: context.repo.owner,
    repo: context.repo.repo,
    ref: "play",
    path: gamePath,
  }).then(gameFiles => {
    if (Array.isArray(gameFiles)) {
      gameFiles.forEach(gameFile => {
        if (/^board\.[A-z0-9]+\.svg$/.test(gameFile.name)) {
          octokit.repos.deleteFile({
            owner: context.repo.owner,
            repo: context.repo.repo,
            branch: "play",
            path: gameFile.path,
            message: TODO,
            sha: TODO,
          })
        }
      })
    } else {
      throw new Error('GAME_DIR_IS_FILE')
    }
  })
  return "no thank you sir"
}
