# 重试策略配置指南

## 概述

系统实现了智能的错误重试机制，特别针对速率限制（HTTP 429）和临时性网络错误进行了优化。

## 可重试的错误类型

### 网络错误
- `ECONNREFUSED` - 连接被拒绝
- `ETIMEDOUT` - 连接超时
- `ENOTFOUND` - DNS 解析失败

### HTTP 状态码
- `429` - Too Many Requests（速率限制）⭐ 
- `500` - Internal Server Error
- `502` - Bad Gateway
- `503` - Service Unavailable
- `504` - Gateway Timeout

### 超时错误
- 消息中包含 "timeout" 关键字的错误

## 重试参数配置

### 默认配置

```typescript
{
  maxRetries: 5,      // 最大重试次数（从 3 增加到 5）
  retryDelay: 2000,   // 初始延迟 2 秒（从 1 秒增加到 2 秒）
  maxDelay: 30000     // 最大延迟 30 秒（从 10 秒增加到 30 秒）
}
```

### Agent 配置中设置

在 agent.json 中配置：

```json
{
  "name": "agent1",
  "model": "...",
  "max_retries": 5,
  "timeout": 60000
}
```

### 代码中动态配置

```typescript
import { AgentLoop } from "@/session/loop";

await AgentLoop.loop({
  sessionId: "session-1",
  agentConfig: {
    name: "agent1",
    max_retries: 5,  // 自定义重试次数
    // ... 其他配置
  },
  message: { role: "user", content: "Hello" }
});
```

## 429 错误特殊处理

### 智能延迟策略

对于 429 错误（速率限制），系统会：

1. **检查 Retry-After 响应头**
   - 如果 API 返回了 `Retry-After` 头，将遵循其指定的等待时间

2. **使用更长的初始延迟**
   - 如果没有 `Retry-After` 头，强制最小延迟为 5 秒（而不是默认的 2 秒）

3. **更缓和的指数退避**
   - 对于已经很大的延迟（≥5秒），增长率为 1.5x 而非 2x
   - 最大延迟上限为 30 秒

### 示例场景

```
第一次调用: 失败 (429)
  ↓ 等待 5 秒
第二次调用: 失败 (429)
  ↓ 等待 7.5 秒 (5 * 1.5)
第三次调用: 失败 (429)
  ↓ 等待 11.25 秒 (7.5 * 1.5)
第四次调用: 失败 (429)
  ↓ 等待 16.875 秒 (11.25 * 1.5)
第五次调用: 失败 (429)
  ↓ 等待 25.3 秒 (16.875 * 1.5)
第六次调用: 放弃（超过 maxRetries）
```

## 错误日志改进

### 友好的 429 错误提示

现在当遇到 429 错误时，会显示更友好的日志：

```
⚠️  速率限制 (429 Too Many Requests):
  timestamp: 2026-02-22T16:39:15.329Z
  agent: agent2
  model: Qwen/Qwen3-235B-A22B-Instruct-2507
  message: 请求过于频繁，系统将自动重试
```

### 重试过程日志

```
⏳ 重试 1/5，等待 5000ms...
⏳ 重试 2/5，等待 7500ms...
```

## 最佳实践

### 1. 选择合适的重试次数

- **轻量级请求**：3-5 次重试
- **关键任务**：5-10 次重试
- **后台任务**：可以更多

### 2. 处理速率限制

如果频繁遇到 429 错误：

1. **增加重试次数**：
   ```json
   "max_retries": 10
   ```

2. **降低请求频率**：在应用层面添加请求间隔

3. **使用备用模型**：配置多个不同的 API 提供商

4. **升级 API 计划**：联系提供商获取更高的速率限制

### 3. 监控重试情况

启用调试日志查看重试详情：

```bash
export RAYE_DEBUG=1
```

### 4. 设置合理的超时

```json
{
  "timeout": 60000,  // 60 秒总超时
  "max_retries": 5   // 但会在重试间暂停
}
```

注意：`timeout` 是单次请求的超时时间，不包括重试间的等待时间。

## 故障排查

### 问题：仍然失败即使有重试

**可能原因**：
- API 完全不可用
- 认证凭据错误（401/403 不可重试）
- 请求格式错误（400 不可重试）

**解决方案**：
1. 检查 API 密钥是否正确
2. 验证请求参数格式
3. 查看详细错误日志确定根本原因

### 问题：重试太慢

**可能原因**：
- 遇到 429 错误导致延迟很长

**解决方案**：
```typescript
// 在测试环境可以调整参数
const executeResult = await Processor.execute({
  maxRetries: 3,  // 减少重试次数
  // ...
});
```

### 问题：NoOutputGeneratedError

**根本原因**：
- 所有重试都失败了
- 流没有生成任何输出

**解决方案**：
1. 查看前面的错误日志确定失败原因
2. 增加 `max_retries`
3. 检查网络连接
4. 验证 API 状态

## 进阶：自定义重试逻辑

如果需要更复杂的重试逻辑，可以修改 [executor.ts](../src/session/processor/executor.ts) 中的：

1. `getRetryInfo()` - 定义哪些错误可重试
2. `RETRYING` 状态处理 - 自定义延迟策略

```typescript
function getRetryInfo(error: unknown): RetryInfo {
  // 添加自定义逻辑
  if (isMyCustomError(error)) {
    return { 
      isRetryable: true, 
      retryAfter: 10  // 强制等待 10 秒
    };
  }
  // ...
}
```

## 相关文档

- [会话架构文档](./SESSION-ARCHITECTURE-IMPLEMENTATION.md)
- [状态机文档](./STATE-MACHINE.md)
- [流处理文档](./STREAM-HANDLER-README.md)
