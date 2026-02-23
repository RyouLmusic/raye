# Rate Limit Retry Fix Bugfix Design

## Overview

当 Agent 调用 `ask_user` 工具请求用户输入后遇到 429 速率限制错误时，系统错误地继续重试循环，导致 `ask_user` 工具被重复调用多次，最终因 `NoOutputGeneratedError` 失败。

根本原因是 `makeDecision` 函数在 P1.5 阶段检查 `ask_user` 工具调用时，只检查 `lastMessage.role === "assistant"` 的情况。当遇到 429 错误时，`finishReason` 变成 `"other"`（未知），导致降级到 P2 fallback 逻辑。P2 看到 `lastMessage.role="tool"` 就返回 `continue`，从而触发无限重试。

修复策略：将 `ask_user` 检查提前到 P0.5（在 P1 之前），并遍历所有消息而不仅仅是 `lastMessage`，确保无论 `finishReason` 是什么值，只要检测到 `ask_user` 工具调用就立即返回 `"stop"`。

## Glossary

- **Bug_Condition (C)**: 当 Agent 调用 `ask_user` 工具后遇到 429 速率限制错误时触发
- **Property (P)**: 系统应立即停止循环并等待用户输入，而不是继续重试
- **Preservation**: 其他工具（非 `ask_user`）的错误重试逻辑必须保持不变
- **makeDecision**: `packges/core/src/session/loop.ts` 中的决策函数，判断 ReAct 循环是否应该继续
- **finishReason**: LLM SDK 返回的结束原因（`"stop"`, `"tool-calls"`, `"other"` 等）
- **P0/P1/P2 优先级**: `makeDecision` 函数的决策优先级层次（P0 最高）

## Bug Details

### Fault Condition

当 Agent 调用 `ask_user` 工具后遇到 429 速率限制错误时，`makeDecision` 函数无法正确识别应该停止等待用户输入。函数在 P1.5 阶段只检查 `lastMessage.role === "assistant"` 的情况，当 `finishReason` 为 `"other"` 时降级到 P2 fallback，看到 `lastMessage.role="tool"` 就返回 `continue`。

**Formal Specification:**
```
FUNCTION isBugCondition(input)
  INPUT: input of type { messages: Message[], finishReason: string }
  OUTPUT: boolean
  
  RETURN existsAskUserToolCall(input.messages)
         AND input.finishReason IN ['other', 'error', undefined]
         AND lastMessage(input.messages).role === 'tool'
         AND makeDecision_current(input) === 'continue'
END FUNCTION
```

### Examples

- **场景 1**: Agent 调用 `ask_user("请提供更多信息")` → 遇到 429 错误 → `finishReason="other"` → P2 fallback 看到 `role="tool"` → 返回 `continue` → 重试循环 → 再次调用 `ask_user("请提供更多信息")` → 重复 3 次 → 最终失败
  - **期望**: 第一次调用 `ask_user` 后立即停止，等待用户输入

- **场景 2**: Agent 调用 `ask_user("选择操作")` → 成功但 `finishReason="other"` → P1.5 检查 `lastMessage.role="assistant"` 通过 → 返回 `stop` → 正常等待用户
  - **期望**: 保持此行为

- **场景 3**: Agent 调用 `read_file` → 遇到 429 错误 → 正常重试逻辑 → 最终成功或失败
  - **期望**: 保持此行为（不受影响）

- **边缘情况**: 多个 `ask_user` 调用在消息历史中 → 应检测到任意一个 → 返回 `stop`

## Expected Behavior

### Preservation Requirements

**Unchanged Behaviors:**
- 其他工具（非 `ask_user`）遇到 429 错误时的重试逻辑必须保持不变
- `finishReason` 为 `"stop"` 或 `"tool-calls"` 时的正常决策流程必须保持不变
- 用户提供输入后恢复 Agent 循环的机制必须保持不变
- UI 显示其他工具调用结果的样式和格式必须保持不变
- `finish_task` 工具的检测和处理逻辑必须保持不变

