# 二打一 · 3D 战术沙盘

一个以移动端为主的 Three.js 回合制战术游戏。规则基于 [holynova/tank-tactics-game](https://github.com/holynova/tank-tactics-game)，表现层从 2D 坦克棋盘重做为可切换主题的低多边形 3D 沙盘。

## 功能

- 与参考项目一致的 4×4 移动、二打一集火、拥挤保护和胜负规则
- 本地双人以及三档难度的 PvE Minimax
- 月面机甲、浮空神殿、深海遗迹三套模型与环境
- 转向、移动、集火光束、消散与合成音效反馈
- 移动端优先的触控 HUD，兼顾桌面与辅助技术
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
```

## 目录

- `app/game/`：规则、AI、主题、音效与控制器
- `app/components/scene/`：Three.js 棋盘、单位模型和主题环境
- `app/components/TacticalGame.tsx`：移动端 HUD 与完整游戏流程
- `PLAN.md`：范围、里程碑与验收标准
- `RULES.md`：从参考源码提取的规则规格
- `TASKS.md`：任务拆分与完成状态

## 视觉资产

首版模型全部使用 Three.js 几何体在代码中生成，不依赖外部模型与纹理，避免移动端下载负担和第三方授权问题。

## 致谢

玩法与规则参考 MIT License 项目 [Tank Tactics Game](https://github.com/holynova/tank-tactics-game)。本项目为独立的 3D 重制实现。

