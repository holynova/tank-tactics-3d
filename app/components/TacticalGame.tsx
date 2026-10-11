"use client";

import { Bot, CircleHelp, Palette, RotateCcw, Settings2, Shield, Users, Volume2, VolumeX, X } from "lucide-react";
import { useState, type CSSProperties } from "react";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { GameBoard3D } from "./scene/GameBoard3D";
import { useGameController } from "../game/use-game-controller";
import { THEMES } from "../game/themes";
import type { Difficulty, PlayerColor, Position } from "../game/types";

function SideBadge({color,count,active}:{color:PlayerColor;count:number;active:boolean}) {
  return <div className={`side-badge side-badge--${color} ${active?"is-active":""}`}>
    <span className="team-stripes" aria-hidden="true"/><span>{color==="red"?"红方":"蓝方"}</span><strong>{count}</strong>
    <i className="plate-screw plate-screw--tl"/><i className="plate-screw plate-screw--br"/>
  </div>;
}

function RulesSheet({onOpenChange}:{onOpenChange:(open:boolean)=>void}) {
  return <Sheet onOpenChange={onOpenChange}>
    <SheetTrigger asChild><button className="utility-button" aria-label="查看游戏规则"><CircleHelp aria-hidden="true"/></button></SheetTrigger>
    <SheetContent side="bottom" className="rules-sheet">
      <SheetHeader><p className="eyebrow">战术手册 / FIELD MANUAL</p><SheetTitle>二打一，形成火力优势</SheetTitle><SheetDescription>每次移动一格，让两枚友军形成连续阵线。</SheetDescription></SheetHeader>
      <div className="rules-grid">
        <section><span className="rule-number">01</span><h3>一步一回合</h3><p>点选己方单位，再点相邻的上下左右空格。不能斜走、跳跃或进入占用格。</p></section>
        <section><span className="rule-number">02</span><h3>连续二打一</h3><p>移动后，同行或同列连续形成“己・己・敌”或“敌・己・己”，便会集火最外侧敌军。</p></section>
        <section><span className="rule-number">03</span><h3>保护与胜负</h3><p>整线挤满四枚单位，或目标外侧紧邻同色友军时受保护。将敌方削减至一枚即可获胜。</p></section>
      </div>
    </SheetContent>
  </Sheet>;
}

function DifficultyControl({value,onChange}:{value:Difficulty;onChange:(d:Difficulty)=>void}) {
  return <div className="difficulty-control" role="radiogroup" aria-label="电脑强度">
    <span>电脑强度</span>
    {([["easy","简单"],["medium","标准"],["hard","困难"]] as const).map(([id,label])=><button key={id} role="radio" aria-checked={value===id} className={value===id?"is-selected":""} onClick={()=>onChange(id)}>{label}</button>)}
  </div>;
}

function AccessibleGrid({onPress,pieces}:{onPress:(p:Position)=>void;pieces:ReturnType<typeof useGameController>["pieces"]}) {
  return <div className="sr-only" role="grid" aria-label="4乘4战术棋盘">
    {Array.from({length:4},(_,row)=>Array.from({length:4},(_,col)=>{
      const piece=pieces.find(p=>p.row===row&&p.col===col);
      return <button key={`${row}-${col}`} role="gridcell" aria-label={`第 ${row+1} 行，第 ${col+1} 列，${piece?(piece.color==="red"?"红方":"蓝方")+"单位":"空格"}`} onClick={()=>onPress({row,col})}/>;
    }))}
  </div>;
}

