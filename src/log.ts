import { Octokit } from "@octokit/rest/index"
import { Context } from "@actions/github/lib/context"
import Ur from "ur-game"

import { Change } from '@/play'

export interface LogItem {
  username: string
  issue: number
  message: string
  time: string
  team: Ur.Player
  action: "new" | "move" | "pass"
  boardImage: string
}

export async function addToLog (
  action: "new" | "move",
  message: string,
  team: Ur.Player,
  boardImage: string,
  gamePath: string,
  octokit: Octokit,
  context: Context,
): Promise<Change[]> {
  /**
   * Logs an action.
   *
   * @param action: The action this player took.
   * @param message: A verbose description of the action.
   * @param team: The team that this player is on.
   * @param boardImage: A URL pointing to the board's state after this action.
   * @returns An array of changes to add to the commit.
   */
  const changes: Change[] = []

  const logItem: LogItem = {
    username: context.actor,
    issue: context.issue.number,
    time: new Date().toISOString(),
    team,
    action,
    boardImage,
  }

  return changes
}
