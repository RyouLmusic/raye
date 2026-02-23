# Web Search Tool 快速开始

## 5 分钟上手指南

### 1. 环境配置

创建 `.env` 文件：

```bash
# 必需
OPENAI_API_KEY=your_openai_key

# 可选（推荐）- 获得更好的搜索结果
TAVILY_API_KEY=your_tavily_key
```

### 2. 基础使用

```typescript
import { createAgent } from "@/agent/agent.js";
import { createProvider } from "@/provider/provider.js";

// 创建 provider
const provider = createProvider({
    apiKey: process.env.OPENAI_API_KEY || "",
});

// 创建 agent，启用 web_search 工具
const agent = createAgent({
    model: provider("gpt-4o-mini"),
    system: "You are a helpful assistant with web search capabilities.",
    tools: ["web_search"], // 👈 关键：启用搜索工具
    maxSteps: 5,
});

// 使用 agent
const result = await agent.run({
    prompt: "Search for the latest TypeScript features",
});

console.log(result.text);
```

### 3. 运行示例

```bash
# 运行测试
bun run packges/core/test/web-search.test.ts

# 运行示例
bun run packges/core/examples/web-search-example.ts
```

## 常见用例

### 搜索最新信息

```typescript
await agent.run({
    prompt: "What's new in React 19?",
});
```

### 查找文档

```typescript
await agent.run({
    prompt: "Find documentation about Bun.js",
});
```

### 研究对比

```typescript
await agent.run({
    prompt: "Compare Vue 3 and React 18",
});
```

## 工具如何工作

1. Agent 接收用户提示
2. Agent 决定是否需要使用 `web_search` 工具
3. 工具执行搜索（Tavily 或 DuckDuckGo）
4. 返回结构化的搜索结果
5. Agent 基于搜索结果生成回答

## 搜索引擎选择

### Tavily（推荐）
- ✅ 高质量结果
- ✅ 专为 AI 优化
- ✅ 包含发布日期
- ❌ 需要 API Key

### DuckDuckGo（备用）
- ✅ 无需 API Key
- ✅ 自动回退
- ❌ 结果质量较低
- ❌ 功能有限

## 下一步

- 📖 阅读完整文档：[WEB-SEARCH-TOOL.md](./WEB-SEARCH-TOOL.md)
- 🔧 查看高级配置和最佳实践
- 🚀 集成到你的应用中

## 故障排除

### 问题：搜索无结果

检查：
1. 网络连接是否正常
2. API Key 是否正确配置
3. 查询是否足够具体

### 问题：Tavily API 错误

解决：
- 工具会自动回退到 DuckDuckGo
- 或配置正确的 `TAVILY_API_KEY`

## 获取帮助

- 查看 [完整文档](./WEB-SEARCH-TOOL.md)
- 查看 [示例代码](../examples/web-search-example.ts)
- 查看 [测试文件](../test/web-search.test.ts)
