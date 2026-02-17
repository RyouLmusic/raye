# Agent Loop 状态机设计

本文档描述了 Raye Agent 的双层状态机架构设计。

## 概述

Raye Agent 采用**双层状态机**架构：

1. **外层状态机 (Agent Loop)**: 实现 ReAct (Reasoning + Acting) 模式
2. **内层状态机 (Process Loop)**: 处理 LLM 调用、错误重试、流式输出等

---

## 外层状态机：Agent ReAct Loop

### 状态定义

```typescript
type AgentLoopState = 
  | "INIT"         // 初始化
  | "PLANNING"     // 规划（Reasoning）
  | "EXECUTING"    // 执行（Acting）
  | "OBSERVING"    // 观察结果
  | "COMPACTING"   // 压缩上下文
  | "COMPLETED"    // 完成
  | "FAILED"       // 失败
```

### 状态转换图

```
┌─────────────────────────────────────────────────────────────┐
│                     Agent ReAct Loop                         │
└─────────────────────────────────────────────────────────────┘

        [START]
           ↓
      ┌────────┐
      │  INIT  │  初始化 session、加载配置
      └────┬───┘
           ↓
    ┌──────────┐
    │ PLANNING │  检查迭代次数、决定是否压缩、规划下一步
    └─────┬────┘
          ↓
    ┌───────────┐
    │ EXECUTING │  调用 LLM（进入内层循环）、处理工具调用
    └─────┬─────┘
          ↓
    ┌────────────┐
    │ OBSERVING  │  分析结果、做出决策
    └─────┬──────┘
          ↓
     [Decision?]
          ├─→ continue  →  返回 PLANNING
          ├─→ compact   →  COMPACTING
          └─→ stop      →  COMPLETED
               
    ┌─────────────┐
    │ COMPACTING  │  压缩上下文消息
    └──────┬──────┘
           ↓
      返回 PLANNING
      
    ┌───────────┐
    │ COMPLETED │  任务成功完成
    └───────────┘
           
    ┌─────────┐
    │ FAILED  │  任务失败
    └─────────┘
```

### 状态说明

#### 1. INIT (初始化)
- **作用**: 创建执行上下文，初始化消息列表
- **转换**: 自动转换到 `PLANNING`

#### 2. PLANNING (规划 - Reasoning)
- **作用**: 
  - 检查是否达到最大迭代次数
  - 判断是否需要压缩上下文
  - 准备下一轮行动的提示词
- **转换**:
  - 达到最大迭代次数 → `COMPLETED`
  - 需要压缩 → `COMPACTING`
  - 正常情况 → `EXECUTING`

#### 3. EXECUTING (执行 - Acting)
- **作用**: 
  - 调用内层 Process 循环执行 LLM 调用
  - 处理工具调用和工具执行
  - 收集 LLM 响应
- **转换**:
  - 成功 → `OBSERVING`
  - 失败 → `FAILED`

#### 4. OBSERVING (观察结果)
- **作用**:
  - 分析 LLM 的输出
  - 检查是否有工具调用
  - 判断任务是否完成
- **决策逻辑**:
  - 有工具调用 → `continue` → `PLANNING`
  - 无工具调用且有完成标记 → `stop` → `COMPLETED`
  - 消息过多 → `compact` → `COMPACTING`

#### 5. COMPACTING (压缩上下文)
- **作用**:
  - 当消息数量超过阈值时，压缩历史消息
  - 保留系统消息和最近的消息
  - 可选：使用 LLM 生成摘要
- **转换**: 压缩完成后 → `PLANNING`

#### 6. COMPLETED (完成)
- **作用**: 返回最终结果
- **输出**: 
  - 成功标志
  - 最终消息列表
  - 迭代次数

#### 7. FAILED (失败)
- **作用**: 处理失败情况
- **输出**:
  - 失败标志
  - 错误信息
  - 迭代次数

---

## 内层状态机：Process Loop

### 状态定义

```typescript
type ProcessState = 
  | "IDLE"            // 空闲
  | "CALLING"         // 调用中
  | "STREAMING"       // 流式处理中
  | "TOOL_EXECUTING"  // 工具执行中
  | "RETRYING"        // 重试中
  | "SUCCESS"         // 成功
  | "ERROR"           // 错误
```

