import { Octokit } from "@octokit/rest/index"
import { Context } from "@actions/github/lib/context"
import Ur from "ur-game"

import { Change } from "@/play"
import { Events } from "@/analyseMove"

export interface LogItem {
  username: string
  issue: number
  time: string
  team: Ur.Player
  action: "new" | "move" | "pass"
  initiatedByPlayer: boolean
  boardImage: string | null
  events: Events | null
  fromPosition: number | null
  toPosition: number | null
  roll: number | null
}

/**
 * A new entry to be added to the log.
 *
 * @property action - The name of the action.
 * @property team - The team of the current turn.
 *
 * If the action is a move, the following properties must not be null:
 *
 * @property roll - The value of the current dice roll.
 * @property fromPosition - The starting position of the piece that moved.
 * @property toPosition - The final position of the piece that moved.
 * @property events - Object of events that happened during the turn.
 */
export type LogEntryNew = {
  action: "new" | "move" | "pass"
  initiatedByPlayer: boolean
  team: Ur.Player
  roll: number | null
  fromPosition: number | null
  toPosition: number | null
  events: Events | null
}

export class Log {
  username: string
  issue: number
  time: string

  gamePath: string
  octokit: Octokit
  context: Context

  internalLog: LogItem[]
  lastCommitSha: string | null

  constructor(gamePath: string, octokit: Octokit, context: Context) {
    this.gamePath = gamePath
    this.octokit = octokit
    this.context = context
    this.username = context.actor
    this.issue = context.issue.number
    this.time = new Date().toISOString()

    // Internal log will need to be prepared with another method because the
    // constructor method cannot be async
    this.internalLog = []
    this.lastCommitSha = null
  }

  /**
   * Grabs the contents of the log file and puts it into the internal log.
   * This function should be called only once, before any extra log items
   * have been added.
   */
  async prepareInitialLog(): Promise<void> {
    const logFile = await this.octokit.repos.getContents({
      owner: this.context.repo.owner,
      repo: this.context.repo.repo,
      ref: "play",
      path: `${this.gamePath}/log.json`,
      mediaType: { format: "raw" },
    })
    if (Array.isArray(logFile.data)) {
      throw new Error("FILE_IS_DIR")
    }
    this.internalLog = JSON.parse(
      Buffer.from(logFile.data.content!, "base64").toString()
    )

    // Get the SHA of the latest commit
    const lastCommit = await this.octokit.git.getRef({
      owner: this.context.repo.owner,
      repo: this.context.repo.repo,
      ref: "heads/play",
    })
    this.lastCommitSha = lastCommit.data.object.sha
  }

  /**
   * Adds an item to the internal log.
   *
   * @returns An array of changes to add to the commit.
   */
  addToLog(entry: LogEntryNew): void {
    const logItem: LogItem = Object.assign(entry, {
      username: this.username,
      issue: this.issue,
      time: new Date().toISOString(),
      boardImage: null,
    })
    this.internalLog.push(logItem)
  }

  /**
   * Creates an absolute reference for the previous board's image and adds
   * that value to the log.
   *
   * I want to retain an image for every state of the board. In order to do
   * that I will be associating each move in the log with the image of the
   * board state that it resulted in. These images will be provided by URL
   * using the commit SHA as an absolute reference.
   *
   * When any given action is logged for the first time, at that point in
   * time, the SHA of that commit is not known as it has not yet been made,
   * so there's no point adding the image to the log at that time - I mark
   * it null.
   *
   * On the next action, this function should be called to add the previous
   * commit's SHA - which is now known - to the image. This will enable the
   * creation of an absolute link to the board state at that action. Even if
   * more commits are added in between, so long as the image was not changed,
   * the image will still work. The only thing that could break it is
   * rewriting history - but even then those commits might still be saved.
   */
  linkPreviousBoardState(): void {
    // The board image for the current round has already been added, so the
    // second-to-last image needs to be linked
    if (
      this.internalLog.length >= 2 &&
      this.internalLog[this.internalLog.length - 2].boardImage === null
    ) {
      this.internalLog[
        this.internalLog.length - 2
      ].boardImage = `https://raw.githubusercontent.com/${
        this.context.repo.owner
      }/${this.context.repo.repo}/${this.lastCommitSha}/${
        this.gamePath
      }/board.${this.internalLog[this.internalLog.length - 2].issue}.svg`
    } else {
      // The second-to-last image should have had a null address, but it's not
      // absolutely critical to execution
      console.error("Second-to-last image was not null")
    }
  }

  /**
   * Make the changes to the log file as described by the internal log. This
   * method should be called only once all log items have been added.
   *
   * @returns An array of changes to add to the commit.
   */
  makeLogChanges(): Change[] {
    const changes: Change[] = []

    changes.push({
      path: `${this.gamePath}/log.json`,
      content: JSON.stringify(this.internalLog, null, 2),
    })

    return changes
  }
}
