declare module "ur-game" {
  type Player = "b" | "w"

  interface State {
    board: Field[]
    currentPlayer?: Player
    dice?: number[]
    diceResult?: number
    possibleMoves?: PossibleMoves
    winner?: Player
  }

  interface Field {
    w: number
    b: number
  }

  interface PossibleMoves {
    [startingPoint: string]: number // TODO is this right?
  }

  export const BLACK = "b"
  export const WHITE = "w"
  export function startGame(
    numStones: number,
    numDice: number,
    player: Player
  ): State
  export function voidTurn(
    state: State,
    player: Player
  ): State
  export function takeTurn(
    state: State,
    player: Player,
    selectedField: number
  ): State
}
