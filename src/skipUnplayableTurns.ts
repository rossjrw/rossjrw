import Ur from "ur-game"
import { Log } from "@/log"

/**
 * Roll zero, or any turn with no legal moves, is automatically passed.
 * This also repairs a stuck game when an ur-refresh issue is submitted.
 */
export function skipUnplayableTurns(state: Ur.State, log: Log): Ur.State {
  let nextState = state
  let passes = 0

  while (
    nextState.currentPlayer &&
    Object.keys(nextState.possibleMoves ?? {}).length === 0
  ) {
    if (++passes > 64) {
      throw new Error("Unable to generate a playable turn after 64 passes")
    }

    log.addToLog(
      "pass",
      nextState.currentPlayer,
      nextState.diceResult!,
      null,
      null,
      null,
    )

    const passedState = Ur.voidTurn(nextState, nextState.currentPlayer)
    if (!passedState) {
      throw new Error("Unable to pass an unplayable turn")
    }
    nextState = passedState
  }

  return nextState
}
