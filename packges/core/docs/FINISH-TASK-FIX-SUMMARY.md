# finish_task 工具重复调用问题 - 修复总结

## 问题概述

`finish_task` 工具在执行时会被重复调用，导致：
- 浪费大量 token 和时间
- 用户体验差（看到重复的工具调用日志）
- 可能导致无限循环

## 问题分析

经过深入分析，发现问题存在于**两个层面**：

### 1. 内层循环问题（SDK streamText 层面）

**现象**：
```
"finishReason": "tool-calls",
"toolCallsCount": 10,  // 单次调用就执行了10次！
```

**原因**：
- `maxSteps` 被注释掉，SDK 无限制执行工具调用
- LLM 调用 `finish_task` → 看到结果 → 没理解应该停止 → 再次调用 → 循环...

### 2. 外层循环问题（AgentLoop 决策层面）

**现象**：
```
lastMessage.role === "tool"  // 最后一条是工具结果
P1.5 检查失效 → 继续循环
```

**原因**：
- 决策逻辑只检查 `lastMessage`
- 工具执行后会产生 tool-result 消息
- `lastMessage` 指向 tool-result，不是 assistant 消息
- 检查失效，循环继续

## 修复方案

采用**双层防护**策略：

### 修复 A：内层循环防护（executor.ts）

```typescript
// 1. 创建 AbortController
const abortController = new AbortController();
const combinedSignal = AbortSignal.any([
    input.abortSignal,
    abortController.signal
]);

// 2. 添加 onStepFinish 回调
streamResult = await streamTextWrapper({
    // ...
    maxSteps: 10,  // 兜底保护
    abortSignal: combinedSignal,
    onStepFinish: async (step) => {
        const hasFinishTask = step.toolCalls?.some(
            (tc: any) => tc.toolName === "finish_task"
        );
        if (hasFinishTask) {
            logger.log(`🛑 检测到 finish_task，提前终止`);
            abortController.abort();  // 立即中止
        }
    },
});
```

**关键点**：
- 在每个步骤完成后检查
- 检测到 `finish_task` 立即中止
- 使用 `AbortSignal.any()` 合并信号

### 修复 B：外层循环防护（loop.ts）

```typescript
// 1. 新增函数：遍历所有消息
function hasFinishTaskToolCall(messages: readonly any[]): boolean {
    for (const message of messages) {
        if (message?.role !== "assistant") continue;
        const content = message.content;
        if (!Array.isArray(content)) continue;
        
        const hasFinishTask = content.some((block: any) =>
            block?.type === "tool-call" && block?.toolName === "finish_task"
        );
        
        if (hasFinishTask) return true;
    }
    return false;
}

// 2. 提升到 P0.5 优先级
if (hasFinishTaskToolCall(context.session.messages)) {
    decisionLogger.log(`检测到 finish_task → stop`);
    return "stop";
}
```

**关键点**：
- 遍历所有消息，不只是最后一条
- 提升到 P0.5 优先级（与 ask_user 同级）
- 高于 finishReason 检查

## 修改的文件

1. **packges/core/src/session/processor/executor.ts**
   - 添加 AbortController 和 onStepFinish 回调
   - 设置 maxSteps: 10

2. **packges/core/src/session/loop.ts**
   - 新增 hasFinishTaskToolCall 函数
   - 在 P0.5 添加 finish_task 检查
   - 移除旧的 P1.5 检查

3. **packges/core/src/session/type.ts**
   - 在 StreamTextInput 类型中添加 onStepFinish 回调

4. **packges/core/src/session/stream-text-wrapper.ts**
   - 传递 onStepFinish 回调到 streamText

5. **测试文件**
   - packges/core/test/finish-task-fix.test.ts（外层循环测试）
   - packges/core/test/finish-task-inner-loop-fix.test.ts（内层循环测试）

6. **文档**
   - packges/core/docs/FINISH-TASK-FIX.md（详细文档）
   - packges/core/docs/FINISH-TASK-FIX-SUMMARY.md（本文档）

## 测试结果

所有测试通过 ✅：
- 外层循环测试：3/3 通过
- 内层循环测试：6/6 通过
- 总计：9/9 通过

## 双层防护机制

```
┌─────────────────────────────────────────┐
│ 内层循环（SDK streamText）               │
│                                         │
│  LLM → tool → LLM → tool → ...         │
│         ↓                               │
│    onStepFinish 检测 finish_task        │
│         ↓                               │
│    abort() ← 第一道防线                 │
└─────────────────────────────────────────┘
                ↓
┌─────────────────────────────────────────┐
│ 外层循环（AgentLoop）                    │
│                                         │
│  P0.5: hasFinishTaskToolCall()          │
│         ↓                               │
│    检测到 → stop ← 第二道防线            │
└─────────────────────────────────────────┘
```

**为什么需要双层？**
1. 内层防护：节省 token，提高效率
2. 外层防护：容错备份，确保可靠
3. 互为补充：任一层失效，另一层兜底

## 效果对比

### 修复前
```
[Tool] finish_task: 已完成
[Tool] finish_task: 已完成
[Tool] finish_task: 已完成
...（重复10次）
```

### 修复后
```
[Tool] finish_task: 已完成
🛑 检测到 finish_task，提前终止内层循环
✓ 检测到 finish_task → stop (任务完成)
🎉 循环完成
```

## 设计原则

1. **双层防护**：内层 + 外层，提高可靠性
2. **及时中止**：检测到立即停止，节省资源
3. **类型安全**：添加类型定义，避免运行时错误
4. **保持一致**：finish_task 与 ask_user 逻辑一致
5. **充分测试**：覆盖各种边界情况

## 后续建议

1. 监控实际运行效果，收集数据
2. 考虑将控制流工具统一管理
3. 优化工具类型系统
4. 添加更多控制流工具（如 pause_task, retry_task 等）
