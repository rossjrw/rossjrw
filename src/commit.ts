import { Octokit } from "@octokit/rest/index"
import { Context } from "@actions/github/lib/context"

import { Change } from '@/play'

export async function makeCommit (
  message: string,
  changes: Change[],
  octokit: Octokit,
  context: Context,
): Promise<void> {
  /**
   * From the given list of changes, makes a single commit to implement them.
   *
   * @param changes: The list of changes to make.
   */

  // Grab the SHA of the latest commit
  const remoteCommits = await octokit.repos.listCommits({
    owner: context.repo.owner,
    repo: context.repo.repo,
    sha: "play",
    per_page: 1,
  })
  let latestCommitSha = remoteCommits.data[0].sha
  const treeSha = remoteCommits.data[0].commit.tree.sha

  // Make a new tree for these changes
  const newTree = await octokit.git.createTree({
    owner: context.repo.owner,
    repo: context.repo.repo,
    base_tree: treeSha,
    tree: changes.map(change => {
      const subTree: Octokit.GitCreateTreeParamsTree = {
        path: change.path,
        mode: '100644',
      }
      if (change.content) {
        subTree.content = change.content
      } else {
        subTree.sha = "null"
      }
      return subTree
    })
  })
  const newTreeSha = newTree.data.sha

  const newCommit = await octokit.git.createCommit({
    owner: context.repo.owner,
    repo: context.repo.repo,
    message,
    tree: newTreeSha,
    parents: [latestCommitSha]
  })
  latestCommitSha = newCommit.data.sha

  // Set HEAD of play branch to the new commit
  await octokit.git.updateRef({
    owner: context.repo.owner,
    repo: context.repo.repo,
    sha: latestCommitSha,
    ref: "heads/play",
  })
}
