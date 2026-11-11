import { Octokit } from "@octokit/rest"
import { Context } from "@actions/github/lib/context"
import Ur from "ur-game"
import { compress } from "compress-tag"

import { getPlayerTeam } from "@/player"
import { Change } from "@/play"
import { Log } from "@/log"
import { teamName } from "@/teams"

export function resetGame(
  oldGamePath: string,
  actor: string,
  log: Log,
): [Ur.State, Change[]] {
  /**
   * Called when a player uses the "new" command.
   *
   * I don't want this to happen willy-nilly, so I might add some restriction
   * here - maybe no moves for a few hours or something.
   *
   * @param oldGamePath: Where old games should be kept.
   * @param actor: The player who started the new game.
   * @returns The state of the new game, and an array of changes to add to the
   * commit.
   */
  const changes: Change[] = []

  // Move the old log.json to another directory - don't care about state
  // Get the contents of the log from the log object
  changes.push({
    path: `${oldGamePath}/log.${log.internalLog[0].time}.json`,
    content: JSON.stringify(log.internalLog, null, 2),
  })
  // This only creates a new file with the same content, but that's okay,
  // because the old file is about to be overwritten with a new log

  // Make a new game state
  // The starting team should be the same team as the initiating player, so
  // that they can immediately play, but as of rossjrw/rossjrw#133 that team
  // should always be null
  const startingPlayerTeam = getPlayerTeam(actor, log)
  let gameStartTeam: Ur.Player
  if (startingPlayerTeam === undefined) {
    // If the team is null, which it should be, white plays first
    gameStartTeam = Ur.WHITE
  } else {
    gameStartTeam = startingPlayerTeam
  }
  const newState = Ur.startGame(7, 4, gameStartTeam)

  // Wipe the log for the new game
  log.internalLog = []

  // Update the log with this action
  log.addToLog("new", newState.currentPlayer!, null, null, null, null)

  return [newState, changes]
}

export function announceNewGame(
  state: Ur.State,
  octokit: Octokit,
  context: Context,
): void {
  /**
   * Comments on the triggering issue to say that a new game has started.
   *
   * @param state: The state of the new game, once any unplayable turns have
   * been passed.
   */
  octokit.issues.createComment({
    owner: context.repo.owner,
    repo: context.repo.repo,
    issue_number: context.issue.number,
    body: compress`
    Done! You started a new game.
    \n\n
    It's ${teamName(state.currentPlayer)} to play!
    [Make the first move yourself](https://github.com/${
      context.repo.owner
    }/${context.repo.repo}),
    or ask a friend!
  `,
  })
  octokit.issues.update({
    owner: context.repo.owner,
    repo: context.repo.repo,
    issue_number: context.issue.number,
    state: "closed",
  })
}
