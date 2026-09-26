import type { ThemeId } from "./types";

export interface ThemeDefinition {
  id: ThemeId;
  name: string;
  shortName: string;
  description: string;
  redName: string;
  blueName: string;
  red: string;
  blue: string;
  accent: string;
  background: string;
  board: string;
  cell: string;
  fog: string;
}

export const THEMES: Record<ThemeId, ThemeDefinition> = {
  lunar: {
    id: "lunar",
    name: "月背攻城线",
    shortName: "月背",
    description: "履带重炮沿壕沟推进，在陨石坑间完成双线集火。",
    redName: "熔核炮队",
    blueName: "寒光炮队",
    red: "#ff6348",
    blue: "#55caff",
    accent: "#ffbd62",
    background: "#090c14",
    board: "#222b39",
    cell: "#333e50",
    fog: "#10131c",
  },
  sky: {
    id: "sky",
    name: "轨道熔炉",
    shortName: "熔炉",
    description: "在失压船坞和浮动残骸间争夺火控节点，实施交叉炮击。",
    redName: "赤星炮队",
    blueName: "星港炮队",
    red: "#ff7658",
    blue: "#58d4f0",
    accent: "#ffd27d",
    background: "#0b111b",
    board: "#26313d",
    cell: "#374652",
    fog: "#111926",
  },
  abyss: {
    id: "abyss",
    name: "冰环前哨",
    shortName: "冰环",
    description: "步行炮台在碎冰天体的防线间机动，抢占唯一的射击窗口。",
    redName: "余烬重炮",
    blueName: "霜环重炮",
    red: "#ff765d",
    blue: "#60d7ed",
    accent: "#a6f4ff",
    background: "#07141e",
    board: "#203642",
    cell: "#304b58",
    fog: "#10202b",
  },
};

export const THEME_ORDER: ThemeId[] = ["lunar", "sky", "abyss"];
