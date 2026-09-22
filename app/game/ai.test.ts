import { describe, expect, it } from "vitest";
import { findBestMove } from "./ai";
import { applyMove, getAllMoves } from "./rules";
import type { Piece } from "./types";

const piece = (
  id: string,
  color: Piece["color"],
  row: number,
  col: number,
): Piece => ({ id, color, row, col, facing: 0 });

describe("bot", () => {
  it("returns one of the active side's legal moves", () => {
    const pieces = [
      piece("r1", "red", 0, 0),
      piece("r2", "red", 0, 1),
      piece("b1", "blue", 3, 2),
      piece("b2", "blue", 3, 3),
    ];
    const legal = getAllMoves(pieces, "red");
    const best = findBestMove(pieces, "medium", "red");
    expect(best).not.toBeNull();
    expect(legal).toContainEqual(best);
  });

  it("takes an immediate winning capture when available", () => {
    const pieces = [
      piece("r-move", "red", 0, 1),
      piece("r-line", "red", 1, 0),
      piece("r-spare", "red", 3, 3),
      piece("b-target", "blue", 1, 2),
      piece("b-last", "blue", 3, 0),
    ];
    const best = findBestMove(pieces, "hard", "red");
    expect(best).not.toBeNull();
    expect(applyMove(pieces, best!, "red").winner).toBe("red");
  });
});

