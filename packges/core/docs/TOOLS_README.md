# 工具使用指南 (Tools Guide)

## 概述

本目录包含 AI 代理可以使用的工具定义。工具使用 AI SDK 的 `tool()` 函数创建。

## 推荐使用方式 ⭐

**在 `agent.json` 中配置工具**（推荐），而不是每次调用时传入。

### 为什么在配置中定义工具更好？

1. ✅ **符合 Agent 设计理念**：工具是 Agent 能力的一部分
2. ✅ **配置集中管理**：清晰了解每个 Agent 的能力
3. ✅ **减少重复代码**：不需要每次调用时手动传入
4. ✅ **类型安全**：可以为每个 Agent 推断工具类型

## 快速开始

### 1. 在配置文件中定义 Agent 的工具

编辑 `packges/core/src/agent/agent.json`：

```json
{
    "name": "agent",
    "model": "deepseek-ai/DeepSeek-V3.2",
    "provider": "DeepSeek",
    "tools": ["calculate"],  // ← 在这里定义工具（类型安全）
    "extra_body": {
        "enable_thinking": true
    }
}
```

**✨ 类型安全**：TypeScript 会验证工具名称是否存在于注册表中！

### 2. 使用时自动加载工具

```typescript
import { streamTextWrapper } from "@/session/stream-text-wrapper.js";
import { loadAndGetRecord } from "@/agent/config.js";

const agent = loadAndGetRecord().agent!;

const result = await streamTextWrapper({
    agent,
    messages: [
        { role: 'user', content: '帮我计算 123 + 456' }
    ]
    // 工具会自动从 agent.tools 加载，无需手动传入
});
```

### 3. 可选：临时覆盖工具

如果需要临时使用不同的工具集：

```typescript
import { calculate } from "@/tools/index.js";

const result = await streamTextWrapper({
    agent,
    messages: [...],
    tools: { calculate }  // 覆盖配置中的工具
});
```

## 可用工具

### 1. Calculate Tool (计算工具)

执行基本的数学运算。

**注册名称**: `"calculate"`  
**文件**: `caculate.ts`

**功能**:
- 加法 (add)
- 减法 (subtract)
- 乘法 (multiply)
- 除法 (divide)

**在配置中使用**:
```json
{
    "tools": ["calculate"]
}
```

## 如何创建新工具

### 第1步：创建工具文件

在 `packges/core/src/tools/` 目录下创建新的 `.ts` 文件：

```typescript
// packges/core/src/tools/weather.ts
import { tool } from "ai";
import { z } from "zod";

export const weather = tool({
    description: 'Get the current weather for a location',
    inputSchema: z.object({
        location: z.string().describe('City name'),
    }),
    execute: async ({ location }) => {
        // 实际应该调用天气 API
        const temperature = Math.round(Math.random() * 30 + 10);
        
        return {
            location,
            temperature,
            condition: 'sunny'
        };
    }
});
```

### 第2步：注册工具

在 `index.ts` 中注册新工具：

```typescript
// packges/core/src/tools/index.ts
import { calculate } from "./caculate.js";
import { weather } from "./weather.js";  // ← 导入新工具

export const toolRegistry = {
    calculate,
    weather,  // ← 注册新工具
} as const;

// ...其他代码

export { calculate, weather };  // ← 导出新工具
```

### 第3步：在配置中使用

```json
{
    "name": "weather-agent",
    "tools": ["weather", "calculate"]
}
```

就这么简单！✨

## 工具注册表

所有工具必须在 `index.ts` 的 `toolRegistry` 中注册才能通过配置使用。

**当前已注册的工具**：
- `calculate` - 数学计算

**注册表的作用**：
- 提供从工具名称到工具实现的映射
- **类型安全**：TypeScript 会检查工具名称是否存在
- 集中管理：所有工具在一个地方注册

## 类型安全特性 ✨

配置中的工具名称是**类型安全**的！TypeScript 会在编译时检查：

```typescript
import type { AgentConfig } from "@/agent/type.js";

// ✅ 正确：使用已注册的工具
const config: AgentConfig = {
    // ...
    tools: ["calculate"]  // ✅ TypeScript 知道这是有效的
};

// ❌ 错误：使用未注册的工具
const badConfig: AgentConfig = {
    // ...
    tools: ["nonexistent"]  // ❌ TypeScript 错误！
};
```

**优势**：
- IDE 自动补全工具名称
- 编译时就能发现配置错误
- 重构工具时自动更新所有引用

**运行时验证**：
除了类型检查，系统还会在加载配置时验证工具名称：

```typescript
// 启动时会输出警告
[Agent: myAgent] Invalid tool name "xyz". This tool is not registered.
```

查看 `test/type-safety-demo.ts` 了解更多示例。

## 两种使用模式对比

### 模式1：配置驱动（推荐 ⭐）

```json
// agent.json
{
    "tools": ["calculate", "weather"]
}
```

```typescript
// 使用时
streamTextWrapper({
    agent,
    messages: [...]
    // ✅ 工具自动加载
})
```

**适用场景**：
- Agent 有固定的工具集
- 多次使用同一组工具
- 需要配置管理和版本控制

### 模式2：运行时传入

```typescript
import { calculate, weather } from "@/tools/index.js";

streamTextWrapper({
    agent,
    messages: [...],
    tools: { calculate, weather }  // 手动传入
})
```

**适用场景**：
- 临时需要不同的工具
- 测试或调试
- 动态工具选择

## 工具调用流程

当使用工具时，流式输出会包含以下 chunk 类型：

1. **`tool-call`**: 工具被调用
   - `chunk.toolName`: 工具名称
   - `chunk.input`: 工具输入参数

2. **`tool-result`**: 工具执行完成
   - `chunk.toolName`: 工具名称
   - `chunk.output`: 工具输出结果

3. **`tool-error`**: 工具执行错误
   - `chunk.error`: 错误信息

## 示例代码

查看 `test/calculate-tool.test.ts` 获取完整的使用示例。

## 最佳实践

1. **清晰的描述**: 为工具和参数提供清晰的描述，帮助 AI 理解何时使用
2. **类型安全**: 使用 Zod schema 定义输入参数，确保类型安全
3. **错误处理**: 在 execute 函数中处理可能的错误情况
4. **返回有用信息**: 返回的对象应包含执行结果和相关上下文信息
5. **异步执行**: execute 函数应该是 async，以支持异步操作

## 工具命名约定

- 使用 camelCase 命名导出的工具常量
- 工具名称应该清晰描述其功能
- 文件名使用 kebab-case

例如：
- 文件: `weather-api.ts`
- 导出: `export const weatherApi = tool({...})`
- 使用: `tools: { weather: weatherApi }`
