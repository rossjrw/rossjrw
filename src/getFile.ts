import { Octokit } from "@octokit/rest/index"
import { Context } from "@actions/github/lib/context"

export async function getFile (
  filename: string,
  gamePath: string,
  octokit: Octokit,
  context: Context,
): Promise<Octokit.Response<Octokit.ReposGetContentsResponse> | null> {
  /**
   * Gets the content of a file, or returns null if it doesn't exist.
   */

  // Grab the content of the current board from file
  try {
    return await octokit.repos.getContents({
      owner: context.issue.owner,
      repo: context.issue.repo,
      ref: "play",
      path: `${gamePath}/${filename}`,
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
}
