import Ur from "ur-game"

export function getPlayerTeam (
  username: string,
): Ur.Player {
  /**
   * Assigns a player to a team based on their username.
   */
  if (/^[A-M]/i.test(username)) {
    return Ur.BLACK
  } else {
    return Ur.WHITE
  }
}
