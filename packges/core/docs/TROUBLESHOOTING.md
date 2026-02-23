# 故障排查指南

## 快速诊断

遇到错误时，首先查看错误类型：

```
⚠️  LLM 调用失败 (错误类型): 错误消息
```

根据错误类型，参考下面的解决方案。

---

## AI_TypeValidationError

### 错误示例
```
[AI_TypeValidationError]: Type validation failed
Error message: Invalid input: expected array, received null
```

### 原因
模型返回的响应格式不符合 OpenAI API 标准。常见于：
- 非官方的 OpenAI 兼容 API
- 某些国产模型的代理服务
- API 网关的格式转换问题

### 解决方案

1. **自动重试（已内置）**
   - 系统会自动重试 5 次（默认）
   - 每次重试延迟 1 秒
   - 如果重试成功，对话会自动继续

2. **更换模型**
   
   在 `agent.json` 中切换到更稳定的模型：
   
   ```json
   {
       "name": "agent",
       "model": "moonshotai/kimi-k2.5",  // 更换为稳定的模型
       "provider": "moonshotai"
   }
   ```

3. **增加重试次数**
   
   ```json
   {
       "name": "agent",
       "max_retries": 10  // 增加到 10 次
   }
   ```

4. **检查 API 配置**
   
   确保 `base_url` 和 `api_key` 正确：
   
   ```json
   {
       "base_url": "https://api-inference.modelscope.cn/v1",
       "api_key": "your-api-key"
   }
   ```

5. **联系提供商**
   
   如果问题持续，联系 API 提供商确认：
   - 模型是否支持 OpenAI 格式
   - 是否有已知的兼容性问题
   - 是否需要特殊的配置参数

---

## 429 Too Many Requests

### 错误示例
```
⚠️  LLM 调用失败 - 速率限制 (429 Too Many Requests)
```

### 原因
- API 调用频率超过限制
- 账户配额用尽
- 并发请求过多

### 解决方案

1. **等待后重试**
   - 系统会自动等待 5 秒后重试
   - 如果有 `Retry-After` 头，会按照指定时间等待

2. **降低调用频率**
   
   增加 `maxIterations` 之间的延迟（需要自定义实现）

3. **升级账户**
   
   联系 API 提供商升级到更高的配额

4. **使用多个 API 密钥**
   
   配置多个 agent，轮流使用：
   
   ```json
   [
       {
           "name": "agent1",
           "api_key": "key-1"
       },
       {
           "name": "agent2",
           "api_key": "key-2"
       }
   ]
   ```

---

## 网络错误

### 错误类型
- `ECONNREFUSED` - 连接被拒绝
- `ETIMEDOUT` - 连接超时
- `ENOTFOUND` - DNS 解析失败

### 解决方案

1. **检查网络连接**
   ```bash
   ping api-inference.modelscope.cn
   ```

2. **检查防火墙**
   - 确保允许访问 API 端点
   - 检查代理设置

3. **验证 base_url**
   ```bash
   curl https://api-inference.modelscope.cn/v1/models
   ```

4. **增加超时时间**
   ```json
   {
       "timeout": 120000  // 增加到 120 秒
   }
   ```

---

## 401 Unauthorized / 403 Forbidden

### 原因
- API 密钥无效或过期
- 权限不足

### 解决方案

1. **验证 API 密钥**
   ```bash
   curl -H "Authorization: Bearer YOUR_API_KEY" \
        https://api-inference.modelscope.cn/v1/models
   ```

2. **更新 API 密钥**
   
   在 `agent.json` 中更新：
   ```json
   {
       "api_key": "new-valid-key"
   }
   ```

3. **检查权限**
   
   确认账户有权访问指定的模型

---

## 500/502/503/504 服务器错误

### 原因
- API 服务暂时不可用
- 服务器负载过高
- 维护中

### 解决方案

1. **自动重试（已内置）**
   - 系统会自动重试
   - 使用指数退避策略

2. **检查服务状态**
   
   访问提供商的状态页面

3. **更换提供商**
   
   临时切换到备用 API

---

## 调试技巧

### 启用详细日志

```typescript
await AgentLoop.loop({
    sessionId,
    agentConfig,
    message: userMsg,
    debug: true,  // 启用 debug
});
```

或设置环境变量：
```bash
export RAYE_DEBUG=1
```

### 查看完整错误堆栈

在 catch 块中打印完整错误：
```typescript
} catch (error) {
    console.error("完整错误:", error);
    console.error("错误堆栈:", (error as Error).stack);
}
```

### 测试 API 连接

创建简单的测试脚本：
```typescript
import { openai } from "@ai-sdk/openai";
import { generateText } from "ai";

const result = await generateText({
    model: openai.chat("gpt-3.5-turbo"),
    prompt: "Hello",
});

console.log(result.text);
```

---

## 预防措施

### 1. 选择稳定的提供商

优先级：
1. OpenAI 官方 API
2. 大厂的官方 API（Azure, AWS, Google）
3. 知名的代理服务
4. 自建服务

### 2. 配置合理的重试策略

```json
{
    "max_retries": 5,
    "timeout": 60000
}
```

### 3. 监控错误率

记录每次调用的结果：
```typescript
const stats = {
    success: 0,
    failed: 0,
    retried: 0
};

// 在 observer 中统计
observer: {
    onLoopEnd: ({ success }) => {
        if (success) stats.success++;
        else stats.failed++;
    }
}
```

### 4. 实现降级策略

```typescript
const providers = ["primary", "backup1", "backup2"];

for (const provider of providers) {
    try {
        const result = await callWithProvider(provider);
        return result;
    } catch (error) {
        console.warn(`Provider ${provider} failed, trying next...`);
    }
}
```

---

## 常见问题

### Q: 为什么重试后还是失败？

A: 可能的原因：
1. 错误不可重试（如 401, 400）
2. 达到最大重试次数
3. 根本性的配置问题

解决：检查错误类型，修复根本原因。

### Q: 如何知道重试了多少次？

A: 查看日志：
```
🔄 将在 1000ms 后重试 (1/5)
⏳ 重试 1/5，等待 1000ms...
```

### Q: 重试会影响性能吗？

A: 会有轻微影响：
- 每次重试增加 1-5 秒延迟
- 消耗额外的 API 配额
- 但能显著提高成功率

### Q: 如何禁用某个模型的重试？

A: 设置 `max_retries: 0`：
```json
{
    "name": "unreliable-model",
    "max_retries": 0
}
```

---

## 获取帮助

如果以上方法都无法解决问题：

1. 收集以下信息：
   - 完整的错误消息
   - agent.json 配置（隐藏 API 密钥）
   - 调用日志（启用 debug 模式）
   - 模型和提供商信息

2. 检查是否是已知问题：
   - 查看项目 Issues
   - 搜索相关错误消息

3. 提交 Issue：
   - 提供完整的复现步骤
   - 附上错误日志
   - 说明已尝试的解决方案
