# Session Context Loss Bugfix Design

## Overview

在 AgentLoop 的 PLANNING 和 EXECUTING 阶段，`processResutlToSession()` 函数使用不可变模式返回新的 session 对象，但调用方忽略了返回值，继续使用旧的 session 对象。这导致 PLANNING 阶段产生的 plan/reason 消息丢失，EXECUTING 阶段无法获取这些上下文信息，破坏了 Agent 的推理链。

修复策略：在所有调用 `processResutlToSession()` 的地方，将返回值正确赋值回 `context.session`，确保 session 状态的正确传递。这是一个最小化的修复，完全尊重现有的不可变模式设计。

## Glossary

- **Bug_Condition (C)**: `processResutlToSession()` 被调用但返回值未被赋值回 `context.session` 的情况
- **Property (P)**: 调用 `processResutlToSession()` 后，返回的新 session 对象必须被赋值回 `context.session`，确保消息正确写入
- **Preservation**: 不可变模式设计、SessionOps 的行为、消息转换逻辑、状态转换流程必须保持不变
- **processResutlToSession**: 位于 `packges/core/src/session/processor/index.ts` 的函数，使用不可变模式将 ProcessorStepResult 转换为新的 Session 对象
- **context.session**: AgentLoopContext 中的 session 引用，是 PLANNING、EXECUTING、OBSERVING 等阶段共享的上下文
- **SessionOps**: 提供不可变操作的工具集（addMessage、addMessages、addTokens 等），所有操作返回新对象而非修改原对象

## Bug Details

### Fault Condition

Bug 在以下三个位置触发，当 `processResutlToSession()` 被调用但返回值未被使用时：

1. **PLANNING 阶段 - Plan 调用**（第 151 行）
2. **PLANNING 阶段 - Reason 调用**（第 158 行）
3. **EXECUTING 阶段 - Execute 调用**（第 180 行）

**Formal Specification:**
```
FUNCTION isBugCondition(codeLocation)
  INPUT: codeLocation of type CodeLocation
  OUTPUT: boolean
  
  RETURN codeLocation.function == "processResutlToSession"
         AND codeLocation.returnValue IS NOT null
         AND codeLocation.returnValue IS NOT assigned_to("context.session")
         AND codeLocation.phase IN ["PLANNING", "EXECUTING"]
END FUNCTION
```

### Examples

- **Example 1 - PLANNING/Plan**: 
  - 代码：`processResutlToSession(planResult);`（第 151 行）
  - 实际行为：plan 消息写入临时 session，但 `context.session` 仍指向旧对象
  - 预期行为：`context.session = processResutlToSession(planResult);` 确保 plan 消息被保存

- **Example 2 - PLANNING/Reason**: 
  - 代码：`processResutlToSession(reasonResult);`（第 158 行）
  - 实际行为：reason 消息写入临时 session，但 `context.session` 仍指向旧对象
  - 预期行为：`context.session = processResutlToSession(reasonResult);` 确保 reason 消息被保存

- **Example 3 - EXECUTING**: 
  - 代码：`processResutlToSession(executeResult);`（第 180 行）
  - 实际行为：execute 消息（assistant + tool results）写入临时 session，但 `context.session` 仍指向旧对象
  - 预期行为：`context.session = processResutlToSession(executeResult);` 确保 execute 消息被保存

- **Edge Case - SessionManager.save()**: 
  - 当 `sessionManager.save(context.session)` 被调用时，保存的是未更新的旧 session
  - 预期行为：保存包含所有 plan/reason/execute 消息的完整 session

## Expected Behavior

### Preservation Requirements

**Unchanged Behaviors:**
- `processResutlToSession()` 必须继续使用不可变模式，返回新的 session 对象而非修改原对象
- SessionOps 的所有操作（addMessage、addMessages、addTokens 等）必须继续返回新对象
- 消息转换逻辑（assistant message + tool-call 块、tool-result 消息）必须保持不变
- 状态转换流程（PLANNING → EXECUTING → OBSERVING）必须保持不变
- SessionContext.run() 和 SessionContext.current() 的行为必须保持不变

