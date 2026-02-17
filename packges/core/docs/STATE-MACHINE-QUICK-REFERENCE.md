# Agent Loop 状态机转换关系速查表

## 外层状态机 (Agent ReAct Loop)

### 状态转换表

| 当前状态   | 触发条件                           | 下一状态    | 说明                    |
|------------|-----------------------------------|------------|------------------------|
| INIT       | 初始化完成                         | PLANNING   | 自动转换                |
| PLANNING   | 达到最大迭代次数                   | COMPLETED  | 正常结束                |
| PLANNING   | 需要压缩上下文                     | COMPACTING | 消息数超过阈值          |
| PLANNING   | 正常情况                           | EXECUTING  | 开始执行                |
| EXECUTING  | LLM 调用成功                       | OBSERVING  | 观察结果                |
| EXECUTING  | LLM 调用失败                       | FAILED     | 执行失败                |
| OBSERVING  | decision = "continue"             | PLANNING   | 继续下一轮              |
| OBSERVING  | decision = "compact"              | COMPACTING | 先压缩再继续            |
| OBSERVING  | decision = "stop"                 | COMPLETED  | 任务完成                |
| COMPACTING | 压缩成功                           | PLANNING   | 返回规划                |
| COMPACTING | 压缩失败                           | FAILED     | 压缩错误                |
| COMPLETED  | -                                 | [END]      | 返回结果                |
| FAILED     | -                                 | [END]      | 抛出错误                |

### 决策逻辑 (OBSERVING → ?)

```typescript
function makeDecision(context, lastMessage) {
    // 优先级 1: 强制压缩
    if (context.needsCompaction) return "compact";
    
    // 优先级 2: 有工具调用 → 继续
    if (hasToolCalls(lastMessage)) return "continue";
    
    // 优先级 3: 检查停止信号
    if (hasStopSignal(lastMessage)) return "stop";
    
    // 优先级 4: LLM 完成响应 → 停止
    if (isAssistantMessage(lastMessage)) return "stop";
    
    // 默认: 继续
    return "continue";
}
```

---

## 内层状态机 (Process Loop)

### 状态转换表

| 当前状态        | 触发条件                    | 下一状态        | 说明                   |
|----------------|----------------------------|----------------|------------------------|
| IDLE           | 初始化完成                  | CALLING        | 自动转换                |
| CALLING        | API 调用成功                | STREAMING      | 开始流式处理            |
| CALLING        | 可重试错误                  | RETRYING       | 准备重试                |
| CALLING        | 不可重试错误                | ERROR          | 失败退出                |
| STREAMING      | 有工具调用                  | TOOL_EXECUTING | 执行工具                |
| STREAMING      | 无工具调用                  | SUCCESS        | 成功完成                |
| STREAMING      | 可重试错误                  | RETRYING       | 准备重试                |
| STREAMING      | 不可重试错误                | ERROR          | 失败退出                |
| TOOL_EXECUTING | 工具执行完成（成功或失败）   | SUCCESS        | 返回结果（含错误信息）  |
| RETRYING       | 未达到重试上限              | CALLING        | 重新调用                |
| RETRYING       | 达到重试上限                | ERROR          | 重试失败                |
| SUCCESS        | -                          | [RETURN]       | 返回成功结果            |
| ERROR          | -                          | [THROW]        | 抛出错误                |

### 错误分类

**可重试错误** (→ RETRYING):
- 网络错误: `ECONNREFUSED`, `ETIMEDOUT`, `ENOTFOUND`
- HTTP 错误: `429`, `500`, `502`, `503`, `504`
- 超时错误: `Timeout`

**不可重试错误** (→ ERROR):
- 认证错误: `401`, `403`
- 客户端错误: `400`, `404`
- 业务逻辑错误

---

## 关键检查点

### 外层循环检查点

```
[START] → INIT
    ↓
PLANNING ← ──┐
    ↓        │
    ├─ 达到最大迭代? → YES → COMPLETED
    ├─ 需要压缩? → YES → COMPACTING → ──┘
    └─ NO ↓
EXECUTING
    ↓
    ├─ 成功? → YES → OBSERVING
    └─ NO → FAILED
         ↓
    ├─ 有工具调用? → YES → PLANNING
    ├─ 有停止信号? → YES → COMPLETED
    └─ 默认 → PLANNING/COMPLETED
```

### 内层循环检查点

```
[START] → IDLE → CALLING
              ↓
          [成功?]
          ├─ YES → STREAMING
          └─ NO → [可重试?]
                  ├─ YES → RETRYING
                  └─ NO → ERROR
                      ↓
                  STREAMING
                      ↓
                  [有工具?]
                  ├─ YES → TOOL_EXECUTING → SUCCESS
                  └─ NO → SUCCESS
                      ↓
                  RETRYING
                      ↓
                  [次数<上限?]
                  ├─ YES → CALLING
                  └─ NO → ERROR
```

