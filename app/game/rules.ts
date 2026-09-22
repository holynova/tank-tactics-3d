import type {
  CaptureResult,
  Move,
  Piece,
  PlayerColor,
  Position,
  TurnResult,
} from "./types";

export const BOARD_SIZE = 4;

export type Grid = Array<Array<Piece | null>>;

export function opponent(color: PlayerColor): PlayerColor {
  return color === "red" ? "blue" : "red";
}

export function createInitialPieces(): Piece[] {
  return Array.from({ length: BOARD_SIZE }, (_, col) => [
    { id: `red-${col}`, color: "red" as const, row: 0, col, facing: 180 as const },
    { id: `blue-${col}`, color: "blue" as const, row: BOARD_SIZE - 1, col, facing: 0 as const },
  ]).flat();
}

export function buildGrid(pieces: Piece[]): Grid {
  const grid: Grid = Array.from({ length: BOARD_SIZE }, () =>
    Array<Piece | null>(BOARD_SIZE).fill(null),
  );

  for (const piece of pieces) {
    grid[piece.row][piece.col] = piece;
  }

  return grid;
}

export function isInside(position: Position): boolean {
  return (
    position.row >= 0 &&
    position.row < BOARD_SIZE &&
    position.col >= 0 &&
    position.col < BOARD_SIZE
  );
}

export function getValidMoves(piece: Piece, pieces: Piece[]): Position[] {
  const grid = buildGrid(pieces);
  const candidates = [
    { row: piece.row - 1, col: piece.col },
    { row: piece.row + 1, col: piece.col },
    { row: piece.row, col: piece.col - 1 },
    { row: piece.row, col: piece.col + 1 },
  ];

  return candidates.filter((position) => isInside(position) && !grid[position.row][position.col]);
}

export function getFacing(from: Position, to: Position): Piece["facing"] {
  if (to.row < from.row) return 0;
  if (to.row > from.row) return 180;
  if (to.col < from.col) return 270;
  return 90;
}

export function getAllMoves(pieces: Piece[], color: PlayerColor): Move[] {
  return pieces
    .filter((piece) => piece.color === color)
    .flatMap((piece) =>
      getValidMoves(piece, pieces).map((to) => ({
        pieceId: piece.id,
        from: { row: piece.row, col: piece.col },
        to,
      })),
    );
}

function scanLine(
  line: Array<Piece | null>,
  attackerColor: PlayerColor,
  lineKind: "row" | "column",
  result: CaptureResult,
) {
  const occupied = line.filter(Boolean).length;
  if (occupied > 3) {
    result.crowdedLines.push(lineKind);
    return;
  }

  const victimColor = opponent(attackerColor);

  for (let index = 0; index <= BOARD_SIZE - 3; index += 1) {
    const trio = line.slice(index, index + 3);
    if (trio.some((piece) => !piece)) continue;

    const [first, second, third] = trio as [Piece, Piece, Piece];
    let victim: Piece | null = null;
    let attackers: Piece[] = [];
    let victimIndex = -1;

    if (
      first.color === attackerColor &&
      second.color === attackerColor &&
      third.color === victimColor
    ) {
      victim = third;
      attackers = [first, second];
      victimIndex = index + 2;
    } else if (
      first.color === victimColor &&
      second.color === attackerColor &&
      third.color === attackerColor
    ) {
      victim = first;
      attackers = [second, third];
      victimIndex = index;
    }

    if (!victim) continue;

    const protectedByFriend =
      line[victimIndex - 1]?.color === victimColor ||
      line[victimIndex + 1]?.color === victimColor;

    if (protectedByFriend) {
      result.protectedIds.push(victim.id);
      continue;
    }

    result.victimIds.push(victim.id);
    result.attackerIds.push(...attackers.map((piece) => piece.id));
  }
}

export function checkCaptures(
  pieces: Piece[],
  landing: Position,
  attackerColor: PlayerColor,
): CaptureResult {
  const result: CaptureResult = {
    victimIds: [],
    attackerIds: [],
    protectedIds: [],
    crowdedLines: [],
  };
  const grid = buildGrid(pieces);

  scanLine(grid[landing.row], attackerColor, "row", result);
  scanLine(
    grid.map((row) => row[landing.col]),
    attackerColor,
    "column",
    result,
  );

  result.victimIds = [...new Set(result.victimIds)];
  result.attackerIds = [...new Set(result.attackerIds)];
  result.protectedIds = [...new Set(result.protectedIds)];
  result.crowdedLines = [...new Set(result.crowdedLines)];
  return result;
}

export function getWinner(pieces: Piece[]): PlayerColor | null {
  const redCount = pieces.filter((piece) => piece.color === "red").length;
  const blueCount = pieces.filter((piece) => piece.color === "blue").length;

  if (redCount <= 1) return "blue";
  if (blueCount <= 1) return "red";
  return null;
}

export function applyMove(pieces: Piece[], move: Move, color: PlayerColor): TurnResult {
  const piece = pieces.find((candidate) => candidate.id === move.pieceId);
  if (!piece || piece.color !== color) {
    throw new Error("Move does not belong to the active player.");
  }

  const legal = getValidMoves(piece, pieces).some(
    (position) => position.row === move.to.row && position.col === move.to.col,
  );
  if (!legal) throw new Error("Illegal move.");

  const movedPieces = pieces.map((candidate) =>
    candidate.id === piece.id
      ? {
          ...candidate,
          row: move.to.row,
          col: move.to.col,
          facing: getFacing(move.from, move.to),
        }
      : candidate,
  );
  const capture = checkCaptures(movedPieces, move.to, color);
  const survivors = movedPieces.filter((candidate) => !capture.victimIds.includes(candidate.id));

  return {
    pieces: survivors,
    move,
    capture,
    winner: getWinner(survivors),
  };
}

