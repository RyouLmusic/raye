# StreamText 高级参数使用指南

## 概述

`streamTextWrapper` 现在支持更多的高级参数，让你能够更精细地控制 AI 的行为和输出。

## 已实现的重要参数

### 1. 提示词参数

#### `system` - 系统消息
用于设置 AI 助手的角色和行为准则。

```typescript
const result = await streamTextWrapper({
    agent,
    messages: [{ role: 'user', content: '写一首诗' }],
    
    // 设置 AI 的角色
    system: "你是一位充满诗意的作家，擅长用优美的文字描述自然景色。"
});
```

**最佳实践：**
- 清晰定义 AI 的角色和专长
- 设置输出格式和风格要求
- 定义行为边界和限制

---

### 2. 生成控制参数

#### `maxOutputTokens` - 最大输出令牌数
限制生成文本的最大长度。

```typescript
const result = await streamTextWrapper({
    agent,
    messages: [{ role: 'user', content: '介绍人工智能' }],
    
    // 限制最多生成 500 个令牌
    maxOutputTokens: 500
});
```

**使用场景：**
- 控制响应长度
- 节省 API 成本
- 确保回复简洁

---

#### `temperature` - 温度设置
控制输出的随机性和创造性。

```typescript
const result = await streamTextWrapper({
    agent,
    messages: [{ role: 'user', content: '描述春天' }],
    
    // 范围 0-2，较高值更有创意
    temperature: 0.9
});
```

**参数说明：**
- `0.0 - 0.3`: 确定性强，适合事实性回答
- `0.4 - 0.7`: 平衡创意和确定性，推荐默认值
- `0.8 - 1.2`: 创意性强，适合创作内容
- `1.3 - 2.0`: 高度随机，实验性

**注意：** 不要同时使用 `temperature` 和 `topP`

---

#### `topP` - 核采样概率
控制采样的概率质量，范围 0-1。

```typescript
const result = await streamTextWrapper({
    agent,
    messages: [{ role: 'user', content: '写一个故事' }],
    
    // 只考虑前 90% 概率的令牌
    topP: 0.9
});
```

**参数说明：**
- `0.1`: 非常保守，只选择最可能的词
- `0.5`: 中等范围
- `0.9`: 推荐值，允许更多样化
- `1.0`: 考虑所有可能的词

---

### 3. 请求控制参数

#### `maxRetries` - 最大重试次数
设置请求失败时的重试次数。

```typescript
const result = await streamTextWrapper({
    agent,
    messages: [{ role: 'user', content: '你好' }],
    
    // 失败时最多重试 3 次
    maxRetries: 3
});
```

**默认值：** 2

**最佳实践：**
- 生产环境建议设置 2-3 次
- 测试环境可以设置为 0 快速失败
- 关键任务可以增加到 5 次

---

#### `abortSignal` - 中止信号
允许取消正在进行的请求。

```typescript
const controller = new AbortController();

// 10秒后自动取消
setTimeout(() => controller.abort(), 10000);

const result = await streamTextWrapper({
    agent,
    messages: [{ role: 'user', content: '长篇内容' }],
    
    // 传入中止信号
    abortSignal: controller.signal
});

// 或者用户点击取消按钮时
button.onclick = () => controller.abort();
```

**使用场景：**
- 用户取消操作
- 请求超时控制
- 组件卸载时清理

---

#### `timeout` - 超时时间
设置请求的超时时间（毫秒）。

```typescript
const result = await streamTextWrapper({
    agent,
    messages: [{ role: 'user', content: '复杂问题' }],
    
    // 30秒超时
    timeout: 30000
});
```

**推荐设置：**
- 简单问答：10,000 (10秒)
- 中等复杂度：30,000 (30秒)
- 复杂任务：60,000 (60秒)
- 长时间任务：120,000 (2分钟)

---

### 4. 回调函数

#### `onFinish` - 完成回调
在 LLM 响应和所有工具执行完成后调用。

