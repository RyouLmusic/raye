# Opencode 架构改造任务拆解

- [x] refactor: 融合与重构执行处理器 (Processor Layer)
  - [x] 修改 `executor.ts`，开启/优化 `maxSteps` 支持使其能独当一面处理整个循环。
  - [x] 彻底清理并删除 `planner.ts` 和 `reasoner.ts` 两套冗余流程。
  - [x] 清理 `index.ts` 以及相关 Processor 各类对外暴露的冗杂接口。

- [x] refactor: 极简化状态大循环 (Agent ReAct Loop)
  - [x] 改造 `loop.ts`：移除原有的 `PLANNING`、`OBSERVING` 状态机流转。
  - [x] 使 `loop.ts` 仅维护单一循环层并依赖模型驱动（配合控制工具或自然的停止原因 `finishReason`）。

- [x] feat: 实现控制工具集 (Control Tools)
  - [x] 编写 `finish_task` 工具：为主模型提供显式的结束执行流出口。
  - [x] 编写 `ask_user` 工具：解决大模型想向用户发问和获取确认的问题。
  - [x] 绑定这些控制工具到模型的通用工具集里。

- [x] feat: 实现子代理拆分工具 (Subagent Tool)
  - [x] 开发 `task_tool.ts`，包装一个 `spawn_agent` 工具。
  - [x] 编写子会话生成逻辑：在工具体内建立独立的 `SessionManager` 和循环堆栈。
  - [x] 将子代理返回的结果浓缩并映射回主循环的 Tool Response 中。

- [x] feat: Prompt 与工作流约束重构
  - [x] 重构 `agent.txt` 为 ReAct 统一 Prompt，包含三阶段工作流（Explore → Implement → Finish）。
  - [x] 重构 `reasoning.txt` 为子代理专用 Prompt，强调任务隔离和 `finish_task` 汇报。
  - [x] 在 Prompt 中明确所有工具的使用规则和时机（`spawn_agent`、`finish_task`、`ask_user`、`calculate`）。

---

## ✅ 重构完成总结

### 已实现的核心变更

1. **简化执行流** - 废除了 planner/reasoner 分离架构，改为单一 executor 驱动的 ReAct 循环
2. **控制工具系统** - 新增 `finish_task`、`ask_user` 让模型显式控制流程
3. **子代理机制** - `spawn_agent` 工具支持隔离子任务到独立会话
4. **统一 Prompt** - 基于阶段（Phase）的工作流指引，明确工具使用规范

### 架构优势

- 🎯 **模型驱动** - 依赖大模型的原生能力和 maxSteps，减少硬编码状态机
- 🔧 **工具化控制** - 流程控制通过工具调用实现，而非代码逻辑判断
- 🌳 **会话隔离** - 子代理在独立会话中运行，防止上下文污染
- 📝 **简洁清晰** - 代码量减少，维护成本降低，符合 Opencode 理念

### 下一步建议

- 运行 TUI 界面进行端到端测试
- 验证 `finish_task` 和 `spawn_agent` 的实际工作效果
- 根据使用反馈微调 Prompt 内容

<!-- 
下一步的选择： 由于我们在任务清单里还有最后一部分**“实现子代理拆分工具 (Subagent Tool)”** 和 “Prompt 与工作流约束重构”，您希望我是现在立刻开始开发负责开辟独立会话树的 task_tool.ts 子代理工具，还是您想自己先启动 TUI 界面实测一下目前的进展？ -->