### 状态转换图

```
┌─────────────────────────────────────────────────────────────┐
│                     Process Loop                             │
└─────────────────────────────────────────────────────────────┘

        [START]
           ↓
      ┌────────┐
      │  IDLE  │  初始化上下文
      └────┬───┘
           ↓
    ┌──────────┐
    │ CALLING  │  发起 LLM API 调用
    └─────┬────┘
          │
          ├─ success ──→ STREAMING
          │
          └─ error ───→ [Retryable?]
                           ├─ Yes → RETRYING
                           └─ No  → ERROR
                           
    ┌─────────────┐
    │  STREAMING  │  处理流式输出（text-delta, tool-call等）
    └──────┬──────┘
           │
           ├─ has tool calls ──→ TOOL_EXECUTING
           ├─ no tool calls ───→ SUCCESS
           │
           └─ error ───→ [Retryable?]
                            ├─ Yes → RETRYING
                            └─ No  → ERROR
                            
    ┌──────────────────┐
    │ TOOL_EXECUTING   │  执行工具调用
    └────────┬─────────┘
             │
             ├─ success ──→ SUCCESS
             └─ error ────→ SUCCESS (返回错误作为工具结果)
             
    ┌───────────┐
    │ RETRYING  │  等待后重试
    └─────┬─────┘
          │
          ├─ retry count < max ──→ CALLING
          └─ retry exhausted ────→ ERROR
          
    ┌──────────┐
    │ SUCCESS  │  执行成功，返回结果
    └──────────┘
    
    ┌─────────┐
    │ ERROR   │  执行失败，抛出错误
    └─────────┘
```

### 状态说明

#### 1. IDLE (空闲)
- **作用**: 初始化执行上下文、重试计数器、延迟时间
- **转换**: 自动转换到 `CALLING`

#### 2. CALLING (调用中)
- **作用**:
  - 准备调用参数
  - 发起 LLM API 调用
  - 建立流式连接
- **转换**:
  - 成功 → `STREAMING`
  - 失败且可重试 → `RETRYING`
  - 失败且不可重试 → `ERROR`

#### 3. STREAMING (流式处理中)
- **作用**:
  - 监听并处理流式事件：
    - `text-delta`: 文本增量
    - `tool-call`: 工具调用
    - `reasoning`: 推理过程（如果支持）
    - `finish`: 流结束
    - `error`: 错误
  - 组装完整的响应消息
- **转换**:
  - 有工具调用 → `TOOL_EXECUTING`
  - 无工具调用 → `SUCCESS`
  - 错误且可重试 → `RETRYING`
  - 错误且不可重试 → `ERROR`

#### 4. TOOL_EXECUTING (工具执行中)
- **作用**:
  - 遍历所有工具调用
  - 查找并执行对应的工具函数
  - 收集工具执行结果
  - 处理工具执行错误
- **转换**:
  - 成功 → `SUCCESS`
  - 失败 → `SUCCESS` (将错误作为工具结果返回给 LLM)

#### 5. RETRYING (重试中)
- **作用**:
  - 增加重试计数
  - 等待一段时间（指数退避策略）
  - 记录重试日志
- **重试策略**:
  - 初始延迟: 1 秒
  - 每次重试延迟翻倍，最大 10 秒
  - 最大重试次数: 3（可配置）
- **转换**:
  - 未达到最大重试次数 → `CALLING`
  - 达到最大重试次数 → `ERROR`

#### 6. SUCCESS (成功)
- **作用**: 返回执行结果
- **输出**:
  - 成功标志
  - LLM 生成的消息
  - 工具调用列表
  - 工具执行结果

#### 7. ERROR (错误)
- **作用**: 处理不可恢复的错误
- **输出**:
  - 失败标志
  - 错误信息
- **行为**: 抛出错误给外层循环处理

### 可重试错误类型

**可重试**:
- 网络错误 (`ECONNREFUSED`, `ETIMEDOUT`, `ENOTFOUND`)
- 超时错误 (`Timeout`)
- 限流错误 (`429 Rate Limit`)
- 服务器错误 (`500`, `502`, `503`, `504`)

**不可重试**:
- 认证错误 (`401`, `403`)
- 请求错误 (`400`, `404`)
- 业务逻辑错误

---

## 数据流

### 外层循环数据流

