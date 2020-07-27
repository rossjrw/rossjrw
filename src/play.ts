import { Octokit } from "@octokit/rest/index"
import { Context } from "@actions/github/lib/context"
import { default as _core } from "@actions/core"

import { addReaction } from '@/issues'
import { handleError } from '@/error'
import { resetGame } from '@/new'
import { makeMove } from '@/move'

export interface Change {
  path: string
  content: string | null
}

export default async function play (
  title: string,
  octokit: Octokit,
  context: Context,
  core: typeof _core,
): Promise<void> {
  /**
   * Let's play Ur!
   *
   * This project is inspired by timburgan/timburgan - thank you Tim!
   *
   * Recieves parameters from actions/github-script:
   * @param title: The title of the triggering issue.
   * @param octokit: octokit/rest.js client.
   * @param context: Workflow context object.
   * @returns void: At least until I work out what this should do!
   */
  // The Octokit client comes pre-authenticated, so there's no need to
  // instantiate it.

  // First thing to do: add a reaction to the triggering commit to acknowledge
  // that we've seen it.
  // TODO React with a rocket once the issue has been actioned.


  const gamePath = "games/current"

  // Prepare a list of trees, which will be made into a single commit to the
  // play branch
  const trees: Octokit.GitCreateTreeParamsTree[] = []

  try {
    addReaction("eyes", octokit, context)
    const [command, move] = parseIssueTitle(title)
    if (command === "new") {
      trees.push(...await resetGame(gamePath, octokit, context))
    } else if (command === "move") {
      trees.push(...await makeMove(move, gamePath, octokit, context))
    }

    // All the blobs have been collected, so commit them

    // Get the SHA of the play branch

    // Make the commit
    await octokit.git.createCommit({
      owner: context.repo.owner,
      repo: context.repo.repo,
      parents: ["TODO"],
      message: `@${context.actor} ${command} (#${context.issue.number})`,
      tree: trees,

    })
  } catch (error) {
    // If there was an error, forward it to the user, then stop
    handleError(error, octokit, context, core)
    return
  }
}

function parseIssueTitle (
  title: string,
): ["new" | "move", string, number] {
  /**
   * Parses the issue title into move instructions.
   *
   * @param title: The title of the issue.
   */
  const [gamename, command, move, gameId] = title.split("-")
  if (!gamename || gamename !== "ur") {
    throw new Error('WRONG_GAME')
  }
  if (!command || !["new", "move"].includes(command)) {
    throw new Error('UNKNOWN_COMMAND')
  }
  if (command === "move") {
    if (!move) {
      throw new Error('NO_MOVE_GIVEN')
    }
    if (!gameId) {
      throw new Error('NO_ID_GIVEN')
    }
    if (!/\d+@\d+/.test(move)) {
      throw new Error('MOVE_BAD_FORMAT')
    }
    if(isNaN(parseInt(gameId))) {
      throw new Error('NON_NUMERIC_ID')
    }
  }
  return [command as "new" | "move", move, parseInt(gameId)]
}
