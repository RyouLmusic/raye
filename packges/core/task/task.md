# Opencode 架构改造任务拆解

- [ ] refactor: 融合与重构执行处理器 (Processor Layer)
  - [ ] 修改 `executor.ts`，开启/优化 `maxSteps` 支持使其能独当一面处理整个循环。
  - [ ] 彻底清理并删除 `planner.ts` 和 `reasoner.ts` 两套冗余流程。
  - [ ] 清理 `index.ts` 以及相关 Processor 各类对外暴露的冗杂接口。

- [ ] refactor: 极简化状态大循环 (Agent ReAct Loop)
  - [ ] 改造 `loop.ts`：移除原有的 `PLANNING`、`OBSERVING` 状态机流转。
  - [ ] 使 `loop.ts` 仅维护单一循环层并依赖模型驱动（配合控制工具或自然的停止原因 `finishReason`）。

- [ ] feat: 实现控制工具集 (Control Tools)
  - [ ] 编写 `finish_task` 工具：为主模型提供显式的结束执行流出口。
  - [ ] 编写 `ask_user` 工具：解决大模型想向用户发问和获取确认的问题。
  - [ ] 绑定这些控制工具到模型的通用工具集里。

- [ ] feat: 实现子代理拆分工具 (Subagent Tool)
  - [ ] 开发 `task_tool.ts`，包装一个 `spawn_agent` 工具。
  - [ ] 编写子会话生成逻辑：在工具体内建立独立的 `SessionManager` 和循环堆栈。
  - [ ] 将子代理返回的结果浓缩并映射回主循环的 Tool Response 中。

- [ ] feat: Prompt 与工作流约束重构
  - [ ] 在 `prompts.ts` （或其他提示源）中重新构建基于阶段 (Phases) 分治的 System Prompt。
  - [ ] 按 Opencode 逻辑，规范指导大模型如何调度子代理（Explore阶段）、何时应该呼叫 `finish_task`。
