# Bugfix Requirements Document

## Introduction

在 AgentLoop 的 PLANNING 阶段，`processResutlToSession()` 函数返回的新 session 对象没有被赋值回 `context.session`，导致 PLANNING 阶段产生的 plan/reason 消息丢失，EXECUTING 阶段无法获取这些上下文信息。这个 bug 影响所有使用 AgentLoop 的场景，导致 Agent 的推理链断裂。

根本原因是 `processResutlToSession()` 使用不可变模式（通过 `SessionOps.addMessage()` 等操作返回新的 session 对象），但调用方忽略了返回值，继续使用旧的 session 对象。

## Bug Analysis

### Current Behavior (Defect)

1.1 WHEN `Processor.plan()` 在 PLANNING 阶段被调用后 THEN `processResutlToSession(planResult)` 的返回值被忽略，plan 消息未写入 `context.session`

1.2 WHEN `Processor.reason()` 在 PLANNING 阶段被调用后 THEN `processResutlToSession(reasonResult)` 的返回值被忽略，reason 消息未写入 `context.session`

1.3 WHEN EXECUTING 阶段开始执行时 THEN 无法看到 PLANNING 阶段产生的 plan/reason 消息，导致 LLM 缺少必要的上下文

1.4 WHEN `sessionManager.save(context.session)` 被调用时 THEN 保存的是未更新的旧 session 对象，PLANNING 阶段的消息永久丢失

### Expected Behavior (Correct)

2.1 WHEN `Processor.plan()` 在 PLANNING 阶段被调用后 THEN 系统 SHALL 将 `processResutlToSession(planResult)` 的返回值赋值回 `context.session`，确保 plan 消息被正确写入

2.2 WHEN `Processor.reason()` 在 PLANNING 阶段被调用后 THEN 系统 SHALL 将 `processResutlToSession(reasonResult)` 的返回值赋值回 `context.session`，确保 reason 消息被正确写入

2.3 WHEN EXECUTING 阶段开始执行时 THEN 系统 SHALL 能够访问 PLANNING 阶段产生的所有 plan/reason 消息作为上下文

2.4 WHEN `sessionManager.save(context.session)` 被调用时 THEN 系统 SHALL 保存包含 PLANNING 阶段所有消息的完整 session 对象

### Unchanged Behavior (Regression Prevention)

3.1 WHEN `Processor.execute()` 在 EXECUTING 阶段被调用后 THEN 系统 SHALL CONTINUE TO 正确处理 `processResutlToSession(executeResult)` 的返回值（注：当前代码在 EXECUTING 阶段也存在同样的问题，需要一并修复）

3.2 WHEN `processResutlToSession()` 函数被调用时 THEN 系统 SHALL CONTINUE TO 使用不可变模式返回新的 session 对象，而不是修改原对象

3.3 WHEN session 消息被添加时 THEN 系统 SHALL CONTINUE TO 正确处理 assistant 消息、tool-call 内容块和 tool-result 消息的转换逻辑

3.4 WHEN token 使用量存在时 THEN 系统 SHALL CONTINUE TO 正确更新 session 的元数据

3.5 WHEN 状态转换发生时 THEN 系统 SHALL CONTINUE TO 按照 PLANNING → EXECUTING → OBSERVING 的顺序正确流转
