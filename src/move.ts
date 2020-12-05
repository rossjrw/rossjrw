import { Octokit } from "@octokit/rest"
import { Context } from "@actions/github/lib/context"
import Ur from "ur-game"
import { isEmpty } from "lodash"
import { compress } from "compress-tag"

import { playerIsOnTeam, getPlayerTeam } from '@/player'
import { addLabels } from '@/issues'
import { analyseMove } from '@/analyseMove'
import { generateReadme } from '@/generateReadme'
import { Change } from '@/play'
import { Log } from '@/log'
import { makeVictoryMessage } from '@/victory'
import { getOppositeTeam, teamName } from '@/teams'

export async function makeMove (
  state: Ur.State,
  move: string,
  gamePath: string,
  octokit: Octokit,
  context: Context,
  log: Log,
): Promise<Change[]> {
  /**
   * Called when a player uses the "move" command. Executes that move onto the
   * current state.
   *
   * @param state: The current state of the game.
   * @param move: The move the player wants to make.
   * @param gamePath: The location of the current game's state file.
   * @returns An array of changes to add to the commit.
   */
  let changes: Change[] = []

  if (!state.currentPlayer) {
    throw new Error('MOVE_WHEN_GAME_ENDED')
  }

  let newState
  let events

  if (move === "pass") {
    // If we are just passing, then void the turn and skip all checks
    // This should be safe - pass can only be called internally, it should not
    // be possible for a player to pass
    newState = Ur.voidTurn(state, state.currentPlayer)
  } else {
    // Store the player's current team before anything else
    const playerTeam = getPlayerTeam(context.actor, log)
    // First I need to validate which team the user is on
    if (
      context.actor !== context.repo.owner // Owner can do what they want
      && playerTeam !== undefined // New players can also do what they want
      && playerIsOnTeam(
        context.actor,
        getOppositeTeam(state.currentPlayer)!,
        log
      ) // Player can't be on the opposite team
    ) {
      throw new Error('WRONG_TEAM')
    }
    if (state.currentPlayer === Ur.BLACK) {
      addLabels(["Black team"], octokit, context)
    } else {
      addLabels(["White team"], octokit, context)
    }
    // The move should be 'a@b' where a is the dice count and b is the position
    // The given diceResult must match the internal diceResult
    const [diceResult, fromPosition] = move.split('@').map(a => parseInt(a))
    if (diceResult === undefined || diceResult !== state.diceResult) {
      throw new Error('WRONG_DICE_COUNT')
    }
    if (fromPosition === undefined) {
      throw new Error('NO_MOVE_POSITION')
    }
    // The fromPosition must be a key of one of the possibleMoves
    // However, there may be no possible moves, in which case possibleMoves is
    // an empty object, in which case any move is "allowed"
    if(!(`${fromPosition}` in state.possibleMoves!)
       && !isEmpty(state.possibleMoves!)) {
      throw new Error('IMPOSSIBLE_MOVE')
    }
    const toPosition = state.possibleMoves![`${fromPosition}`]

    // Everything seems ok, so execute the move
    newState = Ur.takeTurn(state, state.currentPlayer, fromPosition)

    // Move has been performed and the result has been saved.
    // All that remains is to report back to the issue and update the README.

    // Let's detect what happened in that move
    events = analyseMove(state, fromPosition, toPosition)
    if (events.rosetteClaimed) {
      addLabels([":rosette: Rosette!"], octokit, context)
    }
    if (events.captureHappened) {
      addLabels([":crossed_swords: Capture!"], octokit, context)
    }
    if (events.ascensionHappened) {
      addLabels([":rocket: Ascension!"], octokit, context)
    }
    if (events.gameWon) {
      addLabels([":crown: Winner!"], octokit, context)
    }

    // Add a comment to the issue to indicate that the move was successful
    await octokit.issues.createComment({
      owner: context.repo.owner,
      repo: context.repo.repo,
      issue_number: context.issue.number,
      body: compress`
        @${context.actor} Done!
        You ${events.ascensionHappened ? "ascended" : "moved"}
        a ${teamName(state.currentPlayer)} piece
        ${
          events.ascensionHappened ?
          `from position ${fromPosition}.` :
          compress`
            ${
              fromPosition === 0 ?
              "onto the board" :
              `from position ${fromPosition}`
            }
            to position ${toPosition}.
          `
        }
        ${events.captureHappened ? "You captured the opponents' piece!" : ""}
        ${events.rosetteClaimed ? "You claimed a rosette, so you can take another turn!" : ""}
        ${events.gameWon ? "This was the winning move!" : ""}
        \n\n
        ${playerTeam === undefined ?
          compress`
            You've joined the ${teamName(state.currentPlayer)} team!
            This will be your team until this game ends.
          ` :
          compress`
            The ${teamName(state.currentPlayer)} team
            thanks you for your continued participation!
          `
        }
        \n\n
        Ask a friend to
        ${events.gameWon ? "start the next game" : "make the next move"}:
        [share on Twitter](https://twitter.com/share?text=I'm+playing+The+Royal+Game+of+Ur+on+a+GitHub+profile.+I+just+${events.gameWon ? "won+a+game" : "moved"}+%E2%80%94+${events.gameWon ? "start+the+next+one" : "take+your+turn" }+at+https://github.com/rossjrw/rossjrw+%23RoyalGameOfUr+%23github)
      `
    })
    octokit.issues.update({
      owner: context.repo.owner,
      repo: context.repo.repo,
      issue_number: context.issue.number,
      state: "closed",
    })

    // Update the log with this action
    log.addToLog(
      "move",
      compress`
        ${events.ascensionHappened ? "ascended" : "moved"}
        a ${teamName(state.currentPlayer)} piece
        ${fromPosition === 0 ? "onto the board" : `from position ${fromPosition}`}
        ${
          events.ascensionHappened ?
          ":rocket:" :
          `to position ${toPosition}`
        }
        ${events.captureHappened ? `— captured a ${teamName(getOppositeTeam(state.currentPlayer))} piece :crossed_swords:` : ""}
        ${events.rosetteClaimed ? "— claimed a rosette :rosette:" : ""}
        ${events.gameWon ? "— won the game :crown:" : ""}
      `,
      state.currentPlayer,
    )

    // If the game was won, leave a message to let everyone know
    if (events.gameWon) {
      await octokit.issues.createComment({
        owner: context.repo.owner,
        repo: context.repo.repo,
        issue_number: context.issue.number,
        body: makeVictoryMessage(log),
      })
    }
  }

  if (!events?.gameWon && Object.keys(newState.possibleMoves!).length === 0) {
    // If there are no possible moves, pass this turn, unless the game is done
    // The events object is undefined if the last move was also a pass
    log.addToLog(
      "pass",
      compress`
        The ${teamName(newState.currentPlayer)} team
        rolled a ${newState.diceResult}
        and their turn was automatically passed
      `,
      newState.currentPlayer!,
    )
    changes = changes.concat(
      await makeMove(newState, "pass", gamePath, octokit, context, log)
    )
  } else {
    // Update README.md with the new state
    changes = changes.concat(
      await generateReadme(newState, gamePath, octokit, context, log)
    )
    // Replace the contents of the current game state file with the new state
    changes.push({
      path: `${gamePath}/state.json`,
      content: JSON.stringify(newState),
    })
  }

  return changes
}
