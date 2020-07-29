import Ur from "ur-game"
import { values, sum } from "lodash"

interface Events {
  rosetteClaimed: boolean,
  captureHappened: boolean,
  ascensionHappened: boolean,
  gameWon: boolean,
}

export function analyseMove (
  state: Ur.State,
  fromPosition: number,
  toPosition: number,
): Events {
  /**
   * Analyses what events happened, or predicts what events will happen, for a
   * given move.
   *
   * @param state: The current state of the board.
   * @param fromPosition: The position that a piece is moving from.
   * @param toPosition: The position that a pice is moving to.
   * @returns A dict of events that could happen and whether or not they did.
   */
  const newState = Ur.takeTurn(state, state.currentPlayer!, fromPosition)
  const events = {
    // Was a rosette claimed?
    rosetteClaimed: [4, 8, 14].includes(toPosition),
    // Did a capture happen?
    captureHappened:
      !!sum(values(state.board[toPosition])) &&
      [5, 6, 7, 9, 10, 11, 12].includes(toPosition),
    // Did an ascension happen?
    ascensionHappened: toPosition >= 15,
    // Was the game won?
    gameWon: newState.currentPlayer === undefined,
  }
  return events
}
