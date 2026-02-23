# Bugfix Requirements Document

## Introduction

当 Agent 调用 `ask_user` 工具请求用户输入时，系统应该立即停止循环并等待用户响应。然而，当遇到 429 速率限制错误时，系统会继续重试并重复调用 `ask_user` 工具，最终导致失败。这个 bug 影响了用户交互流程，导致重复的问题提示和系统崩溃。

## Bug Analysis

### Current Behavior (Defect)

1.1 WHEN Agent 调用 `ask_user` 工具后遇到 429 速率限制错误 THEN 系统继续重试循环而不是停止等待用户输入

1.2 WHEN 系统在 429 错误后重试 THEN `ask_user` 工具被重复调用多次（观察到调用了 3 次相同的问题）

1.3 WHEN `finishReason` 为 `"other"`（未知）且 `lastMessage.role` 为 `"tool"` THEN `makeDecision` 函数的 P2 fallback 逻辑返回 `continue`，导致循环继续

1.4 WHEN `makeDecision` 函数在 P1.5 阶段检查 `ask_user` 工具调用 THEN 只检查 `lastMessage.role === "assistant"` 的情况，忽略了其他消息中的 `ask_user` 调用

1.5 WHEN 重复调用 `ask_user` 后 THEN 系统最终因为 `NoOutputGeneratedError` 失败

### Expected Behavior (Correct)

2.1 WHEN Agent 调用 `ask_user` 工具 THEN 系统 SHALL 立即停止循环并等待用户输入，无论 `finishReason` 是什么值

2.2 WHEN 检测到 `ask_user` 工具调用 THEN `makeDecision` 函数 SHALL 在所有消息中查找 `ask_user` 工具调用，而不仅仅检查 `lastMessage`

2.3 WHEN 遇到 429 速率限制错误且已经存在 `ask_user` 工具调用 THEN 系统 SHALL 停止重试并保持等待用户输入状态

2.4 WHEN `ask_user` 工具被调用 THEN UI SHALL 使用醒目的样式（如 magenta + yellow）提示用户需要输入

2.5 WHEN 系统检测到 `ask_user` 工具调用 THEN 系统 SHALL 返回 `"waitingForUser"` 决策，即使在错误重试场景中

### Unchanged Behavior (Regression Prevention)

3.1 WHEN Agent 调用其他工具（非 `ask_user`）后遇到 429 错误 THEN 系统 SHALL CONTINUE TO 执行正常的重试逻辑

3.2 WHEN `finishReason` 为 `"stop"` 或 `"tool_calls"` 且没有 `ask_user` 调用 THEN `makeDecision` 函数 SHALL CONTINUE TO 按照现有逻辑处理

3.3 WHEN 用户提供输入后 THEN 系统 SHALL CONTINUE TO 恢复正常的 Agent 循环执行

3.4 WHEN UI 显示其他工具调用结果 THEN UI SHALL CONTINUE TO 使用现有的样式和格式

3.5 WHEN 没有 `ask_user` 工具调用时 THEN 错误处理和重试机制 SHALL CONTINUE TO 按照现有逻辑工作
