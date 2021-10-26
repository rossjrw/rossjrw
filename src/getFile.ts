import { Octokit } from "@octokit/rest/index"
import { Context } from "@actions/github/lib/context"

export async function getFile(
  branch: "source" | "play",
  gamePath: string,
  filename: string | null,
  octokit: Octokit,
  context: Context
): Promise<Octokit.Response<Octokit.ReposGetContentsResponse> | null> {
  /**
   * Gets the content of a file, or returns null if it doesn't exist.
   */

  // Grab the content of the current board from file
  try {
    return await octokit.repos.getContents({
      owner: context.issue.owner,
      repo: context.issue.repo,
      ref: branch,
      path: `${gamePath}${filename === null ? "" : `/${filename}`}`,
      mediaType: { format: "raw" },
    })
  } catch (error: any) {
    if (error.status === 404) {
      // There's no game file! That's probably fine
      return null
    } else {
      throw error
    }
  }
}
