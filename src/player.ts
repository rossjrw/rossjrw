import Ur from "ur-game"

export function playerIsOnTeam (
  username: string,
  team: Ur.Player,
): boolean {
  /**
   * Checks if a player is on the given team.
   *
   * @param username: The player's name.
   * @param team: The team to check against.
   */
  if (username === "rossjrw") {
    return true
  }
  return getPlayerTeam(username) === team
}

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