---

## 重试策略

### 指数退避

```typescript
初始延迟: 1000ms
重试次数: 0,  1,   2,   3
延迟时间: 1s, 2s,  4s,  8s (最大10s)
```

### 示例代码

```typescript
let retryDelay = 1000;  // 1 秒
const maxDelay = 10000; // 10 秒

while (retryCount < maxRetries) {
    await sleep(retryDelay);
    retryDelay = Math.min(retryDelay * 2, maxDelay);
    retryCount++;
}
```

---

## 压缩策略

### 触发条件

1. **消息数量**: `messages.length >= compactThreshold`
2. **Token 数量**: `tokenCount >= maxTokens` (可选)
3. **手动触发**: `context.needsCompaction = true`

### 压缩方法

**方法 1: 简单截断**（当前实现）
```typescript
保留: 系统消息 + 最近 70% 的消息
示例: 20 条消息 → 保留系统消息 + 最近 14 条
```

**方法 2: LLM 摘要**（待实现）
```typescript
使用 LLM 生成历史对话摘要
保留: 系统消息 + 摘要 + 最近几条消息
```

**方法 3: 关键信息提取**（待实现）
```typescript
提取关键信息（用户意图、重要结果、工具输出等）
保留: 系统消息 + 关键信息 + 最近几条消息
```

---

## 性能指标

### 建议监控的指标

```typescript
// 外层循环
- 平均迭代次数
- 最大迭代次数
- 压缩触发频率
- 任务成功率

// 内层循环
- 平均重试次数
- API 调用耗时
- 工具执行耗时
- 错误类型分布

// 整体
- 端到端延迟
- Token 使用量
- 成本估算
```

---

## 日志输出示例

```
[AgentLoop] 初始化 Session: session-123
[AgentLoop] 最大迭代次数: 10
[AgentLoop] 状态: PLANNING, 迭代: 1/10
[AgentLoop] 开始规划第 1 轮行动
[AgentLoop] 状态: EXECUTING, 迭代: 1/10
[AgentLoop] 执行 LLM 调用 - 进入内层循环
[Process] 开始执行 LLM 调用
[Process] 最大重试次数: 3
[Process] 状态: CALLING, 重试: 0/3
[Process] 发起 LLM API 调用
[Process] LLM API 调用成功，开始流式处理
[Process] 状态: STREAMING, 重试: 0/3
[Process] 处理流式输出
[Process] 检测到 2 个工具调用
[Process] 状态: TOOL_EXECUTING, 重试: 0/3
[Process] 执行工具调用
[Process] 执行 2 个工具
[Process] 工具 calculator 执行成功
[Process] 工具 search 执行成功
[Process] 工具执行完成，结果数: 2
[Process] 状态: SUCCESS, 重试: 0/3
[Process] 执行成功
[AgentLoop] LLM 调用成功，收到 2 个工具调用
[AgentLoop] 状态: OBSERVING, 迭代: 1/10
[AgentLoop] 观察执行结果并决策
[AgentLoop] 决策结果: continue
[AgentLoop] 状态: PLANNING, 迭代: 2/10
...
[AgentLoop] 决策结果: stop
[AgentLoop] 状态: COMPLETED, 迭代: 5/10
[AgentLoop] 循环完成，总迭代次数: 5
[AgentLoop] 最终消息数: 12
```

---

## 配置建议

### 开发环境

```typescript
{
  maxIterations: 5,       // 较少迭代，快速验证
  compactThreshold: 10,   // 较低阈值，测试压缩
  maxRetries: 2,          // 较少重试，快速失败
  timeout: 10000,         // 10秒超时
}
```

### 生产环境

```typescript
{
  maxIterations: 20,      // 充足的迭代次数
  compactThreshold: 50,   // 较高阈值，减少压缩
  maxRetries: 3,          // 适度重试
  timeout: 30000,         // 30秒超时
}
```

---

## 故障排查

### 问题 1: 无限循环

**症状**: 迭代次数不断增加，无法完成
**检查**:
1. `maxIterations` 是否合理
2. `makeDecision` 逻辑是否正确
3. LLM 是否持续返回工具调用

### 问题 2: 频繁重试

**症状**: 内层循环不断重试
**检查**:
1. API 配置是否正确（URL, Key）
2. 网络连接是否稳定
3. 是否遇到限流（429）
4. 超时设置是否过短

### 问题 3: 频繁压缩

**症状**: 上下文频繁触发压缩
**检查**:
1. `compactThreshold` 是否过低
2. 每轮对话消息数是否过多
3. 是否需要优化工具输出

### 问题 4: OOM (内存溢出)

**症状**: 内存使用不断增长
**检查**:
1. 压缩是否正常工作
2. 是否存在消息累积
3. 工具输出是否过大