**Scope:**
所有不涉及 `ask_user` 工具调用的场景应完全不受影响。这包括：
- 其他工具的错误处理和重试
- 正常的 `finishReason` 决策路径（P1 优先级）
- 上下文压缩逻辑（P0 优先级）
- 消息结构分析的 fallback 逻辑（P2 优先级）

## Hypothesized Root Cause

基于 bug 描述和代码分析，最可能的问题是：

1. **检查时机过晚**: P1.5 阶段在 P1 `finishReason` 检查之后，当 `finishReason="other"` 时会跳过 P1.5 直接降级到 P2
   - P1 无法识别 `finishReason="other"` 的情况
   - P1.5 只在 `finishReason` 已知时才会执行

2. **检查范围过窄**: P1.5 只检查 `lastMessage.role === "assistant"` 的情况
   - 当 429 错误发生时，`lastMessage` 可能是 `role="tool"` 的错误消息
   - 无法检测到之前消息中的 `ask_user` 工具调用

3. **P2 Fallback 逻辑缺陷**: P2 看到 `role="tool"` 就无条件返回 `continue`
   - 没有检查是否存在 `ask_user` 工具调用
   - 导致即使有 `ask_user` 也会继续重试

4. **优先级设计问题**: `ask_user` 是控制流工具，应该具有最高优先级（仅次于上下文压缩）
   - 当前设计将其放在 P1.5，优先级低于 `finishReason` 检查
   - 应该提前到 P0.5，确保在任何情况下都能被检测到

## Correctness Properties

Property 1: Fault Condition - Ask User Tool Detection

_For any_ execution context where an `ask_user` tool call exists in the message history, the fixed `makeDecision` function SHALL return `"stop"` to wait for user input, regardless of the `finishReason` value or the role of the last message.

**Validates: Requirements 2.1, 2.2, 2.3, 2.5**

Property 2: Preservation - Non-Ask-User Tool Behavior

_For any_ execution context where NO `ask_user` tool call exists in the message history, the fixed `makeDecision` function SHALL produce exactly the same decision as the original function, preserving all existing retry logic, finish reason handling, and message structure analysis.

**Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5**

## Fix Implementation

### Changes Required

假设我们的根本原因分析正确：

**File**: `packges/core/src/session/loop.ts`

**Function**: `makeDecision`

**Specific Changes**:
1. **添加 P0.5 优先级检查**: 在 P0（上下文压缩）之后、P1（finishReason）之前添加新的检查层
   - 优先级：P0 上下文压缩 > P0.5 控制流工具 > P1 finishReason > P2 消息结构
   - 确保 `ask_user` 检测不受 `finishReason` 影响

2. **遍历所有消息**: 不仅检查 `lastMessage`，而是遍历整个消息历史
   - 检查所有 `role="assistant"` 的消息
   - 查找任何包含 `ask_user` 工具调用的消息

3. **提取辅助函数**: 创建 `hasAskUserToolCall(messages)` 辅助函数
   - 遍历所有消息，检查是否存在 `ask_user` 工具调用
   - 返回 boolean 值

4. **更新决策逻辑**: 在 P0.5 阶段添加检查
   ```typescript
   // ── P0.5: 控制流工具检查（优先级高于 finishReason）──
   if (hasAskUserToolCall(context.session.messages)) {
       decisionLogger.log(`检测到 ask_user 工具调用 → stop (等待用户介入)`);
       return "stop";
   }
   ```

5. **移除 P1.5 的 ask_user 检查**: 删除原有的 P1.5 阶段中的 `ask_user` 检查逻辑
   - 保留 `finish_task` 检查（或一并移到 P0.5）
   - 避免重复检查和逻辑混乱

## Testing Strategy

### Validation Approach

测试策略遵循两阶段方法：首先在未修复的代码上运行探索性测试以表面反例，确认根本原因；然后验证修复后的代码正确处理 bug 条件并保持现有行为不变。

