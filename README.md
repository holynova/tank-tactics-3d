# 二打一 · 3D 战术沙盘

一个以手机浏览器为主的 Three.js 回合制战术游戏。规则基于 [holynova/tank-tactics-game](https://github.com/holynova/tank-tactics-game)，表现层重制为高台俯瞰的轨道重炮阵地。

在线试玩：[GitHub Pages](https://holynova.github.io/tank-tactics-3d/) · [ChatGPT Site](https://tank-tactics-3d.holy-nova.chatgpt.site/)

## 功能

- 与参考项目一致的 4×4 移动、二打一集火、拥挤保护和胜负规则
- 本地双人以及三档难度的 PvE Minimax
- 月背攻城线、轨道熔炉、冰环前哨三套同世界观战区
- 履带主战炮车、自行火炮与步行炮台等不同轮廓
- 一指环视、双指缩放/平移，以及放大、缩小、复位按钮
- 炮塔追踪、后坐、实体抛射炮弹、炮口闪光、冲击环、碎片与烟尘
- 移动端优先的安全区 HUD，兼顾桌面与辅助技术
- 纯函数规则引擎与 18 项自动化测试

## 运行

需要 Node.js 22.13 或更高版本。

```bash
npm install
npm run dev
```

开发地址默认为 `http://localhost:5173/`。

## 验证

```bash
npm test
npx tsc --noEmit
npm run build
npm run build:pages
```

## 目录

- `app/game/`：规则、AI、主题、音效与控制器
- `app/components/scene/`：Three.js 棋盘、单位模型和主题环境
- `app/components/TacticalGame.tsx`：移动端 HUD 与完整游戏流程
- `PLAN.md`：范围、里程碑与验收标准
- `RULES.md`：从参考源码提取的规则规格
- `TASKS.md`：任务拆分与完成状态

## 视觉资产

履带主战坦克与自行火炮使用随站点托管的轻量 GLB，履带细节、步行炮台和场景均由 Three.js 补充；游戏不请求外部模型 CDN。第三方模型出处和许可见 [`ASSET_LICENSES.md`](ASSET_LICENSES.md)。

## 项目文档

- [`PRODUCT.md`](PRODUCT.md)：平台、玩法和范围
- [`PLAN.md`](PLAN.md)：验收标准与实现计划
- [`TASKS.md`](TASKS.md)：拆分任务与状态
- [`RULES.md`](RULES.md)：参考项目规则规格

## 致谢

玩法与规则参考 MIT License 项目 [Tank Tactics Game](https://github.com/holynova/tank-tactics-game)。本项目为独立的 3D 重制实现。外部模型分别遵循其页面标注的 CC0 1.0，使用时不代表原作者对本游戏背书。
