import { Octokit } from "@octokit/rest"
import { Context } from "@actions/github/lib/context"
import Ur from "ur-game"
import { compress } from "compress-tag"

import { getPlayerTeam } from "@/player"
import { generateReadme } from "@/generateReadme"
import { Change } from "@/play"
import { Log } from "@/log"
import { teamName } from "@/teams"

export async function resetGame(
  gamePath: string,
  oldGamePath: string,
  octokit: Octokit,
  context: Context,
  log: Log
): Promise<Change[]> {
  /**
   * Called when a player uses the "new" command.
   *
   * I don't want this to happen willy-nilly, so I might add some restriction
   * here - maybe no moves for a few hours or something.
   *
   * @param gamePath: The location of the current game.
   * @param oldGamePath: Where old games should be kept.
   */
  let changes: Change[] = []

  // Move the old log.json to another directory - don't care about state
  // Get the contents of the log from the log object
  changes.push({
    path: `${oldGamePath}/log.${log.internalLog[0].time}.json`,
    content: JSON.stringify(log.internalLog, null, 2),
  })
  // This only creates a new file with the same content, but that's okay,
  // because the old file is about to be overwritten with a new log

  // Make a new game state
  // The starting team should be the same team as the initiating player, so
  // that they can immediately play, but as of rossjrw/rossjrw#133 that team
  // should always be null
  const startingPlayerTeam = getPlayerTeam(context.actor, log)
  let gameStartTeam: Ur.Player
  if (startingPlayerTeam === undefined) {
    // If the team is null, which it should be, white plays first
    gameStartTeam = Ur.WHITE
  } else {
    gameStartTeam = startingPlayerTeam
  }
  const newState = Ur.startGame(7, 4, gameStartTeam)

  // Save the new state
  changes.push({
    path: `${gamePath}/state.json`,
    content: JSON.stringify(newState, null, 2),
  })

  // Wipe the log for the new game
  log.internalLog = []

  // Update the log with this action
  log.addToLog("new", newState.currentPlayer!, null, null, null, null)

  // Update README.md with the new state
  changes = changes.concat(
    await generateReadme(newState, gamePath, octokit, context, log)
  )

  // Add a comment to the issue to indicate that a new board was made
  octokit.issues.createComment({
    owner: context.repo.owner,
    repo: context.repo.repo,
    issue_number: context.issue.number,
    body: compress`
      Done! You started a new game.
      \n\n
      It's ${teamName(newState.currentPlayer)} to play!
      [Make the first move yourself](https://github.com/${
        context.repo.owner
      }/${context.repo.repo}),
      or ask a friend: [share on Twitter](https://twitter.com/share?text=I'm+playing+The+Royal+Game+of+Ur+on+a+GitHub+profile.+I+just+started+a+new+game+%E2%80%94+take+the+first+turn+at+https://github.com/${
        context.repo.owner
      }+%23ur+%23github)
    `,
  })
  octokit.issues.update({
    owner: context.repo.owner,
    repo: context.repo.repo,
    issue_number: context.issue.number,
    state: "closed",
  })

  return changes
}
