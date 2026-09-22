import { describe, expect, it } from "vitest";
import {
  applyMove,
  checkCaptures,
  createInitialPieces,
  getValidMoves,
  getWinner,
} from "./rules";
import type { Piece } from "./types";

const piece = (
  id: string,
  color: Piece["color"],
  row: number,
  col: number,
): Piece => ({ id, color, row, col, facing: 0 });

describe("movement", () => {
  it("starts with four units on each home row", () => {
    const pieces = createInitialPieces();
    expect(pieces.filter((candidate) => candidate.color === "red")).toHaveLength(4);
    expect(pieces.filter((candidate) => candidate.color === "blue")).toHaveLength(4);
    expect(pieces.filter((candidate) => candidate.row === 0)).toHaveLength(4);
    expect(pieces.filter((candidate) => candidate.row === 3)).toHaveLength(4);
  });

  it("allows only orthogonal moves into empty adjacent cells", () => {
    const pieces = createInitialPieces();
    expect(getValidMoves(pieces[0], pieces)).toEqual([{ row: 1, col: 0 }]);
  });

  it("rejects a diagonal or occupied move", () => {
    const pieces = createInitialPieces();
    expect(() =>
      applyMove(
        pieces,
        { pieceId: "red-0", from: { row: 0, col: 0 }, to: { row: 1, col: 1 } },
        "red",
      ),
    ).toThrow("Illegal move");
  });
});

describe("2v1 capture", () => {
  it("captures an exposed enemy in an A-A-V line", () => {
    const pieces = [
      piece("r1", "red", 1, 0),
      piece("r2", "red", 1, 1),
      piece("b1", "blue", 1, 2),
    ];
    expect(checkCaptures(pieces, { row: 1, col: 1 }, "red").victimIds).toEqual(["b1"]);
  });

  it("captures an exposed enemy in a V-A-A line", () => {
    const pieces = [
      piece("b1", "blue", 2, 0),
      piece("r1", "red", 2, 1),
      piece("r2", "red", 2, 2),
    ];
    expect(checkCaptures(pieces, { row: 2, col: 2 }, "red").victimIds).toEqual(["b1"]);
  });

  it("does not capture across a gap", () => {
    const pieces = [
      piece("r1", "red", 1, 0),
      piece("r2", "red", 1, 2),
      piece("b1", "blue", 1, 3),
    ];
    expect(checkCaptures(pieces, { row: 1, col: 2 }, "red").victimIds).toEqual([]);
  });

  it("applies crowding protection when all four cells are occupied", () => {
    const pieces = [
      piece("r1", "red", 1, 0),
      piece("r2", "red", 1, 1),
      piece("b1", "blue", 1, 2),
      piece("b2", "blue", 1, 3),
    ];
    const result = checkCaptures(pieces, { row: 1, col: 1 }, "red");
    expect(result.victimIds).toEqual([]);
    expect(result.crowdedLines).toContain("row");
  });

  it("checks both the landing row and column", () => {
    const pieces = [
      piece("r1", "red", 1, 1),
      piece("r2", "red", 1, 2),
      piece("b-row", "blue", 1, 3),
      piece("r3", "red", 2, 1),
      piece("b-col", "blue", 3, 1),
    ];
    expect(checkCaptures(pieces, { row: 1, col: 1 }, "red").victimIds.sort()).toEqual([
      "b-col",
      "b-row",
    ]);
  });
});

describe("victory", () => {
  it("declares blue when red has one unit left", () => {
    expect(
      getWinner([
        piece("r1", "red", 0, 0),
        piece("b1", "blue", 3, 0),
        piece("b2", "blue", 3, 1),
      ]),
    ).toBe("blue");
  });
});