```typescript
const result = await streamTextWrapper({
    agent,
    messages: [{ role: 'user', content: '你好' }],
    
    // 完成时记录使用情况
    onFinish: async ({ text, usage, finishReason }) => {
        console.log("完成原因:", finishReason);
        console.log("使用令牌:", {
            输入: usage.promptTokens,
            输出: usage.completionTokens,
            总计: usage.totalTokens
        });
        
        // 可以将使用情况保存到数据库
        await saveUsageToDatabase(usage);
    }
});
```

**回调参数：**
- `text`: 完整的生成文本
- `usage`: 令牌使用情况
- `finishReason`: 完成原因 (`stop`, `length`, `content-filter` 等)
- `steps`: 所有步骤的详情

---

#### `onError` - 错误回调
在流处理过程中发生错误时调用。

```typescript
const result = await streamTextWrapper({
    agent,
    messages: [{ role: 'user', content: '你好' }],
    
    // 错误处理
    onError: async (error) => {
        console.error("❌ 发生错误:", error);
        
        // 记录错误到日志系统
        await logError(error);
        
        // 发送错误通知
        await notifyAdmin(error);
    }
});
```

---

## 完整示例

### 示例 1: 创意写作助手

```typescript
const result = await streamTextWrapper({
    agent,
    
    // 系统消息定义角色
    system: "你是一位资深的创意写作导师，擅长激发灵感并提供建设性反馈。",
    
    messages: [
        { role: 'user', content: '帮我写一个科幻故事的开头' }
    ],
    
    // 高温度激发创意
    temperature: 0.9,
    
    // 限制长度为中等长度
    maxOutputTokens: 1000,
    
    // 设置超时
    timeout: 45000,
    
    // 记录使用情况
    onFinish: async ({ usage }) => {
        console.log(`生成了 ${usage.completionTokens} 个令牌`);
    }
});
```

### 示例 2: 精确的问答系统

```typescript
const result = await streamTextWrapper({
    agent,
    
    system: "你是一个精确的问答助手，只回答事实性问题，不进行推测。",
    
    messages: [
        { role: 'user', content: '什么是量子纠缠？' }
    ],
    
    // 低温度确保准确性
    temperature: 0.2,
    
    // 中等长度回答
    maxOutputTokens: 500,
    
    // 增加重试次数确保稳定性
    maxRetries: 3
});
```

### 示例 3: 可取消的长任务

```typescript
const controller = new AbortController();

// UI 取消按钮
cancelButton.onclick = () => controller.abort();

try {
    const result = await streamTextWrapper({
        agent,
        
        messages: [
            { role: 'user', content: '详细分析这份文档...' }
        ],
        
        // 传入中止信号
        abortSignal: controller.signal,
        
        // 长任务超时
        timeout: 120000,
        
        onError: async (error) => {
            if (error.name === 'AbortError') {
                console.log('用户取消了任务');
            }
        }
    });
    
    // 处理结果...
} catch (error) {
    // 处理错误
}
```

---

## 运行示例

我们提供了完整的示例代码：

```bash
# 基础高级参数示例
bun test/advanced-parameters.ts

# 取消信号示例
bun test/advanced-parameters.ts abort

# 温度对比示例
bun test/advanced-parameters.ts temperature
```

---

## 最佳实践总结

1. **System 消息**
   - 始终定义清晰的角色和行为准则
   - 包含输出格式要求

2. **Temperature 设置**
   - 事实性任务：0.2-0.3
   - 平衡任务：0.5-0.7
   - 创意任务：0.8-1.2

3. **令牌限制**
   - 根据需求设置合理的 `maxOutputTokens`
   - 避免浪费 API 成本

4. **错误处理**
   - 始终设置 `onError` 回调
   - 记录错误用于调试

5. **超时和取消**
   - 长任务设置合理的 `timeout`
   - 提供取消功能提升用户体验

6. **监控和分析**
   - 使用 `onFinish` 记录使用情况
   - 分析令牌消耗优化成本
