# 大模型推理配置指南

## 推荐配置

### MiniMax M2.5

#### 选项 1: 使用 `enable_thinking` (推荐)
```json
{
    "name": "minimax-agent",
    "model": "MiniMax/MiniMax-M2.5",
    "provider": "MiniMax",
    "extra_body": {
        "enable_thinking": true
    }
}
```

**优点:**
- ✅ 与统一转换器完美配合
- ✅ 推理内容包含在流中，可以实时显示
- ✅ 兼容性好

**缺点:**
- ⚠️ 推理内容以 `<think>` 标签包裹，需要转换器解析

#### 选项 2: 使用 `reasoning_split`
```json
{
    "name": "minimax-agent",
    "model": "MiniMax/MiniMax-M2.5",
    "provider": "MiniMax",
    "extra_body": {
        "reasoning_split": true
    }
}
```

**优点:**
- ✅ 推理内容与响应内容完全分离

**缺点:**
- ❌ 推理内容可能不在标准流中返回
- ❌ 需要额外的处理逻辑来访问推理内容

**结论:** 推荐使用 `enable_thinking: true`

### DeepSeek V3

```json
{
    "name": "deepseek-agent",
    "model": "deepseek-ai/DeepSeek-V3.2",
    "provider": "DeepSeek",
    "extra_body": {
        "enable_thinking": true
    }
}
```

**特点:**
- ✅ 原生支持 `reasoning-delta` chunks
- ✅ 直接兼容统一转换器
- ✅ 推理质量高

### Kimi K2.5

```json
{
    "name": "kimi-agent",
    "model": "moonshotai/Kimi-K2.5",
    "provider": "Kimi",
    "extra_body": {
        "enable_thinking": true
    }
}
```

**特点:**
- 需要测试具体的推理输出格式
- 可能需要添加额外的转换逻辑

### GLM-5

```json
{
    "name": "glm-agent",
    "model": "ZhipuAI/GLM-5",
    "provider": "ZhipuAI",
    "extra_body": {
        "temperature": 0.7,
        "max_tokens": 2048
    }
}
```

**特点:**
- 基础模型，可能不支持显式推理
- 如果支持，添加 `enable_thinking: true` 测试

## 关于 `reasoning_split` 的说明

### 什么是 `reasoning_split`?

`reasoning_split: true` 告诉模型将推理（thinking）内容与最终响应分离输出。

### 使用场景

1. **仅需最终响应**: 如果你只想要最终答案，不关心推理过程
2. **后处理推理**: 如果你想在服务端处理推理，不发给客户端
3. **性能优化**: 减少客户端需要处理的数据量

### 为什么推理内容"不见了"?

使用 `reasoning_split: true` 时:
- 推理内容可能在响应的特定字段中（非流式）
- 或者通过单独的 API 端点获取
- 或者在 `result.reasoning` 中（但可能是空的，取决于模型实现）

### 解决方案

使用统一转换器 + `enable_thinking: true`:
```typescript
import { streamTextWrapper } from "@/session/stream-text-wrapper";

const result = await streamTextWrapper({
    agent: yourAgent, // 配置中使用 enable_thinking: true
    messages: [...]
});

// 推理和响应都会在流中正确输出
for await (const chunk of result.fullStream) {
    if (chunk.type === 'reasoning-delta') {
        // 处理推理内容
    } else if (chunk.type === 'text-delta') {
        // 处理响应内容
    }
}
```

## 各模型对比

| 模型 | 推荐配置 | 推理格式 | 转换器支持 | 推理质量 |
|------|---------|---------|-----------|---------|
| DeepSeek V3 | `enable_thinking: true` | 原生 reasoning chunks | ✅ 完美 | ⭐⭐⭐⭐⭐ |
| MiniMax M2.5 | `enable_thinking: true` | `<think>` 标签 | ✅ 完美 | ⭐⭐⭐⭐ |
| Kimi K2.5 | `enable_thinking: true` | 待测试 | ⚠️ 需测试 | ⭐⭐⭐⭐ |
| GLM-5 | - | 不支持 | N/A | N/A |

## 工具调用 (Tools)

所有模型的工具调用都使用统一的格式:
```typescript
// 配置工具
const result = await streamTextWrapper({
    agent: yourAgent,
    messages: [...],
    tools: {
        weather: {
            description: '获取天气信息',
            parameters: z.object({
                location: z.string()
            }),
            execute: async ({ location }) => {
                return `${location}的天气是晴天`;
            }
        }
    }
});

// 处理工具调用
for await (const chunk of result.fullStream) {
    if (chunk.type === 'tool-call-start') {
        console.log(`调用工具: ${chunk.toolName}`);
    } else if (chunk.type === 'tool-result') {
        console.log(`工具结果: ${chunk.result}`);
    }
}
```

## MCP (Model Context Protocol)

MCP 调用的统一处理正在开发中。将遵循类似的模式:
```typescript
// 未来的 API (示例)
const result = await streamTextWrapper({
    agent: yourAgent,
    messages: [...],
    mcp: {
        // MCP 配置
    }
});

for await (const chunk of result.fullStream) {
    if (chunk.type === 'mcp-call-start') {
        // 处理 MCP 调用
    }
}
```

## 最佳实践

1. **统一配置**: 所有支持推理的模型都使用 `enable_thinking: true`
2. **使用转换器**: 总是通过 `streamTextWrapper` 而不是直接调用 `streamText`
3. **标准化处理**: 使用统一的 chunk 类型处理逻辑
4. **错误处理**: 始终处理 `error` chunk
5. **测试新模型**: 添加新模型时，先测试其输出格式

## 故障排查

### 推理内容不显示
- ✅ 检查配置中是否有 `enable_thinking: true`
- ✅ 检查是否使用了 `streamTextWrapper` (带转换器)
- ✅ 检查是否正确处理了 `reasoning-delta` chunks

### 推理内容格式错误
- ✅ 检查模型是否使用了不同的推理格式
- ✅ 在 `stream-transformer.ts` 中添加新的格式支持

### 工具调用不工作
- ✅ 检查工具定义是否正确
- ✅ 检查模型是否支持工具调用
- ✅ 查看 `tool-call-*` chunks 是否被正确发出

## 示例代码

查看完整示例:
- `test/stream.ts` - 基础彩色输出示例
- `test/stream-comprehensive.ts` - 完整功能示例
- `README-STREAM-TRANSFORMER.md` - 技术文档