```typescript
LoopInput {
  sessionId: string
  agentConfig: AgentConfig
  initialMessages: Message[]
  maxIterations: number
  compactThreshold: number
}
      ↓
[Agent Loop 处理]
      ↓
LoopResult {
  success: boolean
  messages: Message[]
  iterations: number
  error?: Error
}
```

### 内层循环数据流

```typescript
ExecuteInput {
  agent: AgentConfig
  messages: Message[]
  tools?: ToolSet
  maxRetries?: number
  timeout?: number
}
      ↓
[Process Loop 处理]
      ↓
ExecuteResult {
  success: boolean
  message?: AssistantMessage
  toolCalls?: ToolCall[]
  toolResults?: ToolResult[]
  error?: Error
}
```

---

## 使用示例

### 基本使用

```typescript
import { AgentLoop } from "@/session/loop";

const result = await AgentLoop.loop({
  sessionId: "session-123",
  agentConfig: {
    name: "my-agent",
    model: "gpt-4",
    provider: "openai",
    // ... 其他配置
  },
  initialMessages: [
    { role: "user", content: "帮我分析这段代码" }
  ],
  maxIterations: 10,
  compactThreshold: 20,
});

if (result.success) {
  console.log("任务完成！");
  console.log("迭代次数:", result.iterations);
  console.log("最终消息:", result.messages);
} else {
  console.error("任务失败:", result.error);
}
```

### 自定义工具

```typescript
const result = await AgentLoop.loop({
  sessionId: "session-123",
  agentConfig: {
    // ... 配置
    tools: ["calculator", "web_search"],
  },
  // ... 其他参数
});
```

---

## 扩展点

### 1. 自定义决策逻辑

在 `loop.ts` 中的 `makeDecision` 函数可以自定义决策逻辑：

```typescript
function makeDecision(context: AgentLoopContext, lastMessage: any): LoopDecision {
  // 自定义逻辑
  if (shouldStop(lastMessage)) return "stop";
  if (needsMoreContext(context)) return "continue";
  return "compact";
}
```

### 2. 自定义压缩策略

在 `COMPACTING` 状态中可以实现不同的压缩策略：

```typescript
// 策略 1: 简单截断（当前实现）
// 策略 2: LLM 摘要
// 策略 3: 关键信息提取
// 策略 4: 滑动窗口
```

### 3. 自定义重试策略

在 `processor.ts` 中的 `isRetryableError` 可以自定义重试逻辑：

```typescript
function isRetryableError(error: unknown): boolean {
  // 自定义判断逻辑
  return shouldRetry(error);
}
```

---

## 性能优化建议

1. **并行工具执行**: 当多个工具调用互不依赖时，可以并行执行
2. **流式响应**: 尽早开始处理流式输出，无需等待完整响应
3. **智能压缩**: 根据消息重要性选择性保留，而非简单截断
4. **缓存机制**: 对重复的工具调用结果进行缓存
5. **超时控制**: 为每个状态设置合理的超时时间

---

## 错误处理

### 外层循环错误
- **捕获**: 在 `EXECUTING` 状态捕获 Process 抛出的错误
- **处理**: 转换到 `FAILED` 状态，记录错误信息
- **恢复**: 可选择继续或终止

### 内层循环错误
- **捕获**: 在 `CALLING` 和 `STREAMING` 状态捕获错误
- **处理**: 判断是否可重试
- **重试**: 使用指数退避策略重试
- **失败**: 达到最大重试次数后抛出给外层

---

## 监控和日志

建议在以下位置添加监控点：

1. **状态转换**: 记录每次状态转换和耗时
2. **迭代次数**: 监控平均迭代次数和最大迭代次数
3. **工具调用**: 记录工具调用次数和成功率
4. **重试次数**: 监控重试频率和原因
5. **压缩频率**: 监控压缩触发频率和效果

---

## 总结

这个双层状态机设计提供了：

✅ **清晰的职责分离**: 外层处理业务逻辑，内层处理技术问题
✅ **强大的容错能力**: 完善的错误处理和重试机制
✅ **灵活的扩展性**: 易于添加新状态和自定义行为
✅ **良好的可观测性**: 详细的状态转换和日志记录

通过这个架构，Raye Agent 可以可靠地执行复杂的 AI 任务。
