import { Octokit } from "@octokit/rest"
import { Context } from "@actions/github/lib/context"

interface ErrorDescriptions {
  [error_type: string]: string
}

export function play (
  title: string,
  octokit: Octokit,
  context: Context,
): void {
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
  addReaction("eyes", octokit, context)

  // Parse the issue's title into a concrete action
  try {
    const [command, move, gameId] = parseIssueTitle(title)
  } catch (error) {
    // If there was an error, forward it to the user, then stop
    handleError(error, octokit, context)
    return
  }
}

function handleError(
  error: Error,
  octokit: Octokit,
  context: Context,
): void {
  /**
   * Handles execution errors by reporting the problem back to the user and
   * closing the issue.
   *
   * @param error: The error to report with an ID matching the desc object.
   */
  const ERROR_DESC: ErrorDescriptions = {
    WRONG_GAME: "Sorry, I only know how to play Ur.",
    UNKNOWN_COMMAND: "I'm not sure what you're asking me to do - the only commands I know are 'new' and 'move'.",
    NO_MOVE_GIVEN: "You've asked me to make a move, but you haven't told me which move to make.",
    NO_ID_GIVEN: "You've told me what move to make, but I'm not sure where I should make it without a game ID.",
    MOVE_BAD_FORMAT: "You've asked me to make a move, but I'm not sure what exactly you want me to do. Is your move in the right format?",
    NON_NUMERIC_ID: "You've told me what move to make, but the game ID you've given me isn't a number.",
  }
  addReaction("confused", octokit, context)
  octokit.issues.createComment({
    owner: context.issue.owner,
    repo: context.issue.repo,
    issue_number: context.issue.number,
    body: ERROR_DESC[error.message],
  })
  octokit.issues.update({
    owner: context.issue.owner,
    repo: context.issue.repo,
    issue_number: context.issue.number,
    state: "closed",
  })
}

function addReaction (
  reaction: NonNullable<Parameters<typeof octokit.reactions.createForIssue>[0]>["content"],
  octokit: Octokit,
  context: Context,
): void {
  /**
   * Adds a reaction to the triggering issue.
   */
  octokit.reactions.createForIssue({
    owner: context.issue.owner,
    repo: context.issue.repo,
    issue_number: context.issue.number,
    content: reaction,
  })
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

function getBoardContents (
  octokit: Octokit,
  context: Context,
): void {
  const GAME_DATA_PATH = "games/current/state.json"
  const TEMP_FILENAME = "/tmp/state.json"
  let state = null
  const game_content = null

  // Grab the content of the current board from file
  try {
    const gameContentRaw = octokit.repos.getContent({
      owner: context.issue.owner,
      repo: context.issue.repo,
      issue_number: context.issue.number,
      path: GAME_DATA_PATH,
    })
  } catch (error) {
    if (error.status === 404) {
      // There is no game, so create it
      game = 
}
