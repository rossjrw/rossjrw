import Ur from "ur-game"
import { isEmpty } from "lodash"

import { Log } from "@/log"

export function passUnplayableTurns(state: Ur.State, log: Log): Ur.State {
  /**
   * Passes every turn that has no possible moves, until a team has a move to
   * make or the game has ended.
   *
   * A team has no possible moves when it rolls a 0, or when every piece it
   * could move is blocked.
   *
   * @param state: The state of the game.
   * @returns The first state where the current team has a move to make.
   */
  while (state.currentPlayer && isEmpty(state.possibleMoves)) {
    log.addToLog(
      "pass",
      state.currentPlayer,
      state.diceResult!,
      null,
      null,
      null,
    )
    state = Ur.voidTurn(state, state.currentPlayer)
  }
  return state
}
