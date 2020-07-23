import { Octokit, RestEndpointMethodTypes } from "@octokit/rest"
import { Context } from "@actions/github/lib/context"
import { State } from "ur-game"

export async function updateSvg(
  state: State,
  gamePath: string,
  baseSvgPath: string,
  octokit: Octokit,
  context: Context,
): Promise<string> {
  /**
   * Generates an SVG to visually represent the current board state.
   *
   * Does this by taking the base SVG and adding "display: none" to all objects
   * that aren't visible in the current state.
   *
   * Saves the resulting SVG to games/current/board.[hash].svg.
   *
   * @param state: The current state of the game board.
   * @param gamePath: The path to the current game's info dir.
   * @param baseSvgPath: The path to the SVG template file.
   * @returns The hash of the newly-created file, so that README.md can
   * correctly reference it (this avoids cache issues).
   */
  // Delete the current board image - we didn't save the hash, so we'll have to
  // trawl through that directory and delete any matching files
  const gameFiles = await octokit.repos.getContent({
    owner: context.repo.owner,
    repo: context.repo.repo,
    ref: "play",
    path: gamePath,
  })

  // If the result is not an array, then games/current/ is not a dir
  if (!Array.isArray(gameFiles.data)) {
    throw new Error('GAME_DIR_IS_FILE')
  }

  gameFiles.data.forEach(gameFile => {
    if (/^board\.[A-z0-9]+\.svg$/.test(gameFile.name)) {
      octokit.repos.deleteFile({
        owner: context.repo.owner,
        repo: context.repo.repo,
        branch: "play",
        path: gameFile.path,
        message: `Clear old board image (#${context.issue.number})`,
        sha: gameFile.sha,
      })
    }
  })

  // Make a new svg and write it to file
  const svgFile = await octokit.repos.getContent({
    owner: context.repo.owner,
    repo: context.repo.repo,
    branch: "source",
    path: baseSvgPath,
    mediaType: { format: "raw" },
  })

  let svgContents = Buffer.from(svgFile.data.content, "base64").toString()


  return "no thank you sir"
}
