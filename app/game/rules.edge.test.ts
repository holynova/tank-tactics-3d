import { describe, expect, it } from "vitest";
import {
  applyMove,
  checkCaptures,
  getWinner,
} from "./rules";
import type { Piece } from "./types";

const piece = (
  id: string,
  color: Piece["color"],
  row: number,
  col: number,
): Piece => ({ id, color, row, col, facing: 0 });

describe("movement edge cases", () => {
  it("does not let the non-active side move", () => {
    const pieces = [piece("red-1", "red", 1, 1), piece("blue-1", "blue", 3, 3)];

    expect(() =>
      applyMove(
        pieces,
        { pieceId: "blue-1", from: { row: 3, col: 3 }, to: { row: 2, col: 3 } },
        "red",
      ),
    ).toThrow("Move does not belong to the active player");
  });

  it("rejects out-of-bounds and occupied destinations", () => {
    const pieces = [
      piece("red-1", "red", 0, 0),
      piece("red-2", "red", 1, 0),
      piece("blue-1", "blue", 3, 3),
    ];

    expect(() =>
      applyMove(
        pieces,
        { pieceId: "red-1", from: { row: 0, col: 0 }, to: { row: -1, col: 0 } },
        "red",
      ),
    ).toThrow("Illegal move");
    expect(() =>
      applyMove(
        pieces,
        { pieceId: "red-1", from: { row: 0, col: 0 }, to: { row: 1, col: 0 } },
        "red",
      ),
    ).toThrow("Illegal move");
  });
});

describe("capture edge cases", () => {
  it.each([
    {
      name: "A-A-V",
      pieces: [
        piece("red-left", "red", 1, 1),
        piece("red-middle", "red", 1, 2),
        piece("blue-right", "blue", 1, 3),
      ],
      landing: { row: 1, col: 2 },
      victim: "blue-right",
      attackers: ["red-left", "red-middle"],
    },
    {
      name: "V-A-A",
      pieces: [
        piece("blue-left", "blue", 2, 0),
        piece("red-middle", "red", 2, 1),
        piece("red-right", "red", 2, 2),
      ],
      landing: { row: 2, col: 2 },
      victim: "blue-left",
      attackers: ["red-middle", "red-right"],
    },
  ])("captures an exposed enemy in $name order", ({ pieces, landing, victim, attackers }) => {
    const result = checkCaptures(pieces, landing, "red");

    expect(result.victimIds).toEqual([victim]);
    expect(result.attackerIds.sort()).toEqual([...attackers].sort());
    expect(result.protectedIds).toEqual([]);
  });

  it("protects a crowded line from capture", () => {
    const pieces = [
      piece("red-left", "red", 1, 0),
      piece("red-middle", "red", 1, 1),
      piece("blue-target", "blue", 1, 2),
      piece("blue-friend", "blue", 1, 3),
    ];

    const result = checkCaptures(pieces, { row: 1, col: 1 }, "red");

    expect(result.victimIds).toEqual([]);
    expect(result.protectedIds).toEqual([]);
    expect(result.crowdedLines).toEqual(["row"]);
  });

  it("settles distinct captures from the landing row and column once", () => {
    const pieces = [
      piece("red-mover", "red", 0, 1),
      piece("red-row", "red", 1, 0),
      piece("blue-row", "blue", 1, 2),
      piece("red-column", "red", 2, 1),
      piece("blue-column", "blue", 3, 1),
      piece("blue-spare", "blue", 3, 3),
      piece("blue-spare-2", "blue", 0, 3),
    ];

    const result = applyMove(
      pieces,
      { pieceId: "red-mover", from: { row: 0, col: 1 }, to: { row: 1, col: 1 } },
      "red",
    );

    expect(result.capture.victimIds).toEqual(["blue-row", "blue-column"]);
    expect(new Set(result.capture.victimIds).size).toBe(result.capture.victimIds.length);
    expect(result.capture.attackerIds.sort()).toEqual(
      ["red-mover", "red-row", "red-column"].sort(),
    );
    expect(result.pieces.map((candidate) => candidate.id).sort()).toEqual(
      ["red-mover", "red-row", "red-column", "blue-spare", "blue-spare-2"].sort(),
    );
    expect(result.winner).toBe(null);
  });
});

describe("victory thresholds", () => {
  it("declares a winner when either side reaches one unit or fewer", () => {
    expect(
      getWinner([
        piece("red-1", "red", 0, 0),
        piece("blue-1", "blue", 3, 0),
        piece("blue-2", "blue", 3, 1),
      ]),
    ).toBe("blue");
    expect(
      getWinner([
        piece("red-1", "red", 0, 0),
        piece("red-2", "red", 0, 1),
        piece("blue-1", "blue", 3, 0),
      ]),
    ).toBe("red");
    expect(getWinner([piece("red-1", "red", 0, 0)])).toBe("blue");
  });
});
