import { Octokit } from "@octokit/rest/index"
import { Context } from "@actions/github/lib/context"

export async function getStateFile (
  gamePath: string,
  octokit: Octokit,
  context: Context,
): Promise<Octokit.Response<Octokit.ReposGetContentsResponse> | null> {
  /**
   * Gets the current game state as stored on file. If there is no state on
   * file, returns null.
   */

  // Grab the content of the current board from file
  let stateFile
  try {
    stateFile = await octokit.repos.getContents({
      owner: context.issue.owner,
      repo: context.issue.repo,
      ref: "play",
      path: `${gamePath}/state.json`,
      mediaType: { format: "raw" },
    })
  } catch (error) {
    if (error.status === 404) {
      // There's no game file! That's probably fine
      return null
    } else {
      throw error
    }
  }
  return stateFile
}
