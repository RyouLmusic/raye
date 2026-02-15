# Usage 统计问题解决方案

## 问题

ModelScope API 的流式接口返回的 usage 统计全部为 0：

```typescript
const result = await streamTextWrapper({...});
for await (const chunk of result.fullStream) {
  if (chunk.type === 'finish') {
    console.log(chunk.totalUsage); // 全是 0
  }
}
```

## 原因

这是 **ModelScope API 的限制**，流式响应不包含 token 使用统计。

## 解决方案

### 方案 1: 使用 `streamWithUsage` 辅助函数（推荐）

```typescript
import { streamWithUsage } from 'core';

const { stream, getUsage } = await streamWithUsage({
  agent: agentConfig,
  messages: [{ role: 'user', content: '你好' }]
});

// 流式显示
for await (const chunk of stream.textStream) {
  process.stdout.write(chunk);
}

// 获取准确的 usage
const usage = await getUsage();
console.log(`Total: ${usage.totalTokens} tokens`);
```

### 方案 2: 使用非流式模式

```typescript
import { generateTextWrapper } from 'core';

const result = await generateTextWrapper({
  agent: agentConfig,
  messages: [{ role: 'user', content: '你好' }]
});

console.log(result.text);
console.log(result.usage); // ✅ 有准确的 usage
```

### 方案 3: 在 onFinish 中获取 usage

```typescript
import { streamTextWrapper, fetchUsageAfterStream } from 'core';

const result = await streamTextWrapper({
  agent: agentConfig,
  messages: [{ role: 'user', content: '你好' }],
  onFinish: async (finishResult) => {
    const usage = await fetchUsageAfterStream(input, finishResult.text);
    console.log('Actual usage:', usage);
  }
});
```

## 完整示例

查看测试文件：
- `test/example-stream-with-usage.ts` - 流式 + usage 示例
- `test/test-non-stream-usage.ts` - 非流式模式示例
- `test/debug-usage.ts` - 调试脚本

## 工作原理

由于流式接口不返回 usage，`streamWithUsage` 函数会：
1. 正常进行流式响应（给用户）
2. 在后台发送一个轻量级的非流式请求来获取 usage
3. 返回两者的结果

这样既保证了用户体验（实时流式），又能获得准确的统计信息。

## 注意事项

- 使用 `streamWithUsage` 会额外消耗少量 token（默认限制为 10）
- 如果只需要 usage 而不需要流式，直接使用 `generateTextWrapper`
- 不同提供商的支持情况不同，详见 `docs/MODELSCOPE-USAGE-ISSUE.md`
