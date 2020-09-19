import Ur from "ur-game"

import { Log } from '@/log'

export function playerIsOnTeam (
  username: string,
  team: Ur.Player,
  log: Log,
): boolean {
  /**
   * Checks if a player is on the given team.
   *
   * @param username: The player's name.
   * @param team: The team to check against.
   */
  const playerTeam = getPlayerTeam(username, log)
  if (playerTeam === undefined) {
    // A player who hasn't played yet is allowed on either team
    return true
  }
  // Otherwise, players are locked into existing teams
  return playerTeam === team
}

export function getPlayerTeam (
  username: string,
  log: Log,
): Ur.Player | undefined {
  /**
   * Checks what team a player is on.
   */
  return log.internalLog.find(item => item.username === username)?.team
}

export function getPlayerTeamSource (
  username: string,
  log: Log,
): number | undefined {
  /**
   * Returns the issue number that determined a player's team for this game.
   */
  return log.internalLog.find(item => item.username === username)?.issue
}
