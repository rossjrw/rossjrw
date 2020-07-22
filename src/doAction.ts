import { Octokit } from "@octokit/rest"
import { Context } from "@actions/github/lib/context"
import Ur from "ur-game"
import { isEmpty, values, sum } from "lodash"

import { getPlayerTeam } from '@/player'

export function resetGame (
  gamePath: string,
  octokit: Octokit,
  context: Context,
): void {
  /**
   * Called when a player uses the "new" command.
   *
   * I don't want this to happen willy-nilly, so I might add some restriction
   * here - maybe no moves for a few hours or something.
   */
  // Delete the current game state
  octokit.repos.getContent({
    owner: context.issue.owner,
    repo: context.issue.repo,
    path: gamePath,
  }).then(stateFile => {
    octokit.repos.deleteFile({
      owner: context.issue.owner,
      repo: context.issue.repo,
      path: gamePath,
      branch: 'play',
      message: `@${context.actor} Start a new game (#${context.issue.number})`,
      sha: stateFile.data.sha,
    })
  })
}

export function makeMove (
  state: Ur.State,
  move: string,
  gamePath: string,
  octokit: Octokit,
  context: Context,
): void {
  /**
   * Called when a player uses the "move" command.
   *
   * @param state: The current state of the game.
   * @param move: The move the player wants to make.
   * @param gamePath: The location of the current game's state file.
   */
  if (!state.currentPlayer) {
    throw new Error('GAME_ENDED')
  }
  // First I need to validate which team the user is on
  if (state.currentPlayer !== getPlayerTeam(context.actor)) {
    throw new Error('WRONG_TEAM')
  }
  // The move should be 'a@b' where a is the dice count and b is the position
  // The given diceResult must match the internal diceResult
  const [diceResult, fromPosition] = move.split('@').map(a => parseInt(a))
  if (!diceResult || diceResult !== state.diceResult) {
    throw new Error('WRONG_DICE_COUNT')
  }
  if (!fromPosition) {
    throw new Error('NO_MOVE_POSITION')
  }
  // The fromPosition must be a key of one of the possibleMoves
  // However, there may be no possible moves, in which case possibleMoves will
  // be an empty object, in which case any move is "allowed"
  if(!(`${fromPosition}` in state.possibleMoves!)
     && !isEmpty(state.possibleMoves!)) {
    throw new Error('IMPOSSIBLE_MOVE')
  }
  const toPosition = state.possibleMoves![`${fromPosition}`]
  // Everything seems ok, so execute the move
  const newState = Ur.takeTurn(state, state.currentPlayer, fromPosition)

  // Now let's detect what happened in that move
  // Was a rosette claimed?
  const rosetteClaimed = [4, 8, 14].includes(toPosition)
  // Did a capture happen?
  const captureHappened = !!sum(values(state.board[toPosition]))
  // Did an ascension happen?
  const ascensionHappened = toPosition >= 15
  // Was the game won?
  const gameWon = newState.currentPlayer === undefined

  // Next job is to save the new state
  // Replace the contents of the current game state file with the new state
  octokit.repos.getContent({
    owner: context.issue.owner,
    repo: context.issue.repo,
    ref: "play",
    path: gamePath,
  }).then(stateFile => {
    octokit.repos.createOrUpdateFileContents({
      owner: context.repo.owner,
      repo: context.repo.repo,
      branch: "play",
      path: gamePath,
      message: `@${context.actor} Move white from ${fromPosition} to ${toPosition} (#${context.issue.number})`,
      content: Buffer.from(JSON.stringify(newState)).toString("base64"),
      sha: stateFile.data.sha,
    })
  })
}