export function TacticalGame() {
  const game=useGameController();
  const [settingsOpen,setSettingsOpen]=useState(false);
  const [rulesOpen,setRulesOpen]=useState(false);
  const theme=THEMES[game.themeId];
  const busy=game.phase==="rolling"||game.phase==="animating";
  const shooting=game.fx.attackerIds.length>0||game.fx.burstPositions.length>0;
  const botTurn=game.mode==="pve"&&game.turn==="red"&&game.phase==="playing";
  const status=game.phase==="rolling"?"争夺先手":game.phase==="animating"?(game.fx.burstPositions.length?"命中爆破":shooting?"重炮集火":"装甲机动"):game.phase==="gameover"?"战局结束":botTurn?"电脑正在推演":`${game.turn==="red"?"红方":"蓝方"}行动`;
  const instruction=game.selectedId?"选择发光格完成移动":botTurn?"等待电脑完成机动":"点选己方单位 · 移动一格";
  const style={"--theme-red":theme.red,"--theme-blue":theme.blue,"--theme-accent":theme.accent,"--theme-bg":theme.background} as CSSProperties;
  return <main className={`game-shell theme-${game.themeId}`} style={style}>
    <h1 className="sr-only">二打一 · 轨道重炮阵地</h1>
    <header className="battlefield-hud" aria-live="polite">
      <SideBadge color="red" count={game.redCount} active={game.phase==="playing"&&game.turn==="red"}/>
      {game.phase!=="lobby"&&<p className="turn-status">{status}</p>}
      <SideBadge color="blue" count={game.blueCount} active={game.phase==="playing"&&game.turn==="blue"}/>
    </header>
    <section className="board-stage" aria-label="3D 战术棋盘">
      <GameBoard3D pieces={game.pieces} scars={game.scars} selectedId={game.selectedId} validMoves={game.validMoves} themeId={game.themeId} lastMove={game.lastMove} fx={game.fx}
        cameraEnabled={!settingsOpen&&!rulesOpen} disabled={busy||game.phase!=="playing"||botTurn||settingsOpen||rulesOpen} onCellPress={game.pressCell}/>
      <AccessibleGrid pieces={game.pieces} onPress={game.pressCell}/>
      <div className="board-vignette" aria-hidden="true"/>
      {game.phase==="playing"&&<div className="battle-feed" aria-live="polite">{game.events.slice(-1).map(e=><p key={e.id} data-tone={e.tone}>{e.text}</p>)}</div>}
      {game.phase==="rolling"&&<div className="game-overlay game-overlay--dice" aria-live="polite"><div className="dice-card">
        <p className="eyebrow">争夺先手</p><div className="dice-row"><div className="die die--red"><span>红方</span><strong>{game.dice.red}</strong></div><span className="dice-vs">VS</span><div className="die die--blue"><span>蓝方</span><strong>{game.dice.blue}</strong></div></div>
      </div></div>}
      {game.phase==="gameover"&&game.winner&&<div className="game-overlay game-overlay--end"><div className="end-card">
        <Shield className={`victory-mark victory-mark--${game.winner}`}/><p className="eyebrow">阵地已控制</p><h2>{game.winner==="red"?"红方":"蓝方"}胜利</h2><p>对方已无法维持二打一阵型。</p>
        <button className="start-button" onClick={game.reset}>再部署一局</button>
      </div></div>}
    </section>

    <footer className="command-console">
      <div className="console-ridge" aria-hidden="true"><span>04</span><span>ORBITAL BATTERY</span><span>二打一</span></div>
      {game.phase==="lobby"&&game.mode==="pve"&&<DifficultyControl value={game.difficulty} onChange={game.setDifficulty}/>}
      {game.phase==="lobby"?<div className="command-row">
        <button className={`mode-button ${game.mode==="pvp"?"is-selected":""}`} aria-pressed={game.mode==="pvp"} onClick={()=>game.setMode("pvp")}><Users aria-hidden="true"/><span>本地双人</span></button>
        <div className="launch-housing"><button className="start-button" onClick={()=>void game.start()}>掷骰开战</button></div>
        <button className={`mode-button ${game.mode==="pve"?"is-selected":""}`} aria-pressed={game.mode==="pve"} onClick={()=>game.setMode("pve")}><Bot aria-hidden="true"/><span>对电脑</span></button>
      </div>:<div className="command-row command-row--playing">
        <button className="mode-button mode-button--small" onClick={game.reset}><RotateCcw aria-hidden="true"/><span>重新部署</span></button>
        <div className="command-status" aria-live="polite"><span className={`status-lamp status-lamp--${game.turn}`}/><strong>{status}</strong><p>{busy?(shooting?"炮击结算中，请稍候":"机动中，请稍候"):game.phase==="gameover"?"点击再部署开启新战局":instruction}</p></div>
        <button className="mode-button mode-button--small" onClick={()=>setSettingsOpen(true)}><Settings2 aria-hidden="true"/><span>战术设置</span></button>
      </div>}
      <div className="console-utility">
        <button className="utility-button" aria-label="打开游戏设置" aria-expanded={settingsOpen} onClick={()=>setSettingsOpen(v=>!v)}><Settings2 aria-hidden="true"/></button>
        <p><span className="camera-hint__mobile">拖动旋转 · 双指缩放</span><span className="camera-hint__desktop">拖动旋转 · 滚轮缩放</span></p>
        <RulesSheet onOpenChange={setRulesOpen}/>
      </div>
    </footer>
    {settingsOpen&&<>
      <button className="settings-backdrop" aria-label="关闭游戏设置" onClick={()=>setSettingsOpen(false)}/>
      <aside className="settings-panel" role="dialog" aria-label="游戏设置">
        <div className="settings-heading"><div><p className="eyebrow">战术终端</p><h2>阵地设置</h2></div><button className="utility-button" aria-label="关闭设置" onClick={()=>setSettingsOpen(false)}><X/></button></div>
        <button className="settings-item" onClick={game.cycleTheme}><Palette/><span>切换战区<strong>{theme.name}</strong></span></button>
        <button className="settings-item" onClick={()=>game.setSoundEnabled(!game.soundEnabled)}>{game.soundEnabled?<Volume2/>:<VolumeX/>}<span>战场音效<strong>{game.soundEnabled?"开启":"关闭"}</strong></span></button>
        {game.mode==="pve"&&game.phase==="lobby"&&<DifficultyControl value={game.difficulty} onChange={game.setDifficulty}/>}
        <p className="settings-note">{game.mode==="pve"?"电脑执红方，你执蓝方。":"同屏双人，红蓝双方轮流执棋。"}<br/>4×4 棋盘 · 连续两枚友军集火最外侧敌军。</p>
        <button className="settings-item" onClick={()=>{game.reset();setSettingsOpen(false);}}><RotateCcw/><span>重新部署<strong>返回开战准备</strong></span></button>
      </aside>
    </>}
  </main>;
}
