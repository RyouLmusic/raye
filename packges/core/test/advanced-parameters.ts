import { streamTextWrapper } from "@/session/stream-text-wrapper";
import { loadAndGetAgent } from "@/agent/agent.js";

/**
 * 示例：使用高级参数控制 AI 行为
 * 展示如何使用 system、temperature、maxOutputTokens 等参数
 */
async function advancedParametersExample() {
    console.log("=== 高级参数示例 ===\n");
    
    const agent = loadAndGetAgent().agent!;

    const result = await streamTextWrapper({
        agent,
        
        // 消息列表
        messages: [
            {
                role: 'user',
                content: '请用诗意的语言描述春天'
            }
        ],
        
        // 系统消息 - 设置 AI 的角色和行为
        system: "你是一位充满诗意的作家，擅长用优美的文字描述自然景色。",
        
        // 温度 - 更高的值让输出更有创意
        temperature: 0.9,
        
        // 最大输出令牌数 - 限制响应长度
        maxOutputTokens: 500,
        
        // 最大重试次数
        maxRetries: 3,
        
        // 超时设置 (30秒)
        timeout: 30000,
        
        // 完成回调 - 记录使用情况
        onFinish: async ({ text, usage, finishReason }) => {
            console.log("\n\n=== 完成信息 ===");
            console.log("完成原因:", finishReason);
            console.log("使用令牌:", {
                输入: usage.promptTokens,
                输出: usage.completionTokens,
                总计: usage.totalTokens
            });
        },
        
        // 错误回调
        onError: async (error) => {
            console.error("\n❌ 发生错误:", error);
        }
    });

    console.log("📝 AI 回复:\n");
    
    for await (const chunk of result.fullStream) {
        if (chunk.type === 'reasoning-delta' && chunk.text) {
            process.stdout.write('\x1b[36m' + chunk.text + '\x1b[0m');
        } else if (chunk.type === 'text-delta' && chunk.text) {
            process.stdout.write(chunk.text);
        } else if (chunk.type === 'reasoning-end') {
            process.stdout.write('\n\n');
        }
    }
    
    console.log('\n');
}

/**
 * 示例：使用 AbortSignal 取消请求
 */
async function abortSignalExample() {
    console.log("=== AbortSignal 示例 ===\n");
    
    const agent = loadAndGetAgent().agent!;
    const controller = new AbortController();
    
    // 3秒后自动取消
    setTimeout(() => {
        console.log("\n⏰ 3秒已到，取消请求...");
        controller.abort();
    }, 3000);

    try {
        const result = await streamTextWrapper({
            agent,
            messages: [
                {
                    role: 'user',
                    content: '请详细介绍一下人工智能的发展历史和未来趋势'
                }
            ],
            
            // 传入 abort signal
            abortSignal: controller.signal,
            
            onFinish: async () => {
                console.log("\n✅ 请求成功完成");
            }
        });

        console.log("📝 AI 回复:\n");
        
        for await (const chunk of result.fullStream) {
            if (chunk.type === 'text-delta' && chunk.text) {
                process.stdout.write(chunk.text);
            }
        }
    } catch (error: any) {
        if (error.name === 'AbortError') {
            console.log("\n⚠️  请求已被取消");
        } else {
            console.error("\n❌ 错误:", error);
        }
    }
    
    console.log('\n');
}

/**
 * 示例：使用不同的 temperature 对比输出
 */
async function temperatureComparisonExample() {
    console.log("=== Temperature 对比示例 ===\n");
    
    const agent = loadAndGetAgent().agent!;
    const prompt = "请用一句话描述猫";
    
    const temperatures = [0.2, 0.7, 1.2];
    
    for (const temp of temperatures) {
        console.log(`\n🌡️  Temperature = ${temp}:`);
        
        const result = await streamTextWrapper({
            agent,
            messages: [{ role: 'user', content: prompt }],
            temperature: temp,
            maxOutputTokens: 100
        });
        
        let text = '';
        for await (const chunk of result.fullStream) {
            if (chunk.type === 'text-delta' && chunk.text) {
                text += chunk.text;
                process.stdout.write(chunk.text);
            }
        }
        console.log();
    }
    
    console.log("\n💡 提示：");
    console.log("  - 低 temperature (0.2) 更确定、更一致");
    console.log("  - 中 temperature (0.7) 平衡创意和确定性");
    console.log("  - 高 temperature (1.2) 更有创意、更多样化\n");
}

// 根据命令行参数运行不同示例
const mode = process.argv[2] || 'advanced';

if (mode === 'abort') {
    abortSignalExample().catch(console.error);
} else if (mode === 'temperature') {
    temperatureComparisonExample().catch(console.error);
} else {
    advancedParametersExample().catch(console.error);
}
