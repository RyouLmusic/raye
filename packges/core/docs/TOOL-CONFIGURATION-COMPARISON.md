# 工具配置方案对比

## 问题
工具（Tools）应该在哪里配置？

## 两种方案

### 方案A：在 streamTextInput 中传入
```typescript
streamTextWrapper({
    agent: agentConfig,
    messages: [...],
    tools: { calculate }  // ❌ 每次调用都要传入
})
```

### 方案B：在 agentConfig 中配置（推荐 ⭐）
```json
// agent.json
{
    "name": "agent",
    "tools": ["calculate"]  // ✅ 在配置中定义
}
```

```typescript
streamTextWrapper({
    agent: agentConfig,
    messages: [...]
    // ✅ 工具自动加载
})
```

## 为什么选择方案B？

### 1. 符合 Agent 设计理念
Agent（代理）= 模型 + 指令 + 工具

工具是 Agent **能力**的一部分，应该和模型、指令一起配置，而不是每次调用时临时指定。

### 2. 配置即文档
看配置就知道每个 Agent 能做什么：

```json
{
    "name": "math-assistant",
    "model": "deepseek-ai/DeepSeek-V3.2",
    "tools": ["calculate", "plot"]  // 一目了然：这个助手能算数和画图
}
```

vs

```typescript
// 需要查看代码才知道用了什么工具
streamTextWrapper({ agent, tools: { calculate, plot } })
```

### 3. 减少重复代码
```typescript
// ❌ 方案A：每次都要传
await streamTextWrapper({ agent, tools: { calculate } })
await streamTextWrapper({ agent, tools: { calculate } })
await streamTextWrapper({ agent, tools: { calculate } })

// ✅ 方案B：配置一次，到处使用
await streamTextWrapper({ agent })
await streamTextWrapper({ agent })
await streamTextWrapper({ agent })
```

### 4. 类型安全
从配置推断工具类型，TypeScript 能检查工具是否存在。

### 5. 版本控制和回滚
配置文件在 Git 中，工具变更有历史记录，可以回滚。

## 最佳实践：两者结合

- **默认**：在 `agentConfig.tools` 中配置
- **可选**：支持 `streamTextInput.tools` 覆盖（用于测试或特殊场景）

```typescript
// 优先级：传入的 tools > agentConfig.tools

// 1. 使用配置中的工具
streamTextWrapper({ agent })  // 使用 agent.tools

// 2. 临时覆盖工具（测试、调试）
streamTextWrapper({ 
    agent, 
    tools: { testTool }  // 覆盖 agent.tools
})
```

## 实现概览

```typescript
// src/tools/index.ts - 工具注册表
export const toolRegistry = {
    calculate,
    weather,
    // ...
} as const;

export function getToolsByNames(names: string[]) {
    // 根据名称从注册表获取工具
}

// src/session/stream-text-wrapper.ts
export async function streamTextWrapper(input) {
    // 1. 优先使用传入的工具
    let tools = input.tools;
    
    // 2. 否则从 agentConfig.tools 加载
    if (!tools && input.agent.tools?.length > 0) {
        tools = getToolsByNames(input.agent.tools);
    }
    
    return streamText({ model, messages, tools });
}
```

## 运行示例

```bash
# 查看三种使用场景
cd packges/core/test
bun tool-usage-examples.ts all
```

## 结论

✅ **推荐在 `agentConfig` 中配置工具**

这样更符合 Agent 设计理念，配置清晰，代码简洁，同时保留了灵活性。
