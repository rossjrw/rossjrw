import Ur from "ur-game"

export function teamName (
  team: Ur.Player | undefined
): string {
  if (team === Ur.BLACK) {
    return "black"
  }
  if (team === Ur.WHITE) {
    return "white"
  }
  return "unknown"
}

export function getOppositeTeam (
  team: Ur.Player | undefined
): Ur.Player | undefined {
  if (team === Ur.BLACK) {
    return Ur.WHITE
  }
  if (team === Ur.WHITE) {
    return Ur.BLACK
  }
  return undefined
}
