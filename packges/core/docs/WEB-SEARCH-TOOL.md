# Web Search Tool 使用指南

## 概述

`web_search` 工具为 AI Agent 提供网页搜索能力，可以搜索互联网上的最新信息、文档和资源。

## 特性

- 🔍 支持多种搜索引擎（Tavily、DuckDuckGo）
- 🔄 自动回退机制（Tavily 失败时使用 DuckDuckGo）
- 📊 返回结构化的搜索结果（标题、URL、摘要）
- ⚡ 可配置最大结果数量
- 🛡️ 错误处理和日志记录

## 安装配置

### 1. 环境变量配置

推荐使用 Tavily API（需要 API key）：

```bash
# .env 文件
TAVILY_API_KEY=your_tavily_api_key_here
```

获取 Tavily API Key：
1. 访问 [Tavily](https://tavily.com/)
2. 注册账号
3. 获取 API Key

如果不配置 `TAVILY_API_KEY`，工具会自动使用 DuckDuckGo（无需 API key，但结果质量可能较低）。

### 2. 工具注册

工具已自动注册到工具注册表中，无需手动注册。

## 使用方法

### 基础用法

```typescript
import { createAgent } from "@/agent/agent.js";
import { createProvider } from "@/provider/provider.js";

const provider = createProvider({
    apiKey: process.env.OPENAI_API_KEY || "",
});

const agent = createAgent({
    model: provider("gpt-4o-mini"),
    system: "You are a helpful assistant with web search capabilities.",
    tools: ["web_search"], // 启用 web_search 工具
    maxSteps: 5,
});

const result = await agent.run({
    prompt: "Search for the latest news about AI",
});

console.log(result.text);
```

### 工具参数

```typescript
{
    query: string;        // 搜索查询字符串（必需）
    maxResults?: number;  // 最大结果数量（可选，默认 5，最大 10）
}
```

### 返回格式

```typescript
{
    success: boolean;     // 搜索是否成功
    message: string;      // 状态消息
    query: string;        // 原始查询
    results: Array<{
        title: string;         // 页面标题
        url: string;           // 页面 URL
        snippet: string;       // 内容摘要
        publishedDate?: string; // 发布日期（如果可用）
    }>;
}
```

## 使用示例

### 示例 1：搜索最新新闻

```typescript
const agent = createAgent({
    model: provider("gpt-4o-mini"),
    tools: ["web_search"],
});

await agent.run({
    prompt: "What are the latest developments in quantum computing?",
});
```

### 示例 2：查找技术文档

```typescript
await agent.run({
    prompt: "Find documentation about React Server Components",
});
```

### 示例 3：限制结果数量

```typescript
await agent.run({
    prompt: "Search for TypeScript best practices, show me top 3 results",
});
```

### 示例 4：在对话中使用

```typescript
const session = createSession({
    agent,
    initialMessages: [],
});

// 第一轮对话
await session.sendMessage("Search for information about Next.js 14");

// 第二轮对话（基于搜索结果）
await session.sendMessage("Can you summarize the key features from those results?");
```

## 最佳实践

### 1. 明确的搜索查询

❌ 不好的查询：
```typescript
"AI"
"programming"
```

✅ 好的查询：
```typescript
"latest artificial intelligence breakthroughs 2024"
"TypeScript async/await best practices"
```

### 2. 合理设置结果数量

```typescript
// 快速概览
maxResults: 3

// 深入研究
maxResults: 10
```

### 3. 结合其他工具使用

```typescript
const agent = createAgent({
    tools: ["web_search", "calculate", "finish_task"],
    // ...
});

// Agent 可以先搜索信息，然后进行计算或完成任务
```

### 4. 错误处理

```typescript
try {
    const result = await agent.run({
        prompt: "Search for...",
    });
    
    if (!result.success) {
        console.error("Search failed:", result.message);
    }
} catch (error) {
    console.error("Agent error:", error);
}
```

## 故障排除

### 问题 1：Tavily API 错误

**错误信息**：`TAVILY_API_KEY environment variable is not set`

**解决方案**：
1. 确保 `.env` 文件中设置了 `TAVILY_API_KEY`
2. 或者让工具自动回退到 DuckDuckGo（无需配置）

### 问题 2：搜索无结果

**可能原因**：
- 查询过于模糊
- 搜索引擎限制
- 网络连接问题

**解决方案**：
- 使用更具体的查询词
- 检查网络连接
- 查看控制台日志了解详细错误

### 问题 3：DuckDuckGo 结果质量低

**解决方案**：
- 配置 Tavily API Key 以获得更好的结果
- 使用更精确的搜索查询

## 性能优化

### 1. 缓存搜索结果

```typescript
const searchCache = new Map<string, any>();

// 在工具执行前检查缓存
if (searchCache.has(query)) {
    return searchCache.get(query);
}

// 执行搜索并缓存结果
const result = await agent.run({ prompt: query });
searchCache.set(query, result);
```

### 2. 限制搜索频率

```typescript
// 使用防抖或节流
import { debounce } from "lodash";

const debouncedSearch = debounce(async (query) => {
    await agent.run({ prompt: query });
}, 1000);
```

## 扩展开发

### 添加新的搜索引擎

在 `search.ts` 中添加新的搜索函数：

```typescript
async function searchWithNewEngine(
    query: string, 
    maxResults: number
): Promise<SearchResponse> {
    // 实现新的搜索引擎逻辑
}

// 在 execute 中添加回退逻辑
try {
    searchResponse = await searchWithTavily(query, limitedMaxResults);
} catch {
    try {
        searchResponse = await searchWithNewEngine(query, limitedMaxResults);
    } catch {
        searchResponse = await searchWithDuckDuckGo(query, limitedMaxResults);
    }
}
```

## 相关资源

- [Tavily API 文档](https://docs.tavily.com/)
- [DuckDuckGo API](https://duckduckgo.com/api)
- [AI SDK 工具文档](https://sdk.vercel.ai/docs/ai-sdk-core/tools-and-tool-calling)

## 更新日志

### v1.0.0
- ✨ 初始版本
- 🔍 支持 Tavily 和 DuckDuckGo
- 🔄 自动回退机制
- 📊 结构化搜索结果
