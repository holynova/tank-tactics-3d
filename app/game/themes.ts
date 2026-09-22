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
    name: "月面机甲",
    shortName: "月面",
    description: "磁轨步行机在冷寂环形山间争夺能源阵列。",
    redName: "熔核",
    blueName: "极光",
    red: "#ff5d3d",
    blue: "#43d7ff",
    accent: "#e8ff60",
    background: "#070913",
    board: "#232838",
    cell: "#343b4f",
    fog: "#090b16",
  },
  sky: {
    id: "sky",
    name: "浮空神殿",
    shortName: "云庭",
    description: "风之守卫在漂浮石庭上编织古老的包围阵。",
    redName: "赤焰",
    blueName: "青岚",
    red: "#ff6b4a",
    blue: "#50d6c3",
    accent: "#ffe496",
    background: "#91b7cb",
    board: "#6d766d",
    cell: "#a7b5a5",
    fog: "#b8d4df",
  },
  abyss: {
    id: "abyss",
    name: "深海遗迹",
    shortName: "深海",
    description: "微型潜航器在发光遗迹间悄然完成双舰锁定。",
    redName: "珊瑚",
    blueName: "幽蓝",
    red: "#ff684c",
    blue: "#38bdf8",
    accent: "#65ffc7",
    background: "#021822",
    board: "#12343b",
    cell: "#18505a",
    fog: "#06232d",
  },
};

export const THEME_ORDER: ThemeId[] = ["lunar", "sky", "abyss"];

