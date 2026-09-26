# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

以手机浏览器为主要游玩场景的玩家，同时支持桌面浏览器。

## Product Purpose

将“二打一”回合制战术规则做成可游玩的 3D 网页游戏，让玩家能在本地双人或对电脑模式中完成对局。

## Positioning

4×4 棋盘与二打一集火规则构成玩法核心；3D 战场、不同单位造型和可切换主题呈现同一套规则。

## Operating Context

玩家在触屏设备上选择单位并移动到相邻空格；本地双人轮流操作，或与三档难度的电脑对战。桌面浏览器提供相同玩法。

## Capabilities and Constraints

- 维持参考项目的 4×4 初始阵型、相邻正交移动、二打一集火、拥挤保护、友军保护与胜负条件。
- 支持本地双人、对电脑三档 AI、主题切换与可开关音效。
- 以 Three.js 呈现可调节视角的移动端优先 3D 战场；炮击使用实体炮弹与粒子命中特效。
- 相机、动画和主题只影响表现，不参与规则判定；触控操作和渲染负载适配手机浏览器。

## Evidence on Hand

- `RULES.md`：从参考项目整理的规则规格。
- 当前实现：`app/game/` 中的规则、AI 与控制器，以及 `app/components/scene/` 中的 Three.js 场景。
- 规则来源：[holynova/tank-tactics-game](https://github.com/holynova/tank-tactics-game)。

## Product Principles

- 规则判定与视觉表现分离，保持对局规则一致。
- 手机上触控、镜头和信息层级易于理解与操作。
- 移动、开炮、命中和胜负都给出清晰的视听反馈。
