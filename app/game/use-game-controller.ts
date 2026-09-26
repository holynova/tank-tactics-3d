"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { findBestMove } from "./ai";
import {
  applyMove,
  buildGrid,
  createInitialPieces,
  getFacing,
  getValidMoves,
  opponent,
} from "./rules";
import { THEME_ORDER } from "./themes";
import type {
  BattleEvent,
  DiceResult,
  Difficulty,
  GameMode,
  GamePhase,
  Move,
  Piece,
  PlayerColor,
  Position,
  ThemeId,
} from "./types";
import { createGameAudio } from "./audio";

const wait = (milliseconds: number) =>
  new Promise<void>((resolve) => window.setTimeout(resolve, milliseconds));

export interface CombatFx {
  attackerIds: string[];
  victimIds: string[];
  burstPositions: Position[];
}

export function useGameController() {
  const [pieces, setPieces] = useState<Piece[]>(createInitialPieces);
  const [turn, setTurn] = useState<PlayerColor>("red");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [phase, setPhase] = useState<GamePhase>("lobby");
  const [mode, setMode] = useState<GameMode>("pvp");
  const [difficulty, setDifficulty] = useState<Difficulty>("medium");
  const [themeId, setThemeId] = useState<ThemeId>("lunar");
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [dice, setDice] = useState<DiceResult>({ red: 1, blue: 1 });
  const [winner, setWinner] = useState<PlayerColor | null>(null);
  const [lastMove, setLastMove] = useState<Position | null>(null);
  const [fx, setFx] = useState<CombatFx>({ attackerIds: [], victimIds: [], burstPositions: [] });
  const [events, setEvents] = useState<BattleEvent[]>([
    { id: 1, text: "战术沙盘已就绪", tone: "neutral" },
  ]);

  const actionToken = useRef(0);
  const eventId = useRef(2);
  const soundRef = useRef<ReturnType<typeof createGameAudio> | null>(null);
  const soundEnabledRef = useRef(soundEnabled);

  useEffect(() => {
    soundEnabledRef.current = soundEnabled;
  }, [soundEnabled]);

  useEffect(() => {
    soundRef.current = createGameAudio(() => soundEnabledRef.current);
    return () => soundRef.current?.dispose();
  }, []);

  const addEvent = useCallback((text: string, tone: BattleEvent["tone"] = "neutral") => {
    setEvents((current) => [...current.slice(-5), { id: eventId.current++, text, tone }]);
  }, []);

  const reset = useCallback(() => {
    actionToken.current += 1;
    setPieces(createInitialPieces());
    setTurn("red");
    setSelectedId(null);
    setPhase("lobby");
    setWinner(null);
    setLastMove(null);
    setFx({ attackerIds: [], victimIds: [], burstPositions: [] });
    setDice({ red: 1, blue: 1 });
    setEvents([{ id: eventId.current++, text: "新战局已部署", tone: "neutral" }]);
  }, []);

  const start = useCallback(async () => {
    const token = ++actionToken.current;
    setPhase("rolling");
    setSelectedId(null);
    addEvent("双方正在争夺先手…");

    let result: DiceResult = { red: 1, blue: 1 };
    do {
      for (let frame = 0; frame < 9; frame += 1) {
        if (token !== actionToken.current) return;
        result = {
          red: Math.ceil(Math.random() * 6),
          blue: Math.ceil(Math.random() * 6),
        };
        setDice(result);
        soundRef.current?.play("dice");
        await wait(80 + frame * 7);
      }
      if (result.red === result.blue) {
        addEvent(`双方同为 ${result.red}，重新掷骰`);
        await wait(360);
      }
    } while (result.red === result.blue);

    if (token !== actionToken.current) return;
    const first: PlayerColor = result.red > result.blue ? "red" : "blue";
    setTurn(first);
    setPhase("playing");
    addEvent(`${first === "red" ? "红方" : "蓝方"}取得先手`, first);
  }, [addEvent]);

  const performMove = useCallback(
    async (move: Move, activeColor: PlayerColor) => {
      const token = actionToken.current;
      const movingPiece = pieces.find((piece) => piece.id === move.pieceId);
      if (!movingPiece || phase !== "playing") return;

      const result = applyMove(pieces, move, activeColor);
      const victimSet = new Set(result.capture.victimIds);
      const movedWithVictims = pieces.map((piece) =>
        piece.id === move.pieceId
          ? {
              ...piece,
              row: move.to.row,
              col: move.to.col,
              facing: getFacing(move.from, move.to),
            }
          : piece,
      );

      setPhase("animating");
      setSelectedId(null);
      setLastMove(move.to);
      setPieces(movedWithVictims);
      soundRef.current?.play("move");
      await wait(430);
      if (token !== actionToken.current) return;

      if (result.capture.crowdedLines.length) {
        addEvent("阵线过于拥挤，本回合集火失效");
      }

      if (result.capture.victimIds.length) {
        setFx({
          attackerIds: result.capture.attackerIds,
          victimIds: result.capture.victimIds,
          burstPositions: [],
        });
        soundRef.current?.play("fire");
        // Let the physical shells arc across the board before rules state removes
        // their targets; the visual flight never determines whether a hit lands.
        await wait(960);
        if (token !== actionToken.current) return;
        setPieces((current) => current.filter((piece) => !victimSet.has(piece.id)));
        setFx((current) => ({
          ...current,
          attackerIds: [],
          burstPositions: movedWithVictims
            .filter((piece) => victimSet.has(piece.id))
            .map((piece) => ({ row: piece.row, col: piece.col })),
        }));
        soundRef.current?.play("capture");
        addEvent(
          `${activeColor === "red" ? "红方" : "蓝方"}完成 ${result.capture.victimIds.length > 1 ? "双线" : "二打一"}集火`,
          activeColor,
        );
        await wait(820);
        if (token !== actionToken.current) return;
        setFx({ attackerIds: [], victimIds: [], burstPositions: [] });
      } else {
        addEvent(`${activeColor === "red" ? "红方" : "蓝方"}完成机动`, activeColor);
      }

      if (result.winner) {
        setWinner(result.winner);
        setPhase("gameover");
        soundRef.current?.play("win");
        addEvent(`${result.winner === "red" ? "红方" : "蓝方"}赢得战局`, "success");
        return;
      }

      setTurn(opponent(activeColor));
      setPhase("playing");
    },
    [addEvent, phase, pieces],
  );

  const grid = useMemo(() => buildGrid(pieces), [pieces]);
  const selectedPiece = useMemo(
    () => pieces.find((piece) => piece.id === selectedId) ?? null,
    [pieces, selectedId],
  );
  const validMoves = useMemo(
    () => (selectedPiece ? getValidMoves(selectedPiece, pieces) : []),
    [pieces, selectedPiece],
  );

  const pressCell = useCallback(
    (position: Position) => {
      if (phase !== "playing" || (mode === "pve" && turn === "red")) return;
      const clicked = grid[position.row][position.col];

      if (clicked?.color === turn) {
        setSelectedId((current) => (current === clicked.id ? null : clicked.id));
        soundRef.current?.play("select");
        return;
      }

      if (!clicked && selectedPiece) {
        const legal = validMoves.some(
          (move) => move.row === position.row && move.col === position.col,
        );
        if (legal) {
          void performMove(
            {
              pieceId: selectedPiece.id,
              from: { row: selectedPiece.row, col: selectedPiece.col },
              to: position,
            },
            turn,
          );
        }
      }
    },
    [grid, mode, performMove, phase, selectedPiece, turn, validMoves],
  );

  useEffect(() => {
    if (phase !== "playing" || mode !== "pve" || turn !== "red") return;
    const timer = window.setTimeout(() => {
      const move = findBestMove(pieces, difficulty, "red");
      if (move) void performMove(move, "red");
      else setTurn("blue");
    }, 650);
    return () => window.clearTimeout(timer);
  }, [difficulty, mode, performMove, phase, pieces, turn]);

  const cycleTheme = useCallback(() => {
    setThemeId((current) => {
      const index = THEME_ORDER.indexOf(current);
      return THEME_ORDER[(index + 1) % THEME_ORDER.length];
    });
  }, []);

  const redCount = pieces.filter((piece) => piece.color === "red").length;
  const blueCount = pieces.filter((piece) => piece.color === "blue").length;

  return {
    pieces,
    turn,
    selectedId,
    phase,
    mode,
    setMode,
    difficulty,
    setDifficulty,
    themeId,
    cycleTheme,
    soundEnabled,
    setSoundEnabled,
    dice,
    winner,
    lastMove,
    fx,
    events,
    validMoves,
    redCount,
    blueCount,
    start,
    reset,
    pressCell,
  };
}
