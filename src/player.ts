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
    // Nobody tells me what to do except me
    return true
  }
  const playerTeam = getPlayerTeam(username)
  if (playerTeam === null) {
    // A player who hasn't played yet is allowed on either team
    return true
  }
  // Otherwise, players are locked into existing teams
  return getPlayerTeam(username) === team
}

export function getPlayerTeam (
  username: string,
): Ur.Player {
  /**
   * Checks what team a player is on. Returns null if that team has not yet
   * been defined.
   */
  if (/^[A-M]/i.test(username)) {
    return Ur.BLACK
  } else {
    return Ur.WHITE
  }
}
