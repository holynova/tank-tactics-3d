"use client";

import {
  Bot,
  CircleHelp,
  Palette,
  RotateCcw,
  Shield,
  Swords,
  Users,
  Volume2,
  VolumeX,
} from "lucide-react";
import type { CSSProperties } from "react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { GameBoard3D } from "./scene/GameBoard3D";
import { useGameController } from "../game/use-game-controller";
import { THEMES } from "../game/themes";
import type { Difficulty, GameMode, PlayerColor, Position } from "../game/types";

function SideBadge({
  color,
  count,
  active,
}: {
  color: PlayerColor;
  count: number;
  active: boolean;
}) {
  const label = color === "red" ? "红方" : "蓝方";
  return (
    <div className={`side-badge side-badge--${color} ${active ? "is-active" : ""}`}>
      <span className="side-badge__dot" />
      <span>{label}</span>
      <strong>{count}</strong>
    </div>
  );
}

function Segmented<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: Array<{ value: T; label: string; icon?: React.ReactNode }>;
  onChange: (value: T) => void;
}) {
  return (
    <div className="segmented" role="radiogroup">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          role="radio"
          aria-checked={value === option.value}
          className={value === option.value ? "is-selected" : ""}
          onClick={() => onChange(option.value)}
        >
          {option.icon}
          {option.label}
        </button>
      ))}
    </div>
  );
}

