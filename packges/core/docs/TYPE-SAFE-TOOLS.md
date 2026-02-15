# 类型安全的工具配置

## 更新概要

已将 `AgentConfig.tools` 从 `any[]` 升级为类型安全的 `ToolName[]`。

## 技术实现

### 1. 工具名称类型定义

```typescript
// src/tools/index.ts
export const toolRegistry = {
    calculate,
    // 更多工具...
} as const;

export type ToolName = keyof typeof toolRegistry;  // "calculate" | "weather" | ...
```

### 2. Agent 配置类型增强

```typescript
// src/agent/type.ts
import type { ToolName } from "@/tools/index.js";

// Zod schema（用于解析 JSON）
export const agentConfig = z.object({
    // ...
    tools: z.array(z.string()).default([]),
});

// TypeScript 类型（类型安全）
export type AgentConfig = Omit<BaseAgentConfig, 'tools'> & {
    tools: ToolName[];  // 精确的工具名称类型
};
```

### 3. 运行时验证

```typescript
// src/agent/config.ts
export function loadAndGetRecord() {
    const agents = agentConfigList.parse(configData);
    
    // 验证工具名称
    for (const agent of agents) {
        for (const toolName of agent.tools) {
            if (!isValidToolName(toolName)) {
                console.error(`Invalid tool name "${toolName}"`);
            }
        }
    }
    
    return agents;
}
```

## 优势

### 编译时检查 ✅

```typescript
const config: AgentConfig = {
    // ...
    tools: ["calculate"]  // ✅ OK
};

const badConfig: AgentConfig = {
    // ...
    tools: ["nonexistent"]  // ❌ TypeScript 错误！
};
```

### IDE 智能提示

输入 `tools: [` 时，IDE 会自动提示所有可用的工具名称。

### 重构安全

重命名工具时，TypeScript 会自动提示所有需要更新的地方。

### 运行时验证

即使类型检查通过，系统仍会在启动时验证配置：

```
[Agent: myAgent] Invalid tool name "xyz". This tool is not registered.
Tool available: calculate
```

## 使用示例

### 配置文件

```json
{
    "name": "math-agent",
    "tools": ["calculate"]  // TypeScript 知道这是有效的
}
```

### 代码中使用

```typescript
import { streamTextWrapper } from "@/session/stream-text-wrapper.js";

const agent = loadAndGetRecord().agent!;  // agent.tools 的类型是 ToolName[]

// 工具会自动加载，类型安全
const result = await streamTextWrapper({
    agent,
    messages: [...]
});
```

## 测试

```bash
# 运行类型安全演示
cd packges/core/test
bun type-safety-demo.ts

# 运行工具使用示例
bun tool-usage-examples.ts configured
```

## 迁移指南

现有代码**无需修改**，因为：

1. JSON 配置保持不变（仍然是字符串数组）
2. 运行时行为完全相同
3. 只是增加了编译时的类型检查

添加新工具时：

1. 创建工具文件 - `src/tools/my-tool.ts`
2. 注册工具 - 在 `src/tools/index.ts` 的 `toolRegistry` 中添加
3. 配置使用 - 在 `agent.json` 中添加工具名称

TypeScript 会自动识别新工具并提供类型检查！

## 相关文件

- `src/agent/type.ts` - Agent 配置类型定义
- `src/tools/index.ts` - 工具注册表和类型
- `src/agent/config.ts` - 配置加载和验证
- `test/type-safety-demo.ts` - 类型安全演示
- `docs/TOOL-CONFIGURATION-COMPARISON.md` - 配置方案对比
