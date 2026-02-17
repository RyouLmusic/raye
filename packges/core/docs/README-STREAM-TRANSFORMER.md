# 统一流转换器 (Unified Stream Transformer)

## 概述

这个转换器提供了一个统一的方式来处理不同大模型的推理（reasoning/thinking）输出格式，让你的代码可以兼容多个模型而无需为每个模型编写特定的处理逻辑。

## 支持的模型和格式

| 模型 | 配置 | 输出格式 | 转换方式 |
|------|------|---------|---------|
| DeepSeek V3 | `enable_thinking: true` | 原生 `reasoning-delta` chunks | 直接透传 |
| MiniMax M2.5 | `enable_thinking: true` | `<think>...</think>` 标签 | 解析标签转换为 reasoning chunks |
| MiniMax M2.5 | `reasoning_split: true` | 分离的推理流 | 直接透传（如果模型支持）|
| 其他模型 | - | 各种格式 | 可扩展 |

## 使用方法

### 1. 基本配置

在 `agent.json` 中配置你的模型：

```json
{
  "name": "agent2",
  "model": "MiniMax/MiniMax-M2.5",
  "provider": "MiniMax",
  "extra_body": {
    "enable_thinking": true  // 或 "reasoning_split": true
  }
}
```

### 2. 在代码中使用

```typescript
import { streamTextWrapper } from "@/session/stream-text-wrapper";
import { loadAndGetRecord } from "@/agent/config";

const agent = loadAndGetRecord().agent2!;

const result = await streamTextWrapper({
    agent,
    messages: [
        { role: 'user', content: '请介绍一下你自己' }
    ]
});

// 处理统一的输出流
for await (const chunk of result.fullStream) {
    if (chunk.type === 'reasoning-start') {
        console.log('💭 [Reasoning]');
    } else if (chunk.type === 'reasoning-delta') {
        process.stdout.write(chunk.textDelta);
    } else if (chunk.type === 'reasoning-end') {
        console.log('\n📄 [Response]');
    } else if (chunk.type === 'text-delta') {
        process.stdout.write(chunk.text);
    }
}
```

## 输出的 Chunk 类型

转换器统一输出以下标准 chunk 类型：

### Reasoning Chunks (推理)
- `reasoning-start`: 开始推理
- `reasoning-delta`: 推理内容流式输出
  - `textDelta: string` - 推理文本片段
- `reasoning-end`: 推理结束

### Text Chunks (响应)
- `text-start`: 开始文本响应
- `text-delta`: 文本内容流式输出
  - `text: string` - 文本片段
  - `id: string` - 文本块ID
- `text-end`: 文本结束

### Tool Chunks (工具调用)
- `tool-call-start`: 工具调用开始
- `tool-call-delta`: 工具调用参数流式输出
- `tool-call-end`: 工具调用结束
- `tool-result`: 工具执行结果

### 其他 Chunks
- `start`: 流开始
- `start-step`: 步骤开始
- `finish-step`: 步骤结束
- `finish`: 流结束
- `error`: 错误

## 工作原理

### 1. 原生 Reasoning Chunks
对于原生支持 reasoning chunks 的模型（如 DeepSeek），转换器直接透传这些 chunks。

### 2. 标签解析
对于使用 `<think>...</think>` 标签的模型（如 MiniMax），转换器：
1. 缓冲 `text-delta` chunks
2. 检测 `<think>` 和 `</think>` 标签
3. 将标签内的内容转换为 `reasoning-delta` chunks
4. 将标签外的内容保持为 `text-delta` chunks

### 3. 缓冲策略
- 保留末尾几个字符以处理跨 chunk 的标签
- `<think>` 标签：保留最后 7 个字符
- `</think>` 标签：保留最后 8 个字符

## 扩展支持其他模型

要添加对新模型的支持，可以修改 `stream-transformer.ts`：

```typescript
// 在 transform 函数中添加新的处理逻辑
if (chunk.type === 'custom-thinking-type') {
    // 转换为标准 reasoning-delta
    controller.enqueue({
        type: 'reasoning-delta',
        textDelta: chunk.customThinkingContent,
    });
    return;
}
```

## 完整示例

查看 `test/stream.ts` 获取完整的使用示例，包括：
- 彩色输出
- 错误处理
- 元数据访问
- 完整推理内容获取

## 注意事项

1. **配置一致性**: 确保 `extra_body` 中的配置与模型的实际支持匹配
2. **推理分离**: 某些模型的 `reasoning_split` 可能完全分离推理内容，需要额外处理
3. **性能**: 缓冲策略会略微增加延迟，但确保了正确的标签解析
4. **扩展性**: 转换器设计为可扩展，可以轻松添加新的模型支持

## 未来扩展

- [ ] MCP (Model Context Protocol) 调用支持
- [ ] Skills 调用统一处理
- [ ] 多模态内容转换（图片、文件等）
- [ ] 流式工具调用的统一处理
- [ ] 更多模型的原生支持
