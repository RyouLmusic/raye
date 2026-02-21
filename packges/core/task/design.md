# Opencode ReAct 架构重构计划

本文档旨在规划 Raye 项目的 ReAct 循环架构重构。重构的目标是借鉴 `opencode` 项目中解耦的、基于工具驱动的“Agent-as-a-Tool”（代理即工具）架构，彻底移除硬编码的状态流转，并将底层能力下沉交由 Vercel AI SDK 的 Unified Executor 和大模型的原生 Tool Calling 去处理。

## 重构目标
通过本次改造，我们希望去除 TypeScript 代码中复杂的 `while` 和 `switch/case` 状态判断逻辑 (`INIT` -> `PLANNING` -> `OBSERVING` -> `EXECUTING`)。未来的系统应该：
1. **单一入口驱动**：依赖 `maxSteps` 让大模型自发完成“思考-调用-观察-再思考”的微循环。
2. **工具化控制**：将子代理拉起、结束判定等流程变更为模型可调用的工具集合。
3. **消除冗余调度**：淘汰为了隔离 Plan 和 Reason 阶段而强行引入的多模型串行调度。

## 详细改造方案

---
### 核心处理器层 (Session Processor Layer)
#### [修改] `executor.ts`
- 将原有的散装逻辑（推理、执行、观察）合并到 `executor.ts` 中的单次 `streamText` 调用。
- 依赖并开启 Vercel AI SDK 的 `maxSteps` 机制。`execute` 函数现在只需要专门处理工具降级、重试控制和流事件派发即可。

#### [删除] `planner.ts`
- 废弃全局。大模型的“全局规划能力”不再需要单独切分出一个模型调用来写计划，而是由 executor 在首轮调用时结合 System Prompt 自发完成内源性思考 (CoT)。

#### [删除] `reasoner.ts`
- 废弃该机制。

---
### ReAct 主循环 (Agent ReAct Loop)
#### [修改] `loop.ts`
- 移除所有与状态流转相关的枚举（如 `PLANNING`, `OBSERVING`）和庞大的 `while` 状态机。
- 将原本多阶段拼凑的循环替换为对 `executor.execute()` 的一次主调用（它能在内部因为 `maxSteps` 存续多次）。
- 更改程序的终态校验机制：循环的停止条件除了模型自然耗尽意图（`finishReason === 'stop'`）之外，增加对强制控制工具调用的识别（例如触发了 `finish_task` 工具）。

---
### 代理与控制工具系统 (Tooling System)
#### [新增] `task.ts` (子代理/任务池工具)
- 新增一枚 "Subagent" 级工具（命名为 `spawn_agent` 或 `task_tool`）。
- **作用**：当主代理面临需要扫描大量文件或其他容易导致主上下文污染的任务时，它可以通过该工具唤起一个隔离的子代理。子代理在其独立的 Session 下运行，完成后仅返回精简的摘要内容给主代理，防止 Token 爆炸。

#### [新增] `control.ts` (流程流转工具)
- 增加确定性的控制类工具供模型调用：
  - `finish_task`：大模型通过调用此工具来显式向代码通知“我已经完成了所有编码测试”，准许跳出当前死循环。
  - `ask_user`：在不需要退出任务时进行主动提问求助。

---
### 系统提示词与机制配合 (System Prompts)
#### [修改] `prompts.ts` 或对等配置源
- 重写 System Prompt，在提示词层面上对代理设置流水线阶段要求：
  - “阶段 1：使用工具探索理解”。
  - “阶段 2：使用分身子代理梳理诉求”。
  - “阶段 3：如果完成任务，调用 `finish_task`”。

## 验证与测试标准
- **回归测试**：输入简单的算术加法等请求，观测引擎是否能在一次或两次工具交互内迅速停机并抛出正确结果，而不会陷入“计划->执行”的多轮冗余延迟。
- **子任务阻断测试**：使用 `spawn_agent` 调用隔离环境的任务，观察父 Session 中 `messages` 数组是否未被子代理的无关动作污染。
- **可视化日志**：在 TUI (Terminal UI) 测试运行时，应看到连续贯通的流输出，而不再是以前断裂的两个“独立思考模型”。