**Scope:**
所有不涉及 `processResutlToSession()` 返回值赋值的代码应完全不受影响。这包括：
- SessionOps 的内部实现
- Processor.plan/reason/execute 的实现
- makeDecision 的决策逻辑
- shouldCompact 的压缩判断
- SessionManager 的保存/加载逻辑

## Hypothesized Root Cause

基于代码分析，最可能的原因是：

1. **不可变模式理解偏差**: 开发者可能误以为 `processResutlToSession()` 会修改传入的 session（通过 SessionContext.current()），但实际上它返回一个全新的 session 对象

2. **SessionContext 误用**: `processResutlToSession()` 内部调用 `SessionContext.current()` 获取当前 session，然后通过 SessionOps 创建新 session 并返回，但这个新 session 并未自动更新到 SessionContext 中

3. **代码演化遗留**: 可能在早期版本中 `processResutlToSession()` 是 void 函数（直接修改 session），后来重构为不可变模式但调用方未同步更新

4. **EXECUTING 阶段的一致性问题**: EXECUTING 阶段也存在同样的问题，说明这是一个系统性的模式错误，而非单点疏忽

## Correctness Properties

Property 1: Fault Condition - Session Update After processResutlToSession

_For any_ call to `processResutlToSession(result)` in PLANNING or EXECUTING phases, the fixed code SHALL assign the returned session object back to `context.session`, ensuring that all messages (plan, reason, assistant, tool-result) are correctly written to the shared context.

**Validates: Requirements 2.1, 2.2, 2.3, 2.4**

Property 2: Preservation - Immutable Pattern Integrity

_For any_ SessionOps operation (addMessage, addMessages, addTokens, compressMessages, incrementIterations), the fixed code SHALL continue to use the immutable pattern where operations return new session objects without modifying the original, preserving the functional programming design.

**Validates: Requirements 3.2, 3.3, 3.4, 3.5**

## Fix Implementation

### Changes Required

修复非常简单直接，只需在三个位置将返回值赋值回 `context.session`：

**File**: `packges/core/src/session/loop.ts`

**Function**: `executeLoop`

**Specific Changes**:

1. **PLANNING 阶段 - Plan 调用**（第 151 行）:
   - 当前代码：`processResutlToSession(planResult);`
   - 修复后：`context.session = processResutlToSession(planResult);`
   - 原因：确保 plan 消息被写入 `context.session`

2. **PLANNING 阶段 - Reason 调用**（第 158 行）:
   - 当前代码：`processResutlToSession(reasonResult);`
   - 修复后：`context.session = processResutlToSession(reasonResult);`
   - 原因：确保 reason 消息被写入 `context.session`

3. **EXECUTING 阶段 - Execute 调用**（第 180 行）:
   - 当前代码：`processResutlToSession(executeResult);`
   - 修复后：`context.session = processResutlToSession(executeResult);`
   - 原因：确保 execute 消息（assistant + tool results）被写入 `context.session`

4. **无需修改 processResutlToSession 函数本身**:
   - 该函数的不可变模式设计是正确的
   - 问题在于调用方未正确使用返回值

5. **无需修改 SessionOps**:
   - SessionOps 的所有操作已正确实现不可变模式
   - 无需任何改动

## Testing Strategy

### Validation Approach

测试策略分为两个阶段：首先在未修复的代码上运行探索性测试，观察 bug 的具体表现（counterexamples）；然后在修复后的代码上验证修复有效性和行为保持不变。

### Exploratory Fault Condition Checking

**Goal**: 在未修复的代码上运行测试，观察 session context 丢失的具体表现，确认根本原因分析是否正确。

**Test Plan**: 编写集成测试模拟完整的 AgentLoop 执行流程，在 PLANNING 和 EXECUTING 阶段后检查 `context.session.messages`，验证消息是否丢失。在未修复的代码上运行，预期会失败。

