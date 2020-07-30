import { Octokit } from "@octokit/rest"
import { Context } from "@actions/github/lib/context"
import { State } from "ur-game"
import { range } from "lodash"

import { Change } from '@/play'
import { getFile } from '@/getFile'

export async function updateSvg(
  state: State,
  gamePath: string,
  baseSvgPath: string,
  octokit: Octokit,
  context: Context,
): Promise<Change[]> {
  /**
   * Generates an SVG to visually represent the current board state.
   *
   * Saves the resulting SVG to games/current/board.svg.
   *
   * @param state: The current state of the game board.
   * @param gamePath: The path to the current game's info dir.
   * @param baseSvgPath: The path to the SVG template file.
   * @returns An array of changes to add to the commit.
   */
  const changes: Change[] = []

  // Delete the old board image
  const gameFiles = await getFile(
    "play", gamePath, null, octokit, context
  )
  if (gameFiles) {
    if (!Array.isArray(gameFiles.data)) {
      throw new Error('GAME_DIR_IS_FILE')
    }
    gameFiles.data.forEach(gameFile => {
      if (/^board\.[0-9]+\.svg$/.test(gameFile.name)) {
        changes.push({
          path: gameFile.path,
          content: null,
        })
      }
    })
  }

  // Get the contents of the template SVG
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

  // Hide elements that should not be visible for this board
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
          svg = hideSvgElement(svg, `tile${fieldIndex}-w`)
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

  // Save the new SVG to a file
  changes.push({
    path: `${gamePath}/board.${context.issue.number}.svg`,
    content: svg,
  })

  return changes
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
      // Add the new attribute before the ">" or "/>" at the end
      const endPattern = /\/?>$/
      node = node.replace(endPattern, (endBracket) => {
        return ` style="display:none;"${endBracket}`
      })
      return node
    }
  })

  return svg
}
