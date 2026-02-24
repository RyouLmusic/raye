# finish_task 工具重复调用问题修复

## 问题描述

在使用 Agent 时，`finish_task` 工具会被重复调用，导致无限循环。从日志中可以看到：

```
[Tool] finish_task: 已为用户提供人参果的多种美味吃法
◇ finish_task (args: {"summary":"已为用户提供人参果的多种美味吃法，包括生吃、炒菜、凉拌、煮粥、炖牛奶、煲汤、做果汁和果酱等多种做法。"})
+ [Reasoning] 任务已经完成，我已经提供了人参果的多种吃法。现在让我给用户一个详细的回答。
[Tool] finish_task: 已为用户提供人参果的多种美味吃法
◇ finish_task (args: {"summary":"已为用户提供人参果的多种美味吃法"})
+ [Reasoning] 看起来任务已经完成了。让我给用户一个详细的回答。
[Tool] finish_task: 已为用户提供人参果的多种美味吃法
...（重复多次）
```

## 根本原因

这个问题实际上有**两个层面**：

### 1. 内层循环问题（SDK 层面）

从日志可以看到：
```
"finishReason": "tool-calls",
"toolCallsCount": 10,  // 一次 EXECUTING 阶段就执行了10次 finish_task！
```

**问题**：LLM 在单次 `streamText` 调用中重复调用 `finish_task`

**原因**：
- `maxSteps` 被注释掉，SDK 会无限制地执行工具调用
- LLM 调用 `finish_task` → SDK 执行并返回结果 → LLM 看到结果但没理解应该停止 → 再次调用 `finish_task` → 重复...
- 直到达到某个隐式限制或超时

### 2. 外层循环问题（决策逻辑层面）

### 2. 外层循环问题（决策逻辑层面）

在 `loop.ts` 的 `makeDecision` 函数中，原有的 P1.5 优先级检查只检查了 `lastMessage`（最后一条消息）：

```typescript
// 原有代码（有问题）
if (lastMessage && lastMessage.role === "assistant" && hasToolCallContent(lastMessage)) {
    const content = lastMessage.content;
    if (Array.isArray(content)) {
        if (content.some((b: any) => b.type === "tool-call" && b.toolName === "finish_task")) {
            return "stop";
        }
    }
}
```

**消息历史结构导致检查失效**：

实际的消息流程是：

1. Assistant 消息（包含 `finish_task` 工具调用）
2. Tool 消息（`finish_task` 的执行结果）← `lastMessage` 指向这里
3. 决策函数检查 `lastMessage`，发现是 `role="tool"`，不是 `role="assistant"`
4. P1.5 检查失效，继续循环
5. LLM 看到之前的 `finish_task` 调用和结果，但任务还在继续
6. LLM 困惑，再次调用 `finish_task`
7. 形成死循环

**优先级问题**：

`finish_task` 是控制流工具，应该与 `ask_user` 享有同样的优先级（P0.5），但原来的实现将其放在 P1.5，低于 `finishReason` 检查。

## 解决方案

采用**双层防护**策略：

### 方案 A：内层循环防护（executor.ts）

在 SDK 的 `streamText` 调用中添加 `onStepFinish` 回调，检测到 `finish_task` 后立即中止：

```typescript
// 创建 AbortController 用于提前终止
const abortController = new AbortController();
const combinedSignal = input.abortSignal 
    ? AbortSignal.any([input.abortSignal, abortController.signal])
    : abortController.signal;

streamResult = await streamTextWrapper({
    // ... 其他参数
    maxSteps: 10,  // 设置最大步数，防止无限循环
    abortSignal: combinedSignal,
    // 在每个步骤完成后检查是否有 finish_task 调用
    onStepFinish: async (step) => {
        // 检查当前步骤的工具调用中是否包含 finish_task
        const hasFinishTask = step.toolCalls?.some(
            (tc: any) => tc.toolName === "finish_task"
        );
        
        if (hasFinishTask) {
            logger.log(`🛑 检测到 finish_task 调用，提前终止内层循环`);
            // 中止后续的工具调用循环
            abortController.abort();
        }
    },
});
```

**关键点**：
1. 设置 `maxSteps: 10` 作为兜底保护
2. 使用 `onStepFinish` 回调在每个步骤后检查
3. 检测到 `finish_task` 后立即调用 `abortController.abort()` 终止
4. 使用 `AbortSignal.any()` 合并外部和内部的中止信号

### 方案 B：外层循环防护（loop.ts）

#### 1. 新增 `hasFinishTaskToolCall` 函数

类似于 `hasAskUserToolCall`，遍历所有消息历史而不是只检查最后一条：

类似于 `hasAskUserToolCall`，遍历所有消息历史而不是只检查最后一条：

```typescript
/**
 * 检查消息历史中是否存在 finish_task 工具调用
 *
 * 遍历所有消息，查找任何 role="assistant" 的消息中是否包含 finish_task 工具调用。
 * 用于 P0.5 优先级检查，确保无论 finishReason 是什么值，只要检测到 finish_task 就立即停止。
 */
function hasFinishTaskToolCall(messages: readonly any[]): boolean {
    for (const message of messages) {
        // 只检查 assistant 消息
        if (message?.role !== "assistant") continue;

        const content = message.content;
        // 检查 content 是否为数组（包含 tool-call 块）
        if (!Array.isArray(content)) continue;

        // 查找是否有 finish_task 工具调用
        const hasFinishTask = content.some((block: any) =>
            block?.type === "tool-call" && block?.toolName === "finish_task"
        );

        if (hasFinishTask) {
            return true;
        }
    }

    return false;
}
```

