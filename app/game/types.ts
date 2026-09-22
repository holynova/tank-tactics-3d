export type PlayerColor = "red" | "blue";
export type GameMode = "pvp" | "pve";
export type Difficulty = "easy" | "medium" | "hard";
export type ThemeId = "lunar" | "sky" | "abyss";
export type GamePhase = "lobby" | "rolling" | "playing" | "animating" | "gameover";

export interface Position {
  row: number;
  col: number;
}

export interface Piece extends Position {
  id: string;
  color: PlayerColor;
  facing: 0 | 90 | 180 | 270;
}

export interface Move {
  pieceId: string;
  from: Position;
  to: Position;
}

export interface CaptureResult {
  victimIds: string[];
  attackerIds: string[];
  protectedIds: string[];
  crowdedLines: Array<"row" | "column">;
}

export interface TurnResult {
  pieces: Piece[];
  move: Move;
  capture: CaptureResult;
  winner: PlayerColor | null;
}

export interface DiceResult {
  red: number;
  blue: number;
}

export interface BattleEvent {
  id: number;
  text: string;
  tone?: "neutral" | "red" | "blue" | "success";
}

