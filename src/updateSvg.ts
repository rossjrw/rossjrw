import { Octokit } from "@octokit/rest"
import { Context } from "@actions/github/lib/context"
import { State } from "ur-game"
import { range } from "lodash"
import cryptoRandomString from "crypto-random-string"

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
  const gameFiles = await octokit.repos.getContents({
    owner: context.repo.owner,
    repo: context.repo.repo,
    ref: "play",
    path: gamePath,
    mediaType: { format: "raw" },
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
  const svgFile = await octokit.repos.getContents({
    owner: context.repo.owner,
    repo: context.repo.repo,
    ref: "source", // TODO use compiled branch
    path: baseSvgPath,
    mediaType: { format: "raw" },
  })
  // If a file was queried then data is not an array
  if(Array.isArray(svgFile.data)) {
    throw new Error('FILE_IS_DIR')
  }

  let svg = Buffer.from(svgFile.data.content!, "base64").toString()

  // What IDs are there?
  // Tokens: tileN-T and tile0-TN, tile15-TN
  // Dice spots: diceN-spot-on and/or diceN-spot-off
  state.board.forEach(
    (field, fieldIndex) => {
      if (fieldIndex === 0 || fieldIndex === 15) {
        range(field.b, 7).forEach(tokenIndex => {
          svg = hideSvgElement(svg, `tile${fieldIndex}-b${tokenIndex}`)
        })
        range(field.w, 7).forEach(tokenIndex => {
          svg = hideSvgElement(svg, `tile${fieldIndex}-w${tokenIndex}`)
        })
      } else {
        if (field.b === 0) {
          svg = hideSvgElement(svg, `tile${fieldIndex}-b`)
        }
        if (field.w === 0) {
          hideSvgElement(svg, `tile${fieldIndex}-w`)
        }
      }
    }
  )
  state.dice!.forEach(
    (diceResult, index) => {
      if (diceResult) {
        svg = hideSvgElement(svg, `dice${index}-spot-off`)
      } else {
        svg = hideSvgElement(svg, `dice${index}-spot-on`)
      }
    }
  )

  const hash = cryptoRandomString({length: 16, type: "base64"})

  // Save the new SVG to a file
  octokit.repos.createOrUpdateFile({
    owner: context.repo.owner,
    repo: context.repo.repo,
    branch: "play",
    path: `${gamePath}/board.${hash}.svg`,
    message: `Create new board image (#${context.issue.number})`,
    content: Buffer.from(svg).toString("base64"),
  })

  // Return the hash for use by the README
  return hash
}

function hideSvgElement(
  svg: string,
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
   * @param svg: The contents of the SVG as text.
   * @param elementId: The ID to find.
   * @returns The updated contents of the SVG.
   */
  // The ID is always the first attribute in a node, thankfully
  // Also, all nodes are written on a single line

  // Pattern to match the node with the wanted ID
  const nodePattern = new RegExp(`<[A-z]+ id="${elementId}"[^>]*>`)

  svg = svg.replace(nodePattern, (node) => {
    if (node.includes("style=")) {
      // There is a style attribute - modify it
      const stylePattern = /style="([^"]*)"/
      node = node.replace(stylePattern, (_, styleValue) => {
        return `style="display:none;${styleValue}"`
      })
      return node
    } else {
      // There is no style attribute - add one
      // Add the new attribute before the ">" at the end
      node = node.slice(0, -1) + ' style="display:none;"' + node.slice(-1)
      return node
    }
  })

  return svg
}
