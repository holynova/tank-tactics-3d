import { applyMove, buildGrid, getAllMoves, getWinner, opponent } from "./rules";
import type { Difficulty, Move, Piece, PlayerColor } from "./types";

const DEPTH: Record<Difficulty, number> = {
  easy: 1,
  medium: 2,
  hard: 3,
};

function evaluate(pieces: Piece[], botColor: PlayerColor): number {
  const winner = getWinner(pieces);
  if (winner === botColor) return 10_000;
  if (winner === opponent(botColor)) return -10_000;

  const mine = pieces.filter((piece) => piece.color === botColor);
  const theirs = pieces.filter((piece) => piece.color !== botColor);
  const material = (mine.length - theirs.length) * 100;
  const center = mine.reduce(
    (score, piece) => score + (piece.row >= 1 && piece.row <= 2 && piece.col >= 1 && piece.col <= 2 ? 10 : 0),
    0,
  );
  const mobility = getAllMoves(pieces, botColor).length - getAllMoves(pieces, opponent(botColor)).length;
  return material + center + mobility * 2;
}

function minimax(
  pieces: Piece[],
  depth: number,
  alpha: number,
  beta: number,
  activeColor: PlayerColor,
  botColor: PlayerColor,
): number {
  if (depth === 0 || getWinner(pieces)) return evaluate(pieces, botColor);

  const moves = getAllMoves(pieces, activeColor);
  if (!moves.length) return evaluate(pieces, botColor);

  const maximizing = activeColor === botColor;
  let best = maximizing ? -Infinity : Infinity;

  for (const move of moves) {
    const next = applyMove(pieces, move, activeColor).pieces;
    const score = minimax(next, depth - 1, alpha, beta, opponent(activeColor), botColor);

    if (maximizing) {
      best = Math.max(best, score);
      alpha = Math.max(alpha, score);
    } else {
      best = Math.min(best, score);
      beta = Math.min(beta, score);
    }
    if (beta <= alpha) break;
  }

  return best;
}

export function findBestMove(
  pieces: Piece[],
  difficulty: Difficulty,
  botColor: PlayerColor = "red",
): Move | null {
  buildGrid(pieces);
  const moves = getAllMoves(pieces, botColor);
  if (!moves.length) return null;

  let bestScore = -Infinity;
  let bestMove = moves[0];
  const depth = DEPTH[difficulty];

  for (const move of moves) {
    const next = applyMove(pieces, move, botColor).pieces;
    const score = minimax(next, depth - 1, -Infinity, Infinity, opponent(botColor), botColor);
    if (score > bestScore) {
      bestScore = score;
      bestMove = move;
    }
  }

  return bestMove;
}

