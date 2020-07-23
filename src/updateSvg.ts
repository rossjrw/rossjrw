import { Octokit, RestEndpointMethodTypes } from "@octokit/rest"
import { Context } from "@actions/github/lib/context"
import { State } from "ur-game"
import { range, has } from "lodash"

export async function updateSvg(
  state: State,
  gamePath: string,
  baseSvgPath: string,
  octokit: Octokit,
  context: Context,
): Promise<string> {
  /**
   * Generates an SVG to visually represent the current board state.
   *
   * Does this by taking the base SVG and adding "display: none" to all objects
   * that aren't visible in the current state.
   *
   * Saves the resulting SVG to games/current/board.[hash].svg.
   *
   * @param state: The current state of the game board.
   * @param gamePath: The path to the current game's info dir.
   * @param baseSvgPath: The path to the SVG template file.
   * @returns The hash of the newly-created file, so that README.md can
   * correctly reference it (this avoids cache issues).
   */
  // Delete the current board image - we didn't save the hash, so we'll have to
  // trawl through that directory and delete any matching files
  const gameFiles = await octokit.repos.getContent({
    owner: context.repo.owner,
    repo: context.repo.repo,
    ref: "play",
    path: gamePath,
  })

  // If the result is not an array, then games/current/ is not a dir
  if (!Array.isArray(gameFiles.data)) {
    throw new Error('GAME_DIR_IS_FILE')
  }

  gameFiles.data.forEach(gameFile => {
    if (/^board\.[A-z0-9]+\.svg$/.test(gameFile.name)) {
      octokit.repos.deleteFile({
        owner: context.repo.owner,
        repo: context.repo.repo,
        branch: "play",
        path: gameFile.path,
        message: `Clear old board image (#${context.issue.number})`,
        sha: gameFile.sha,
      })
    }
  })

  // Make a new svg and write it to file
  const svgFile = await octokit.repos.getContent({
    owner: context.repo.owner,
    repo: context.repo.repo,
    branch: "source",
    path: baseSvgPath,
    mediaType: { format: "raw" },
  })

  let svgContents = Buffer.from(svgFile.data.content, "base64").toString()

  // What IDs are there?
  // Tokens: tileN-T and tile0-TN, tile15-TN
  // Dice spots: diceN-spot-on and/or diceN-spot-off
  state.board.forEach(
    (field, fieldIndex) => {
      if (fieldIndex === 0 || fieldIndex === 15) {
        range(field.b, 7).forEach(tokenIndex => {
          hideSvgElement(svgContents, `tile${fieldIndex}-b${tokenIndex}`)
        })
        range(field.w, 7).forEach(tokenIndex => {
          hideSvgElement(svgContents, `tile${fieldIndex}-w${tokenIndex}`)
        })
      } else {
        if (field.b === 0) {
          hideSvgElement(svgContents, `tile${fieldIndex}-b`)
        }
        if (field.w === 0) {
          hideSvgElement(svgContents, `tile${fieldIndex}-w`)
        }
      }
    }
  )
  state.dice!.forEach(
    (diceResult, index) => {
      if (diceResult) {
        svgContents = hideSvgElement(svgContents, `dice${index}-spot-off`)
      } else {
        svgContents = hideSvgElement(svgContents, `dice${index}-spot-on`)
      }
    }
  )
    

  return "no thank you sir"
}

function hideSvgElement(
  svgContents: string,
  elementId: string,
): string {
  /**
   * Hides the SVG element that has the given ID.
   *
   * All elements in the SVG are displayed by default, and must be turned off
   * in order to produce a coherent image. The reason that the far more
   * sensible approach of turning things on has not been taken is because a) it
   * makes it hard to edit the base file when everything is hidden by default
   * b) the base file just looks way cooler now
   *
   * @param svgContents: The contents of the SVG as text.
   * @param elementId: The ID to find.
   * @returns The updated contents of the SVG.
   */
}
