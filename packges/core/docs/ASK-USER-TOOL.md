# ask_user 工具使用指南

## 两种实现方案

### 方案 1：Loop 检测并停止（原方案）

**流程：**
1. LLM 调用 `ask_user` 工具
2. 工具返回 `waiting_for_user` 状态
3. Loop 的 `makeDecision` 检测到 `ask_user` 并停止
4. 用户手动输入新消息，重新启动 loop

**适用场景：**
- 简单的命令行界面
- 不需要弹窗交互的场景
- 无需全局状态管理

### 方案 2：全局回调 + Promise（新方案，推荐）

**流程：**
1. LLM 调用 `ask_user` 工具
2. 工具通过全局回调触发 UI 交互（弹窗/输入框）
3. 工具的 `execute` 函数等待 Promise 完成
4. 用户输入后，Promise resolve，工具返回答案
5. LLM 在同一轮对话中收到答案并继续

**适用场景：**
- 现代 UI 界面（React、Vue 等）
- 需要弹窗、对话框等实时交互
- 希望保持对话连贯性

**详细文档：** 参见 [ASK-USER-DIRECT-UI.md](./ASK-USER-DIRECT-UI.md)

---

## 方案 1 实现细节（Loop 检测并停止）

## 问题描述

`ask_user` 工具在调用后没有与 UI 层正确联动，导致：
1. 问题显示不清晰（显示为原始 JSON）
2. 用户无法直观看到 Agent 在询问什么
3. 缺少视觉提示表明 Agent 正在等待用户回复
4. **Agent 调用 `ask_user` 后还会输出额外的文本回复**，造成重复和混乱

## 解决方案

### 1. Prompt 修改 (`packges/core/src/agent/prompt/agent.txt` 和 `reasoning.txt`)

在 Agent 的 prompt 中明确说明 `ask_user` 的使用规范：

```
## ask_user 工具使用规范

当你需要询问用户时：

1. **调用工具**：使用 `ask_user({ question: "你的问题" })`
2. **立即停止**：调用后**不要**再输出任何文本，让工具调用成为你的最后一个动作
3. **等待回复**：系统会自动暂停，用户看到问题后会回复
4. **继续对话**：用户回复后，你会在新的消息中收到答案，然后继续执行任务

❌ **错误示例**（调用 ask_user 后又输出文本）：
[调用 ask_user 工具]
我正在等待您的回复...  ← 不要这样做！

✅ **正确示例**（调用 ask_user 后直接结束）：
[调用 ask_user 工具]
[结束本轮，等待用户回复]
```

这样可以防止 Agent 在调用 `ask_user` 后继续输出文本，避免重复和混乱。

### 2. 核心层修改 (`packges/core/src/tools/control.ts`)

更新 `ask_user` 工具的返回值，包含更友好的消息：

```typescript
export const ask_user = tool({
    description: "遇到了歧义、难以决断的情况，或者需要用户提供前置信息（如密码、确认权限）时调用。调用后引擎会暂停并等待用户答复。",
    inputSchema: z.object({
        question: z.string().describe("你具体想询问用户的问题，语气要礼貌、清晰。"),
    }),
    execute: async (args) => {
        console.log(`[Tool] ask_user: ${args.question}`);
        return {
            status: "waiting_for_user",
            question: args.question,
            message: `[等待用户回复] ${args.question}`,
        };
    }
});
```

### 2. UI Hook 修改 (`packges/ui/src/hooks/useAgentLoop.ts`)

在 `onResult` 回调中特殊处理 `ask_user` 工具，提取问题文本而不是显示原始 JSON：

```typescript
onResult: (_id: string, name: string, result: unknown) => {
    setState(s => {
        const msgs = [...s.messages];
        const idx = msgs.findLastIndex(
            m => m.role === "tool" && m.toolCallId === _id
        );
        if (idx !== -1) {
            const resultObj = result as any;
            // 特殊处理 ask_user 工具：显示问题而不是原始 JSON
            const displayContent = name === "ask_user" && resultObj?.question
                ? `❓ ${resultObj.question}`
                : JSON.stringify(result);
            msgs[idx] = { 
                ...msgs[idx]!, 
                toolResult: result, 
                content: displayContent 
            };
        }
        return { ...s, messages: msgs };
    });
},
```

