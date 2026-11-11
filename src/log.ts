import { Octokit } from "@octokit/rest/index"
import { Context } from "@/gh"
import Ur from "ur-game"
import { findLast, last } from "lodash"

import { Change } from "@/play"
import { Events } from "@/analyseMove"

export interface LogItem {
  username: string
  issue: number
  time: string
  team: Ur.Player
  action: "new" | "move" | "pass"
  boardImage: string | null
  events: Events | null
  fromPosition: number | null
  toPosition: number | null
  roll: number | null
}

export class Log {
  username: string
  issue: number | undefined
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

  async prepareInitialLog(): Promise<void> {
    /**
     * Grabs the contents of the log file and puts it into the internal log.
     * This function should be called only once, before any extra log items
     * have been added.
     */
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
      Buffer.from(logFile.data.content!, "base64").toString(),
    )

    // Get the SHA of the latest commit
    const lastCommit = await this.octokit.git.getRef({
      owner: this.context.repo.owner,
      repo: this.context.repo.repo,
      ref: "heads/play",
    })
    this.lastCommitSha = lastCommit.data.object.sha
  }

  addToLog(
    action: "new" | "move" | "pass",
    team: Ur.Player,
    roll: number | null,
    fromPosition: number | null,
    toPosition: number | null,
    events: Events | null,
  ): void {
    /**
     * Adds an item to the internal log.
     *
     * @param action: The action this player took.
     * @param message: A verbose description of the action.
     * @param team: The team that this player is on.
     * @returns An array of changes to add to the commit.
     */
    if (this.issue === undefined) {
      throw new Error("LOG_ENTRY_WITHOUT_ISSUE")
    }
    const logItem: LogItem = {
      username: this.username,
      issue: this.issue,
      time: new Date().toISOString(),
      team,
      action,
      boardImage: null,
      events,
      fromPosition,
      toPosition,
      roll,
    }
    this.internalLog.push(logItem)
  }

  linkPreviousBoardState(): void {
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
     *
     * One issue can add several actions to the log - a move followed by
     * automatic passes - but each commit only has one board image, for the
     * last of them. So the action to link is the last one from an earlier
     * issue, and the actions before it from the same issue get no image.
     */
    const currentIssue = last(this.internalLog)?.issue
    const previousAction = findLast(
      this.internalLog,
      (logItem) => logItem.issue !== currentIssue,
    )

    if (previousAction === undefined) {
      // No earlier issue has played in this game, so there's no previous board
      return
    }
    if (previousAction.boardImage === null) {
      previousAction.boardImage = `https://raw.githubusercontent.com/${
        this.context.repo.owner
      }/${this.context.repo.repo}/${this.lastCommitSha}/${
        this.gamePath
      }/board.${previousAction.issue}.svg`
    } else {
      // The previous image should have had a null address, but it's not
      // absolutely critical to execution
      console.error("Previous image was not null")
    }
  }

  makeLogChanges(): Change[] {
    /**
     * Make the changes to the log file as described by the internal log. This
     * method should be called only once all log items have been added.
     *
     * @returns An array of changes to add to the commit.
     */
    const changes: Change[] = []

    changes.push({
      path: `${this.gamePath}/log.json`,
      content: JSON.stringify(this.internalLog, null, 2),
    })

    return changes
  }
}
