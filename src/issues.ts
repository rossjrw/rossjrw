import { Octokit } from "@octokit/rest/index"
import { Context } from "@actions/github/lib/context"

export function addReaction(
  reaction: NonNullable<
    Parameters<typeof octokit.reactions.createForIssue>[0]
  >["content"],
  octokit: Octokit,
  context: Context
): void {
  /**
   * Adds a reaction to the triggering issue.
   */
  octokit.reactions.createForIssue({
    owner: context.repo.owner,
    repo: context.repo.repo,
    issue_number: context.issue.number,
    content: reaction,
  })
}

export function addLabels(
  labels: string[],
  octokit: Octokit,
  context: Context
): void {
  /**
   * Adds labels to the triggering issue.
   */
  octokit.issues.addLabels({
    owner: context.repo.owner,
    repo: context.repo.repo,
    issue_number: context.issue.number,
    labels: labels,
  })
}
