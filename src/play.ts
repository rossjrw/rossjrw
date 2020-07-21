import { Octokit } from "@octokit/rest"
import { Context } from "@actions/github/lib/context"

export function play (
  octokit: Octokit,
  context: Context,
): void {
  /**
   * Let's play Ur!
   *
   * This project is inspired by timburgan/timburgan - thank you Tim!
   *
   * Recieves parameters from actions/github-script:
   * @param octokit: octokit/rest.js client.
   * @param context: Workflow context object.
   * @returns void: At least until I work out what this should do!
   */
  // The Octokit client comes pre-authenticated, so there's no need to
  // instantiate it.

  // First thing to do: add a reaction to the triggering commit to acknowledge
  // that we've seen it.
  // TODO React with a rocket once the issue has been actioned.
  octokit.reactions.createForIssue({
    owner: context.issue.owner,
    repo: context.issue.repo,
    issue_number: context.issue.number,
    content: "eyes",
  })
}