### 2. 提升 `finish_task` 检查到 P0.5 优先级

将 `finish_task` 检查移到 P0.5，与 `ask_user` 同级，高于 `finishReason` 检查：

```typescript
// ── P0.5: 控制流工具检查（优先级高于 finishReason）──────────
if (hasAskUserToolCall(context.session.messages)) {
    decisionLogger.log(`检测到 ask_user 工具调用 → stop (等待用户介入)`);
    return "stop";
}

if (hasFinishTaskToolCall(context.session.messages)) {
    decisionLogger.log(`检测到 finish_task 工具调用 → stop (任务完成)`);
    return "stop";
}
```

#### 3. 移除原有的 P1.5 检查

删除了原来只检查 `lastMessage` 的 P1.5 代码块。

## 修复效果

### 修复前

```
[Tool] finish_task: 已为用户提供人参果的多种美味吃法
[Tool] finish_task: 已为用户提供人参果的多种美味吃法
[Tool] finish_task: 已为用户提供人参果的多种美味吃法
...（无限循环）
```

### 修复后

```
[Tool] finish_task: 已为用户提供人参果的多种美味吃法
🛑 检测到 finish_task 调用，提前终止内层循环
✓ 检测到 finish_task 工具调用 → stop (任务完成)
🎉 循环完成
```

## 双层防护机制

```
┌─────────────────────────────────────────────────────────┐
│ 内层循环（SDK streamText）                               │
│                                                         │
│  LLM → tool → LLM → tool → ...                         │
│         ↓                                               │
│    onStepFinish 检测 finish_task                        │
│         ↓                                               │
│    abortController.abort() ← 第一道防线                 │
│         ↓                                               │
│    finishReason: "tool-calls" 或 "stop"                │
└─────────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────────┐
│ 外层循环（AgentLoop makeDecision）                       │
│                                                         │
│  P0.5: hasFinishTaskToolCall() ← 第二道防线             │
│         ↓                                               │
│    检测到 finish_task → stop                            │
│         ↓                                               │
│    循环终止                                             │
└─────────────────────────────────────────────────────────┘
```

**为什么需要双层防护？**

1. **内层防护**：防止 LLM 在单次调用中重复调用 `finish_task`，节省 token 和时间
2. **外层防护**：即使内层防护失效（如 abort 不生效），外层也能正确识别并停止
3. **容错性**：两层防护互为备份，提高系统可靠性

## 决策优先级（修复后）

```
P0: 上下文压缩检查
    ↓
P0.5: 控制流工具检查（ask_user, finish_task）← 新增 finish_task
    ↓
P1: finishReason 检查（stop, tool-calls, length, etc.）
    ↓
P2: 消息结构分析（role="tool", role="assistant"）
    ↓
P3: 默认策略（continue）
```

## 测试验证

创建了 `finish-task-fix.test.ts` 测试文件，验证：

1. ✅ 能识别消息历史中的 `finish_task` 调用（即使最后一条消息是 tool-result）
2. ✅ 在没有 `finish_task` 时返回 false
3. ✅ 能识别多个工具调用中的 `finish_task`

所有测试通过。

## 相关文件

- `packges/core/src/session/loop.ts` - 外层循环决策逻辑修复
- `packges/core/src/session/processor/executor.ts` - 内层循环防护修复
- `packges/core/test/finish-task-fix.test.ts` - 测试文件
- `packges/core/docs/FINISH-TASK-FIX.md` - 本文档

## 设计原则

1. **控制流工具应享有最高优先级**：`ask_user` 和 `finish_task` 都是控制流工具，应该在 P0.5 优先级检查，高于 `finishReason`
2. **遍历消息历史而非只检查最后一条**：工具执行后会产生额外的消息，只检查最后一条会导致检查失效
3. **保持一致性**：`finish_task` 的检查逻辑与 `ask_user` 保持一致，便于维护和理解
4. **双层防护**：内层防护（SDK 层）+ 外层防护（决策层），提高系统可靠性
5. **及时中止**：检测到控制流工具后立即中止，避免浪费资源

## 技术细节

### AbortSignal.any() 的使用

```typescript
const abortController = new AbortController();
const combinedSignal = input.abortSignal 
    ? AbortSignal.any([input.abortSignal, abortController.signal])
    : abortController.signal;
```

- 使用 `AbortSignal.any()` 合并多个中止信号
- 任何一个信号触发，整个请求都会被中止
- 既支持外部中止（用户取消），也支持内部中止（检测到 finish_task）

### onStepFinish 回调时机

```typescript
onStepFinish: async (step) => {
    const hasFinishTask = step.toolCalls?.some(
        (tc: any) => tc.toolName === "finish_task"
    );
    if (hasFinishTask) {
        abortController.abort();
    }
}
```

- `onStepFinish` 在每个 LLM 调用步骤完成后触发
- 此时工具已经被调用，但下一轮 LLM 调用尚未开始
- 是中止循环的最佳时机

## 未来改进建议

1. **统一控制流工具管理**：
   - 将所有控制流工具（`ask_user`, `finish_task` 等）统一注册
   - 使用配置化的方式定义控制流行为

2. **工具类型系统**：
   - 在工具注册时标记工具类型（控制流、数据查询、数据修改等）
   - 根据工具类型自动应用不同的决策逻辑

3. **更智能的中止策略**：
   - 考虑工具的返回值，而不仅仅是工具名称
   - 例如：`finish_task` 返回 `{ shouldContinue: false }` 时才中止

4. **性能优化**：
   - 缓存消息历史的工具调用检查结果
   - 避免重复遍历消息数组