function RulesSheet() {
  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button className="hud-icon" variant="ghost" size="icon-lg" aria-label="查看游戏规则">
          <CircleHelp />
        </Button>
      </SheetTrigger>
      <SheetContent side="bottom" className="rules-sheet">
        <SheetHeader className="rules-sheet__header">
          <p className="eyebrow">战术手册</p>
          <SheetTitle>二打一，先形成火力优势</SheetTitle>
          <SheetDescription>规则短，但每一步都在改变下一次包围。</SheetDescription>
        </SheetHeader>
        <div className="rules-grid">
          <section>
            <span className="rule-number">01</span>
            <h3>一步一回合</h3>
            <p>点选己方单位，再点相邻的上下左右空格。斜走、跳跃和进入占用格都不允许。</p>
          </section>
          <section>
            <span className="rule-number">02</span>
            <h3>连续二打一</h3>
            <p>移动后在同行或同列形成“己・己・敌”或“敌・己・己”，即可消灭最外侧敌军。</p>
          </section>
          <section>
            <span className="rule-number">03</span>
            <h3>保护与胜负</h3>
            <p>一整线挤满 4 个单位时不会集火。把敌方削减到只剩 1 个单位即获胜。</p>
          </section>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function StartPanel({
  mode,
  setMode,
  difficulty,
  setDifficulty,
  themeName,
  themeDescription,
  onStart,
}: {
  mode: GameMode;
  setMode: (mode: GameMode) => void;
  difficulty: Difficulty;
  setDifficulty: (difficulty: Difficulty) => void;
  themeName: string;
  themeDescription: string;
  onStart: () => void;
}) {
  return (
    <div className="game-overlay game-overlay--start">
      <div className="start-card">
        <p className="eyebrow">{themeName}</p>
        <h1>二打一</h1>
        <p className="start-card__lede">{themeDescription}</p>

        <div className="start-card__field">
          <span>对战方式</span>
          <Segmented
            value={mode}
            onChange={setMode}
            options={[
              { value: "pvp", label: "双人", icon: <Users /> },
              { value: "pve", label: "对电脑", icon: <Bot /> },
            ]}
          />
        </div>

        {mode === "pve" && (
          <div className="start-card__field start-card__field--compact">
            <span>电脑强度</span>
            <Segmented
              value={difficulty}
              onChange={setDifficulty}
              options={[
                { value: "easy", label: "轻松" },
                { value: "medium", label: "标准" },
                { value: "hard", label: "深入" },
              ]}
            />
          </div>
        )}

        <Button className="start-button" size="lg" onClick={onStart}>
          掷骰开战 <Swords />
        </Button>
        <p className="start-card__hint">
          {mode === "pve" ? "电脑执红方，你执蓝方" : "同屏轮流执棋"}
        </p>
      </div>
    </div>
  );
}

function DicePanel({ red, blue }: { red: number; blue: number }) {
  return (
    <div className="game-overlay game-overlay--dice" aria-live="polite">
      <div className="dice-card">
        <p className="eyebrow">争夺先手</p>
        <div className="dice-row">
          <div className="die die--red"><span>红方</span><strong>{red}</strong></div>
          <span className="dice-vs">VS</span>
          <div className="die die--blue"><span>蓝方</span><strong>{blue}</strong></div>
        </div>
      </div>
    </div>
  );
}

function GameOver({ winner, onReset }: { winner: PlayerColor; onReset: () => void }) {
  return (
    <div className="game-overlay game-overlay--end">
      <div className="end-card">
        <div className={`victory-mark victory-mark--${winner}`}><Shield /></div>
        <p className="eyebrow">战局结束</p>
        <h2>{winner === "red" ? "红方" : "蓝方"}胜利</h2>
        <p>对方已无法维持二打一阵型。</p>
        <Button className="start-button" size="lg" onClick={onReset}>
          再部署一局 <RotateCcw />
        </Button>
      </div>
    </div>
  );
}

function AccessibleGrid({
  onPress,
  pieces,
}: {
  onPress: (position: Position) => void;
  pieces: ReturnType<typeof useGameController>["pieces"];
}) {
  return (
    <div className="sr-only" role="grid" aria-label="4乘4战术棋盘">
      {Array.from({ length: 4 }, (_, row) =>
        Array.from({ length: 4 }, (_, col) => {
          const occupant = pieces.find((piece) => piece.row === row && piece.col === col);
          const content = occupant ? `${occupant.color === "red" ? "红方" : "蓝方"}单位` : "空格";
          return (
            <button
              key={`${row}-${col}`}
              role="gridcell"
              aria-label={`第 ${row + 1} 行，第 ${col + 1} 列，${content}`}
              onClick={() => onPress({ row, col })}
            />
          );
        }),
      )}
    </div>
  );
}

export function TacticalGame() {
  const game = useGameController();
  const theme = THEMES[game.themeId];
  const isBusy = game.phase === "animating" || game.phase === "rolling";
  const isBotTurn = game.mode === "pve" && game.turn === "red" && game.phase === "playing";
  const status =
    game.phase === "lobby"
      ? "等待部署"
      : game.phase === "rolling"
        ? "正在掷骰"
        : game.phase === "animating"
          ? "战术结算中"
          : game.phase === "gameover"
            ? "战局结束"
            : isBotTurn
              ? "电脑正在推演"
              : `${game.turn === "red" ? theme.redName : theme.blueName}行动`;

  const style = {
    "--theme-red": theme.red,
    "--theme-blue": theme.blue,
    "--theme-accent": theme.accent,
    "--theme-bg": theme.background,
  } as CSSProperties;

  return (
    <main className={`game-shell theme-${game.themeId}`} style={style}>
      <header className="game-hud">
        <div className="game-brand" aria-label="二打一 3D 战术游戏">
          <span className="game-brand__mark"><Swords /></span>
          <div>
            <strong>二打一</strong>
            <span>{theme.name}</span>
          </div>
        </div>

        <div className="turn-cluster" aria-live="polite">
          <SideBadge color="red" count={game.redCount} active={game.phase === "playing" && game.turn === "red"} />
          <span className="turn-status">{status}</span>
          <SideBadge color="blue" count={game.blueCount} active={game.phase === "playing" && game.turn === "blue"} />
        </div>

        <nav className="hud-actions" aria-label="游戏设置">
          <Button className="hud-icon theme-cycle" variant="ghost" size="icon-lg" onClick={game.cycleTheme} aria-label={`切换主题，当前${theme.name}`}>
            <Palette />
          </Button>
          <Button className="hud-icon" variant="ghost" size="icon-lg" onClick={() => game.setSoundEnabled(!game.soundEnabled)} aria-label={game.soundEnabled ? "关闭声音" : "开启声音"}>
            {game.soundEnabled ? <Volume2 /> : <VolumeX />}
          </Button>
          <RulesSheet />
          <Button className="hud-icon" variant="ghost" size="icon-lg" onClick={game.reset} aria-label="重新开始">
            <RotateCcw />
          </Button>
        </nav>
      </header>

      <section className="board-stage" aria-label="3D 战术棋盘">
        <GameBoard3D
          pieces={game.pieces}
          selectedId={game.selectedId}
          validMoves={game.validMoves}
          themeId={game.themeId}
          lastMove={game.lastMove}
          fx={game.fx}
          disabled={isBusy || game.phase !== "playing" || isBotTurn}
          onCellPress={game.pressCell}
        />
        <AccessibleGrid onPress={game.pressCell} pieces={game.pieces} />

        <div className="board-vignette" aria-hidden="true" />
        <div className="camera-hint" aria-label="可调整战场视角">
          <span className="camera-hint__mobile">单指旋转 · 双指缩放</span>
          <span className="camera-hint__desktop">拖动旋转 · 滚轮缩放</span>
        </div>
        <div className="battle-feed" aria-live="polite">
          {game.events.slice(-2).map((event) => (
            <p key={event.id} data-tone={event.tone}>{event.text}</p>
          ))}
        </div>
        <div className="interaction-hint">
          <span className={`pulse-dot pulse-dot--${game.turn}`} />
          {game.phase === "playing"
            ? game.selectedId
              ? "选择发光格完成移动"
              : isBotTurn
                ? "电脑正在寻找包围路线"
                : "点选一个己方单位"
            : "连续两枚友军可集火最外侧敌军"}
        </div>

        {game.phase === "lobby" && (
          <StartPanel
            mode={game.mode}
            setMode={game.setMode}
            difficulty={game.difficulty}
            setDifficulty={game.setDifficulty}
            themeName={theme.name}
            themeDescription={theme.description}
            onStart={() => void game.start()}
          />
        )}
        {game.phase === "rolling" && <DicePanel red={game.dice.red} blue={game.dice.blue} />}
        {game.phase === "gameover" && game.winner && <GameOver winner={game.winner} onReset={game.reset} />}
      </section>
    </main>
  );
}
