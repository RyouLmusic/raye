# finish_task 工具 Prompt 重新设计

## 改进目标

重新设计 `finish_task` 工具的 prompt，使其：
1. 更清晰地向 LLM 说明何时应该调用此工具
2. 明确工具调用后的行为（立即终止，不会有响应）
3. 确保返回结果不会破坏 LLM 对话的上下文

## 核心改进

### 1. 更详细的 description

**之前**：
```typescript
description: "当任务已按照用户需求全部完成时通过时调用此工具结束。"
```

**现在**：
```typescript
description: `当你已经完全完成用户的所有需求时，调用此工具结束任务。

使用时机：
- ✅ 所有子任务都已完成
- ✅ 用户的问题已经得到完整回答
- ✅ 没有遗留的待办事项
- ✅ 不需要等待用户的进一步指示

注意事项：
- 调用此工具后，对话会立即终止，你不会再收到任何响应
- 在调用前，确保你已经给用户提供了完整的答案或完成了所有操作
- 如果任务只完成了一部分，不要调用此工具
- 如果需要用户确认或提供更多信息，使用 ask_user 工具而不是此工具`
```

**改进点**：
- 使用清晰的检查清单（✅）让 LLM 容易判断
- 明确说明调用后会立即终止，不会有响应
- 提供反例（什么情况不应该调用）
- 引导 LLM 在不确定时使用 `ask_user` 而不是 `finish_task`

### 2. 简化返回值

**之前**：
```typescript
return {
    status: "finished",
    summary: args.summary,
    message: "任务已完成，系统将终止。请等待进程退出。"
};
```

**现在**：
```typescript
return {
    status: "finished",
    summary: summary,
    message: "✓ 任务完成"  // 简短确认，避免冗长文本
};
```

**改进点**：
- 返回消息更简洁（从 19 字减少到 6 字）
- 使用符号（✓）而不是冗长的文字描述
- 添加注释说明这个返回值主要用于系统内部检测

### 3. 增强 agent.txt 中的使用指南

在 `agent.txt` 中新增了完整的 `finish_task` 使用规范章节：

- **何时调用**：提供清晰的判断标准
- **何时不调用**：列出常见的错误场景
- **正确示例**：展示两个典型的正确使用场景
- **错误示例**：展示过早调用的反例
- **重要提醒**：强调返回值不会添加到对话历史中

## 设计原则

### 1. 明确性优于简洁性

虽然 description 变长了，但换来的是 LLM 更准确的理解和使用。通过清晰的检查清单和示例，减少误用的可能性。

### 2. 上下文保护

- 返回消息极简化（"✓ 任务完成"）
- 在代码注释中明确说明返回值不会作为对话消息
- 在 agent.txt 中强调这一点

### 3. 行为预期管理

明确告诉 LLM：
- 调用后会立即终止
- 不会收到任何响应
- 需要在调用前完成所有输出

这避免了 LLM 在调用 `finish_task` 后还期待继续对话的情况。

### 4. 与 ask_user 的区分

在多处强调：
- 如果需要用户确认 → 使用 `ask_user`
- 如果任务完全完成 → 使用 `finish_task`

这帮助 LLM 在两个工具之间做出正确选择。

## 技术实现细节

### 工具定义结构

```typescript
export const finish_task = tool({
    description: `...`,  // 详细的多行说明
    inputSchema: z.object({
        summary: z.string().describe("..."),
    }),
    execute: async ({ summary }) => {
        // 简洁的实现
        return {
            status: "finished",
            summary: summary,
            message: "✓ 任务完成"
        };
    }
});
```

### 与现有机制的配合

此改进与现有的双层防护机制完美配合：

1. **内层循环**（executor.ts）：
   - `onStepFinish` 检测到 `finish_task` 调用
   - 立即 abort，停止 SDK 的 streamText

2. **外层循环**（loop.ts）：
   - `hasFinishTaskToolCall` 遍历所有消息
   - 检测到后返回 "stop"

工具的返回值（`status: "finished"`）可以作为额外的检测信号，但主要依赖工具名称检测。

## 预期效果

### 对 LLM 的影响

1. **更准确的判断**：通过清晰的检查清单，LLM 能更准确地判断是否应该调用
2. **减少误用**：明确的反例和注意事项减少过早调用的情况
3. **更好的行为**：理解调用后会立即终止，不会在调用后继续输出

### 对系统的影响

1. **上下文保护**：简短的返回消息不会污染对话历史
2. **可靠终止**：配合双层防护机制，确保任务可靠结束
3. **更好的日志**：简洁的消息让日志更清晰

## 测试建议

建议测试以下场景：

1. **正常完成**：任务完成后正确调用 `finish_task`
2. **过早调用**：任务未完成时不应调用
3. **与 ask_user 的选择**：需要确认时应该用 `ask_user` 而不是 `finish_task`
4. **上下文保持**：验证返回值不会影响后续对话（如果有的话）

## 相关文件

- `packges/core/src/tools/control.ts` - 工具定义
- `packges/core/src/agent/prompt/agent.txt` - Agent prompt
- `packges/core/docs/FINISH-TASK-FIX-SUMMARY.md` - 双层防护机制文档

## 总结

这次重新设计通过更详细的说明、清晰的示例和明确的行为预期，帮助 LLM 更好地理解和使用 `finish_task` 工具。同时，通过简化返回值，确保不会对对话上下文造成负面影响。
