import { streamTextWrapper } from "@/session/stream-text-wrapper";
import { loadAndGetAgent } from "@/agent/agent.js";

/**
 * 完整示例：展示如何处理统一的流输出
 * 支持：推理、响应、工具调用、错误处理
 */
async function comprehensiveExample() {
    const agent = loadAndGetAgent().agent2!;

    const result = await streamTextWrapper({
        agent,
        messages: [
            {
                role: 'user',
                content: '请介绍一下你自己，并说明你的主要功能'
            }
        ]
    });

    const { fullStream } = result;

    console.log("🚀 === 统一流处理示例 ===\n");

    // 状态追踪
    let currentToolCall: any = null;
    let reasoningContent = '';
    let responseContent = '';

    for await (const chunk of fullStream) {
        switch (chunk.type) {
            // === 推理相关 ===
            case 'reasoning-start':
                console.log('\x1b[36m💭 [开始推理]\x1b[0m');
                reasoningContent = '';
                break;
            
            case 'reasoning-delta':
                if (chunk.text) {
                    process.stdout.write('\x1b[36m' + chunk.text + '\x1b[0m');
                    reasoningContent += chunk.text;
                }
                break;
            
            case 'reasoning-end':
                console.log('\n\x1b[36m💭 [推理完成]\x1b[0m\n');
                break;

            // === 文本响应相关 ===
            case 'text-start':
                console.log('\x1b[32m📝 [开始响应]\x1b[0m');
                break;
            
            case 'text-delta':
                if (chunk.text) {
                    process.stdout.write(chunk.text);
                    responseContent += chunk.text;
                }
                break;
            
            case 'text-end':
                console.log('\n\x1b[32m📝 [响应完成]\x1b[0m\n');
                break;

            // === 工具调用相关 ===
            case 'tool-call-start':
                currentToolCall = {
                    id: chunk.toolCallId,
                    name: chunk.toolName,
                    args: ''
                };
                console.log(`\n\x1b[33m🔧 [调用工具: ${chunk.toolName}]\x1b[0m`);
                break;
            
            case 'tool-call-delta':
                if (chunk.argsTextDelta && currentToolCall) {
                    currentToolCall.args += chunk.argsTextDelta;
                }
                break;
            
            case 'tool-call-end':
                if (currentToolCall) {
                    console.log(`\x1b[33m   参数: ${currentToolCall.args}\x1b[0m`);
                    currentToolCall = null;
                }
                break;
            
            case 'tool-result':
                console.log(`\x1b[33m✅ [工具结果]\x1b[0m`);
                if (chunk.result) {
                    console.log(`\x1b[33m   ${JSON.stringify(chunk.result, null, 2)}\x1b[0m`);
                }
                break;

            // === 步骤和完成 ===
            case 'start':
                console.log('⚡ 流开始');
                break;
            
            case 'start-step':
                console.log(`📍 步骤开始 (请求 ID: ${chunk.request?.body?.model || 'unknown'})`);
                if (chunk.warnings && chunk.warnings.length > 0) {
                    console.log(`⚠️  警告: ${chunk.warnings.join(', ')}`);
                }
                break;
            
            case 'finish-step':
                console.log(`\n✓ 步骤完成 (原因: ${chunk.finishReason})`);
                if (chunk.usage) {
                    console.log(`📊 Token 使用:`);
                    console.log(`   输入: ${chunk.usage.inputTokens}`);
                    console.log(`   输出: ${chunk.usage.outputTokens}`);
                    console.log(`   推理: ${chunk.usage.reasoningTokens || 0}`);
                    console.log(`   总计: ${chunk.usage.totalTokens}`);
                }
                break;
            
            case 'finish':
                console.log(`\n🏁 流结束 (原因: ${chunk.finishReason})`);
                if (chunk.totalUsage) {
                    console.log(`📊 总计 Token 使用:`);
                    console.log(`   输入: ${chunk.totalUsage.inputTokens}`);
                    console.log(`   输出: ${chunk.totalUsage.outputTokens}`);
                    console.log(`   推理: ${chunk.totalUsage.reasoningTokens || 0}`);
                    console.log(`   总计: ${chunk.totalUsage.totalTokens}`);
                }
                break;

            // === 错误处理 ===
            case 'error':
                console.error(`\n❌ 错误: ${chunk.error}`);
                break;

            default:
                // 其他未处理的 chunk 类型
                break;
        }
    }

    // === 访问完整内容 ===
    console.log('\n' + '='.repeat(60));
    console.log('📋 摘要');
    console.log('='.repeat(60));

    const finishReason = await result.finishReason;
    console.log(`完成原因: ${finishReason}`);

    const warnings = await result.warnings;
    if (warnings && warnings.length > 0) {
        console.log(`警告: ${warnings.join(', ')}`);
    }

    // 获取完整推理内容（如果可用）
    const fullReasoning = await result.reasoning;
    if (fullReasoning && fullReasoning.length > 0) {
        console.log('\n📝 完整推理内容:');
        for (const r of fullReasoning) {
            if (r.type === 'reasoning' && r.text) {
                console.log(r.text);
            }
        }
    }

    // 统计信息
    console.log('\n📈 内容统计:');
    console.log(`   推理字符数: ${reasoningContent.length}`);
    console.log(`   响应字符数: ${responseContent.length}`);
}

/**
 * 简单示例：最小化的使用方式
 */
async function simpleExample() {
    const agent = loadAndGetAgent().agent2!;

    const result = await streamTextWrapper({
        agent,
        messages: [{ role: 'user', content: '你好' }]
    });

    console.log("💬 简单对话示例\n");

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

// 运行示例
const mode = process.argv[2] || 'comprehensive';

if (mode === 'simple') {
    simpleExample().catch(console.error);
} else {
    comprehensiveExample().catch(console.error);
}