### Exploratory Fault Condition Checking

**Goal**: 在实施修复之前，在未修复的代码上表面反例，确认或反驳根本原因分析。如果反驳，需要重新假设。

**Test Plan**: 编写测试模拟 `ask_user` 工具调用后遇到 429 错误的场景，在未修复的代码上运行以观察失败并理解根本原因。

**Test Cases**:
1. **Ask User + 429 Error Test**: 模拟 `ask_user` 调用后遇到 429 错误，验证 `makeDecision` 返回 `continue`（未修复代码上会失败）
2. **Ask User + Other FinishReason Test**: 模拟 `ask_user` 调用但 `finishReason="other"`，验证是否正确停止（未修复代码上可能失败）
3. **Multiple Ask User Calls Test**: 模拟消息历史中有多个 `ask_user` 调用，验证是否能检测到（未修复代码上会失败）
4. **Ask User in Middle of History Test**: 模拟 `ask_user` 调用不在最后一条消息，验证是否能检测到（未修复代码上会失败）

**Expected Counterexamples**:
- `makeDecision` 在存在 `ask_user` 工具调用时返回 `continue` 而不是 `stop`
- 可能原因：P1.5 检查被跳过、只检查 `lastMessage`、P2 fallback 逻辑缺陷

### Fix Checking

**Goal**: 验证对于所有满足 bug 条件的输入，修复后的函数产生期望的行为。

**Pseudocode:**
```
FOR ALL input WHERE isBugCondition(input) DO
  result := makeDecision_fixed(input)
  ASSERT result === "stop"
END FOR
```

### Preservation Checking

**Goal**: 验证对于所有不满足 bug 条件的输入，修复后的函数产生与原函数相同的结果。

**Pseudocode:**
```
FOR ALL input WHERE NOT isBugCondition(input) DO
  ASSERT makeDecision_original(input) = makeDecision_fixed(input)
END FOR
```

**Testing Approach**: 推荐使用基于属性的测试进行保持性检查，因为：
- 它自动生成大量测试用例覆盖输入域
- 它能捕获手动单元测试可能遗漏的边缘情况
- 它提供强有力的保证，确保所有非 bug 输入的行为保持不变

**Test Plan**: 首先在未修复的代码上观察非 `ask_user` 场景的行为，然后编写基于属性的测试捕获该行为。

**Test Cases**:
1. **Other Tools Retry Preservation**: 观察 `read_file` 等其他工具遇到 429 错误时的重试行为，验证修复后保持不变
2. **Normal FinishReason Preservation**: 观察 `finishReason="stop"` 和 `"tool-calls"` 的决策逻辑，验证修复后保持不变
3. **Finish Task Preservation**: 观察 `finish_task` 工具的检测和处理，验证修复后保持不变
4. **Message Structure Fallback Preservation**: 观察 P2 fallback 逻辑对非 `ask_user` 场景的处理，验证修复后保持不变

### Unit Tests

- 测试 `hasAskUserToolCall` 辅助函数能正确检测各种消息结构中的 `ask_user` 调用
- 测试 P0.5 检查在存在 `ask_user` 时返回 `stop`
- 测试 P0.5 检查在不存在 `ask_user` 时不影响后续决策
- 测试边缘情况（空消息列表、只有 user 消息、多个 `ask_user` 调用）

### Property-Based Tests

- 生成随机消息历史，包含或不包含 `ask_user` 调用，验证决策正确性
- 生成随机 `finishReason` 值，验证 `ask_user` 检测不受影响
- 生成随机工具调用组合，验证非 `ask_user` 工具的行为保持不变
- 测试大量场景以确保没有回归

### Integration Tests

- 测试完整的 Agent 循环：调用 `ask_user` → 遇到 429 错误 → 停止等待用户 → 用户输入 → 恢复循环
- 测试混合场景：多个工具调用 + `ask_user` + 错误重试
- 测试 UI 交互：验证 `ask_user` 调用后 UI 正确显示等待状态
