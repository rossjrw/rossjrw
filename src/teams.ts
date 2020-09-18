import Ur from "ur-game"

export function teamName (
  team: Ur.Player
): string {
  if (team === Ur.BLACK) {
    return "black"
  }
  if (team === Ur.WHITE) {
    return "white"
  }
  throw new Error('UNKNOWN_TEAM')
}

export function getOppositeTeam (
  team: Ur.Player
): Ur.Player {
  if (team === Ur.BLACK) {
    return Ur.WHITE
  }
  if (team === Ur.WHITE) {
    return Ur.BLACK
  }
  throw new Error('UNKNOWN_TEAM')
}
