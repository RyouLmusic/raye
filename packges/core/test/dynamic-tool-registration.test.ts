/**
 * 动态工具注册示例
 * 演示如何在运行时注册和管理工具
 */
import { tool } from "ai";
import { z } from "zod";
import {
    registerTool,
    registerTools,
    unregisterTool,
    getRegisteredToolNames,
    getToolRegistryStats,
    toolRegistry
} from "@/tools/tools-register.ts";

// ============================================
// 示例1: 注册单个工具
// ============================================

console.log("=== 示例1: 动态注册单个工具 ===\n");

// 创建一个新的天气工具
const weatherTool = tool({
    description: 'Get the current weather for a location',
    inputSchema: z.object({
        location: z.string().describe('City name'),
    }),
    execute: async ({ location }) => {
        const temperature = Math.round(Math.random() * 30 + 10);
        return {
            location,
            temperature,
            condition: 'sunny',
            humidity: 60
        };
    }
});

// 动态注册
registerTool("weather", weatherTool);

console.log("已注册的工具:", getRegisteredToolNames());
console.log();

// ============================================
// 示例2: 批量注册工具
// ============================================

console.log("=== 示例2: 批量注册多个工具 ===\n");

const searchTool = tool({
    description: 'Search for information on the internet',
    inputSchema: z.object({
        query: z.string().describe('Search query'),
        maxResults: z.number().default(5).describe('Maximum number of results')
    }),
    execute: async ({ query, maxResults }) => {
        return {
            query,
            results: [
                { title: `Result 1 for ${query}`, url: 'https://example.com/1' },
                { title: `Result 2 for ${query}`, url: 'https://example.com/2' }
            ].slice(0, maxResults)
        };
    }
});

const translatorTool = tool({
    description: 'Translate text to another language',
    inputSchema: z.object({
        text: z.string().describe('Text to translate'),
        targetLanguage: z.string().describe('Target language code (e.g., en, zh, es)')
    }),
    execute: async ({ text, targetLanguage }) => {
        return {
            original: text,
            translated: `[Translated to ${targetLanguage}]: ${text}`,
            targetLanguage
        };
    }
});

// 批量注册
registerTools({
    search: searchTool,
    translator: translatorTool
});

console.log("批量注册后的工具:", getRegisteredToolNames());
console.log();

// ============================================
// 示例3: 查看注册表统计信息
// ============================================

console.log("=== 示例3: 注册表统计信息 ===\n");

const stats = getToolRegistryStats();
console.log("统计信息:", JSON.stringify(stats, null, 2));
console.log();

// ============================================
// 示例4: 取消注册工具
// ============================================

console.log("=== 示例4: 取消注册工具 ===\n");

console.log("取消注册 'search' 工具...");
unregisterTool("search");

console.log("取消注册后的工具:", getRegisteredToolNames());
console.log();

// ============================================
// 示例5: 在 Agent 中使用动态注册的工具
// ============================================

console.log("=== 示例5: 在 Agent 中使用 ===\n");

import { streamTextWrapper } from "@/session/stream-text-wrapper.js";
import { loadAndGetAgent } from "@/agent/agent.js";

async function useWithAgent() {
    const agent = loadAndGetAgent().agent!;

    // 先注册一个临时工具
    const timeTool = tool({
        description: 'Get the current time',
        inputSchema: z.object({
            timezone: z.string().optional().describe('Timezone (optional)')
        }),
        execute: async ({ timezone }) => {
            const now = new Date();
            return {
                time: now.toISOString(),
                timezone: timezone || 'UTC',
                timestamp: now.getTime()
            };
        }
    });
    
    registerTool("getTime", timeTool);
    
    console.log("动态工具使用示例：");
    console.log("可用工具:", getRegisteredToolNames());
    
    // 方式1: 更新 agent.json 配置中添加 "getTime"
    // 方式2: 直接在调用时传入工具
    const result = await streamTextWrapper({
        agent,
        messages: [
            { role: 'user', content: '现在几点了？' }
        ],
        tools: toolRegistry.getByNames(["calculate", "getTime"])
    });

    console.log("\n工具调用结果:");
    for await (const chunk of result.fullStream) {
        if (chunk.type === 'tool-call' && chunk.toolName === 'getTime') {
            console.log(`✓ 调用了动态注册的工具: ${chunk.toolName}`);
        } else if (chunk.type === 'tool-result') {
            console.log(`✓ 工具结果:`, chunk.output);
        }
    }
    
    // 用完后可以取消注册
    unregisterTool("getTime");
}

// 取消注释以测试 Agent 集成
// await useWithAgent();

// ============================================
// 示例6: 工具注册表锁定（生产环境推荐）
// ============================================

console.log("=== 示例6: 锁定注册表 ===\n");

console.log("注册表当前状态:", getToolRegistryStats().isLocked ? "已锁定" : "未锁定");

// 锁定注册表（防止运行时意外修改）
// toolRegistry.lock();

console.log("锁定后，尝试注册新工具会抛出错误");
// try {
//     registerTool("forbidden", weatherTool);  // 会抛出错误
// } catch (error) {
//     console.error("错误:", error.message);
// }

// ============================================
// 示例7: 重置注册表
// ============================================

console.log("\n=== 示例7: 重置注册表 ===\n");

console.log("重置前的工具:", getRegisteredToolNames());
toolRegistry.reset();
console.log("重置后的工具:", getRegisteredToolNames());

console.log("\n✓ 动态工具注册演示完成！");