**Test Cases**:
1. **Plan Message Loss Test**: 执行 PLANNING 阶段的 plan 调用后，检查 `context.session.messages` 是否包含 plan 消息（未修复代码上会失败）
2. **Reason Message Loss Test**: 执行 PLANNING 阶段的 reason 调用后，检查 `context.session.messages` 是否包含 reason 消息（未修复代码上会失败）
3. **Execute Message Loss Test**: 执行 EXECUTING 阶段后，检查 `context.session.messages` 是否包含 assistant 和 tool-result 消息（未修复代码上会失败）
4. **SessionManager Save Test**: 在 PLANNING 阶段后调用 `sessionManager.save()`，然后重新加载 session，检查 plan/reason 消息是否持久化（未修复代码上会失败）

**Expected Counterexamples**:
- PLANNING 阶段后，`context.session.messages` 不包含 plan/reason 消息
- EXECUTING 阶段开始时，LLM 看不到 PLANNING 阶段的上下文
- SessionManager 保存的 session 缺少 PLANNING 阶段的消息
- 可能的根本原因：`processResutlToSession()` 返回值未被赋值回 `context.session`

### Fix Checking

**Goal**: 验证修复后，所有调用 `processResutlToSession()` 的地方都正确更新了 `context.session`。

**Pseudocode:**
```
FOR ALL phase IN ["PLANNING_plan", "PLANNING_reason", "EXECUTING"] DO
  context := createTestContext()
  result := executePhase(phase, context)
  
  // 验证 session 被正确更新
  ASSERT context.session.messages contains expected_messages_for(phase)
  
  // 验证 SessionManager 保存的是更新后的 session
  savedSession := sessionManager.load(context.session.id)
  ASSERT savedSession.messages == context.session.messages
END FOR
```

### Preservation Checking

**Goal**: 验证修复后，所有不涉及 `processResutlToSession()` 返回值赋值的行为保持不变。

**Pseudocode:**
```
FOR ALL operation IN SessionOps DO
  oldSession := createTestSession()
  newSession := operation(oldSession, testData)
  
  // 验证不可变性：原对象未被修改
  ASSERT oldSession IS NOT modified
  ASSERT newSession IS new_object
  ASSERT newSession != oldSession
END FOR
```

**Testing Approach**: 使用 property-based testing 验证不可变模式的完整性，因为：
- 自动生成大量测试用例覆盖各种 session 状态
- 捕获可能破坏不可变性的边缘情况
- 提供强保证：所有 SessionOps 操作都不修改原对象

**Test Plan**: 在未修复的代码上观察 SessionOps 的行为（应该已经是不可变的），然后编写 property-based tests 确保修复后这些行为保持不变。

**Test Cases**:
1. **SessionOps Immutability**: 验证所有 SessionOps 操作（addMessage、addMessages、addTokens 等）返回新对象且不修改原对象
2. **Message Transformation**: 验证 assistant message + tool-call 块、tool-result 消息的转换逻辑保持不变
3. **State Transition**: 验证状态转换流程（PLANNING → EXECUTING → OBSERVING）保持不变
4. **SessionContext Behavior**: 验证 SessionContext.run() 和 SessionContext.current() 的行为保持不变

### Unit Tests

- 测试 `processResutlToSession()` 返回新 session 对象且不修改原对象
- 测试 PLANNING 阶段的 plan/reason 消息正确写入 `context.session`
- 测试 EXECUTING 阶段的 assistant/tool-result 消息正确写入 `context.session`
- 测试 SessionManager.save() 保存的是更新后的 session

### Property-Based Tests

- 生成随机的 ProcessorStepResult，验证 `processResutlToSession()` 总是返回新对象
- 生成随机的 session 状态，验证所有 SessionOps 操作保持不可变性
- 生成随机的 AgentLoop 执行序列，验证 session 状态正确传递

### Integration Tests

- 测试完整的 AgentLoop 流程，验证 PLANNING → EXECUTING → OBSERVING 的消息传递
- 测试多轮迭代，验证每轮的 plan/reason/execute 消息都正确累积
- 测试 session 持久化，验证 SessionManager 保存和加载的 session 包含所有消息
