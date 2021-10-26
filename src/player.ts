import Ur from "ur-game"

import { Log } from "@/log"

/**
 * Checks if a player is on the given team.
 *
 * @param username: The player's name.
 * @param team: The team to check against.
 */
export function playerIsOnTeam(
  username: string,
  team: Ur.Player,
  log: Log
): boolean {
  const playerTeam = getPlayerTeam(username, log)
  if (playerTeam === undefined) {
    // A player who hasn't played yet is allowed on either team
    return true
  }
  // Otherwise, players are locked into existing teams
  return playerTeam === team
}

/**
 * Checks what team a player is on.
 */
export function getPlayerTeam(
  username: string,
  log: Log
): Ur.Player | undefined {
  return log.internalLog.find((item) => item.username === username)?.team
}

/**
 * Returns the issue number that determined a player's team for this game.
 */
export function getPlayerTeamSource(
  username: string,
  log: Log
): number | undefined {
  return log.internalLog.find((item) => item.username === username)?.issue
}
