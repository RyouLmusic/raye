/**
 * 网页搜索工具测试
 */
import { createAgent } from "@/agent/agent.js";
import { createProvider } from "@/provider/provider.js";

async function testWebSearch() {
    console.log("=== Web Search Tool Test ===\n");

    // 创建 provider
    const provider = createProvider({
        apiKey: process.env.OPENAI_API_KEY || "",
        baseURL: process.env.OPENAI_BASE_URL,
    });

    // 创建 agent，包含 web_search 工具
    const agent = createAgent({
        model: provider("gpt-4o-mini"),
        system: "You are a helpful assistant with web search capabilities. When asked questions, use the web_search tool to find current information.",
        tools: ["web_search"],
        maxSteps: 5,
    });

    try {
        console.log("Test 1: Search for AI news\n");
        const result1 = await agent.run({
            prompt: "Search for the latest news about artificial intelligence",
        });
        console.log("Response:", result1.text);
        console.log("\n" + "=".repeat(50) + "\n");

        console.log("Test 2: Search for programming documentation\n");
        const result2 = await agent.run({
            prompt: "Find documentation about TypeScript decorators",
        });
        console.log("Response:", result2.text);
        console.log("\n" + "=".repeat(50) + "\n");

        console.log("Test 3: Search with specific query\n");
        const result3 = await agent.run({
            prompt: "What are the best practices for React hooks in 2024?",
        });
        console.log("Response:", result3.text);

    } catch (error) {
        console.error("Test failed:", error);
    }
}

// 运行测试
testWebSearch();