### 3. UI 组件修改 (`packges/ui/src/components/ToolCallLog.tsx`)

为 `ask_user` 工具添加特殊的视觉呈现：

```typescript
// 特殊处理 ask_user 工具
if (toolName === "ask_user" && !isPending) {
    const resultObj = toolResult as any;
    const question = resultObj?.question || (toolArgs as any)?.question || "";
    return (
        <Box paddingLeft={0} marginY={1}>
            <Icon name="tool_done" color="magentaBright" />
            <Text color="magentaBright"> ask_user</Text>
            <Text color="gray"> </Text>
            <Icon name="arrow_right" color="gray" />
            <Text color="gray"> </Text>
            <Text color="yellowBright">{question}</Text>
        </Box>
    );
}
```

## 工作流程

1. **Agent 调用 ask_user**
   - Agent 遇到需要用户输入的情况
   - 调用 `ask_user({ question: "您想让我总结哪次会话呢？" })`
   - **关键**：Agent 不应该在调用后再输出文本（通过 prompt 约束）

2. **Loop 检测并停止**
   - `makeDecision` 函数检测到 `ask_user` 工具调用
   - 返回 `"stop"` 决策，暂停循环
   - 状态变为 `COMPLETED`

3. **UI 展示问题**
   - ToolCallLog 组件以醒目的颜色展示问题
   - 用户可以清楚看到 Agent 在询问什么
   - **不会有额外的文本回复**，避免重复

4. **用户回复**
   - 用户在输入框中输入回答
   - 提交后，新的用户消息被添加到 session
   - Loop 重新启动，继续执行

## 为什么会出现重复输出？

在修复前，Agent 的行为是：
```
1. 调用 ask_user 工具
2. 收到工具返回结果
3. 继续输出文本："我正在等待您的回复..."
```

这是因为 AI SDK 的 `maxSteps` 机制允许在一次调用中完成多个步骤：
- Step 1: 输出工具调用
- Step 2: 执行工具并返回结果
- Step 3: 基于工具结果输出文本回复

修复方法是在 prompt 中明确告诉 Agent：**调用 `ask_user` 后不要再输出任何内容**。

## 视觉效果

修复后的显示效果：

```
◇ ask_user → 您想让我总结哪次会话呢？目前我们刚开始交流，还没有进行过完整的对话。
```

- 使用 magenta 颜色突出显示 `ask_user` 工具名
- 使用 yellow 颜色显示问题内容
- 增加 marginY 使其更醒目

## Loop 决策逻辑

在 `packges/core/src/session/loop.ts` 的 `makeDecision` 函数中：

```typescript
// P1.5: 特定控制工具的强制流转
if (lastMessage && lastMessage.role === "assistant" && hasToolCallContent(lastMessage)) {
    const content = lastMessage.content;
    if (Array.isArray(content)) {
        if (content.some((b: any) => b.type === "tool-call" && b.toolName === "ask_user")) {
            decisionLogger.log(`检测到 ask_user 工具调用 → stop`);
            return "stop";
        }
    }
}
```

这确保了当 Agent 调用 `ask_user` 时，循环会立即停止并等待用户输入。

## 使用示例

Agent 可以在以下场景使用 `ask_user`：

1. **需求不明确**
   ```typescript
   ask_user({ question: "您希望我生成哪种类型的报告？PDF 还是 Excel？" })
   ```

2. **需要确认**
   ```typescript
   ask_user({ question: "我将删除 10 个文件，是否继续？" })
   ```

3. **需要额外信息**
   ```typescript
   ask_user({ question: "请提供 API 密钥以继续操作" })
   ```

## 注意事项

1. `ask_user` 会立即停止 Agent 循环，用户必须回复才能继续
2. 问题应该清晰、具体，避免模糊的询问
3. UI 层会自动处理问题的展示，无需额外配置
4. 用户的回复会作为新的用户消息添加到 session 中
