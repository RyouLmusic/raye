import { streamTextWrapper } from "@/session/stream-text-wrapper";
import { loadAndGetAgent } from "@/agent/agent.js";
import { 
    processFullStream, 
    createConsoleHandlers, 
    createCollectorHandlers,
    type StreamHandlers 
} from "@/session/stream-handler";

/**
 * 示例 1: 使用预设的控制台处理器
 * 开箱即用的彩色控制台输出
 */
async function example1_ConsoleHandler() {
    console.log("=== 示例 1: 使用预设的控制台处理器 ===\n");
    
    const agentConfig = loadAndGetAgent().subAgent;
    
    if (!agentConfig) {
        console.error('❌ Agent 配置未找到！请检查 agent.json 文件');
        return;
    }

    console.log(`📡 使用 Agent: ${agentConfig.name} (${agentConfig.model})`);
    console.log(`⏱️  超时设置: ${agentConfig.timeout || 30000}ms\n`);

    const result = await streamTextWrapper({
        agent: agentConfig,
        messages: [
            {
                role: 'user',
                content: '计算565加44和计算244乘886的结果'
            }
        ],
        // 覆盖超时时间为 60 秒，避免超时
        timeout: 60000
    });

    // 使用预设的控制台处理器
    await processFullStream(result, {
        handlers: createConsoleHandlers({
            showReasoning: true,  // 显示推理过程
            showTools: true,      // 显示工具调用
            showSteps: true       // 显示步骤信息
        })
    });
}

/**
 * 示例 2: 自定义处理器
 * 完全自定义每种类型内容的处理方式
 */
async function example2_CustomHandlers() {
    console.log("\n\n=== 示例 2: 自定义处理器 ===\n");
    
    const agent = loadAndGetAgent().agent!;

    const result = await streamTextWrapper({
        agent,
        messages: [
            {
                role: 'user',
                content: '什么是机器学习？'
            }
        ],
        timeout: 60000
    });

    // 自定义处理器
    const customHandlers: StreamHandlers = {
        reasoning: {
            onStart: () => {
                console.log('\n🧠 AI 正在思考...\n');
                console.log('┌─────────────────────────────────┐');
            },
            onDelta: (text) => {
                // 添加边框效果
                const lines = text.split('\n');
                for (const line of lines) {
                    if (line.trim()) {
                        console.log(`│ ${line}`);
                    }
                }
            },
            onEnd: (fullText) => {
                console.log('└─────────────────────────────────┘');
                console.log(`\n思考了 ${fullText.length} 个字符\n`);
            }
        },
        text: {
            onStart: () => {
                console.log('\n💬 回复:\n');
            },
            onDelta: (text) => {
                // 实时打字效果
                process.stdout.write(text);
            },
            onEnd: (fullText) => {
                console.log(`\n\n[共 ${fullText.length} 字]`);
            }
        },
        tool: {
            onCall: (id, name, args) => {
                console.log(`\n⚙️  正在执行: ${name}`);
                console.log(`   参数:`, args);
            },
            onResult: (id, name, result) => {
                console.log(`✨ ${name} 完成:`, result);
            }
        },
        onError: (error) => {
            console.error('\n❌ 出错了:', error);
        },
        onFinish: (result) => {
            console.log('\n\n' + '='.repeat(50));
            console.log(`✅ 对话结束 (${result.finishReason})`);
            console.log('='.repeat(50));
        }
    };

    await processFullStream(result, {
        handlers: customHandlers
    });
}

/**
 * 示例 3: 收集器处理器
 * 收集所有内容而不立即显示，方便后续处理
 */
async function example3_CollectorHandler() {
    console.log("\n\n=== 示例 3: 收集器处理器 ===\n");
    
    const agent = loadAndGetAgent().agent!;

    const result = await streamTextWrapper({
        agent,
        messages: [
            {
                role: 'user',
                content: '解释一下神经网络的基本原理'
            }
        ],
        timeout: 60000
    });

    // 使用收集器
    const { handlers, getCollected } = createCollectorHandlers();

    console.log('📦 收集流式数据中...\n');
    
    await processFullStream(result, { handlers });

    // 获取收集的数据
    const collected = getCollected();

    console.log('✅ 收集完成！\n');
    console.log('📊 收集的数据:');
    console.log('─'.repeat(60));
    console.log(`推理内容长度: ${collected.reasoning.length} 字符`);
    console.log(`回复内容长度: ${collected.text.length} 字符`);
    console.log(`工具调用次数: ${collected.toolCalls.length}`);
    console.log(`处理步骤数: ${collected.steps}`);
    console.log('─'.repeat(60));

    if (collected.reasoning) {
        console.log('\n💭 推理内容预览:');
        console.log(collected.reasoning.substring(0, 200) + '...');
    }

    console.log('\n📝 回复内容:');
    console.log(collected.text);

    if (collected.toolCalls.length > 0) {
        console.log('\n🔧 工具调用详情:');
        collected.toolCalls.forEach((call, index) => {
            console.log(`\n  ${index + 1}. ${call.name}`);
            console.log(`     参数:`, call.args);
            console.log(`     结果:`, call.result);
        });
    }
}

/**
 * 示例 4: 混合使用 - 实时显示 + 数据收集
 */
async function example4_HybridHandler() {
    console.log("\n\n=== 示例 4: 混合使用 - 实时显示 + 数据收集 ===\n");
    
    const agent = loadAndGetAgent().agent!;

    const result = await streamTextWrapper({
        agent,
        messages: [
            {
                role: 'user',
                content: '深度学习和传统机器学习有什么区别？'
            }
        ],
        timeout: 60000
    });

    // 创建数据收集器
    const { handlers: collectorHandlers, getCollected } = createCollectorHandlers();
    
    // 创建控制台显示处理器
    const consoleHandlers = createConsoleHandlers();

    // 合并处理器 - 同时收集和显示
    const hybridHandlers: StreamHandlers = {
        reasoning: {
            onStart: async () => {
                await collectorHandlers.reasoning?.onStart?.();
                await consoleHandlers.reasoning?.onStart?.();
            },
            onDelta: async (text) => {
                await collectorHandlers.reasoning?.onDelta?.(text);
                await consoleHandlers.reasoning?.onDelta?.(text);
            },
            onEnd: async (fullText) => {
                await collectorHandlers.reasoning?.onEnd?.(fullText);
                await consoleHandlers.reasoning?.onEnd?.(fullText);
            }
        },
        text: {
            onStart: async () => {
                await collectorHandlers.text?.onStart?.();
                await consoleHandlers.text?.onStart?.();
            },
            onDelta: async (text) => {
                await collectorHandlers.text?.onDelta?.(text);
                await consoleHandlers.text?.onDelta?.(text);
            },
            onEnd: async (fullText) => {
                await collectorHandlers.text?.onEnd?.(fullText);
                await consoleHandlers.text?.onEnd?.(fullText);
            }
        },
        tool: {
            onCall: async (id, name, args) => {
                await collectorHandlers.tool?.onCall?.(id, name, args);
                await consoleHandlers.tool?.onCall?.(id, name, args);
            },
            onResult: async (id, name, result) => {
                await collectorHandlers.tool?.onResult?.(id, name, result);
                await consoleHandlers.tool?.onResult?.(id, name, result);
            }
        },
        onFinish: async (result) => {
            await consoleHandlers.onFinish?.(result);
            
            // 显示收集的统计信息
            const collected = getCollected();
            console.log('\n📈 统计信息:');
            console.log(`  推理字符数: ${collected.reasoning.length}`);
            console.log(`  回复字符数: ${collected.text.length}`);
            console.log(`  工具调用: ${collected.toolCalls.length} 次`);
        }
    };

    await processFullStream(result, {
        handlers: hybridHandlers
    });
}

/**
 * 示例 5: 带进度的处理器
 * 显示处理进度和状态
 */
async function example5_ProgressHandler() {
    console.log("\n\n=== 示例 5: 带进度的处理器 ===\n");
    
    const agent = loadAndGetAgent().agent!;

    const result = await streamTextWrapper({
        agent,
        messages: [
            {
                role: 'user',
                content: '请详细解释什么是卷积神经网络'
            }
        ],
        timeout: 60000
    });

    let charCount = 0;
    let lastProgressUpdate = Date.now();

    const progressHandlers: StreamHandlers = {
        reasoning: {
            onStart: () => {
                console.log('⏳ [1/3] 推理阶段...');
            },
            onDelta: (text) => {
                charCount += text.length;
                // 每 100ms 更新一次进度
                const now = Date.now();
                if (now - lastProgressUpdate > 100) {
                    process.stdout.write(`\r💭 已处理 ${charCount} 字符`);
                    lastProgressUpdate = now;
                }
            },
            onEnd: () => {
                console.log(`\n✅ 推理完成 (${charCount} 字符)\n`);
                charCount = 0;
            }
        },
        text: {
            onStart: () => {
                console.log('⏳ [2/3] 生成回复...\n');
            },
            onDelta: (text) => {
                process.stdout.write(text);
                charCount += text.length;
            },
            onEnd: () => {
                console.log(`\n\n✅ 回复完成 (${charCount} 字符)\n`);
            }
        },
        onFinish: () => {
            console.log('✅ [3/3] 全部完成！');
        }
    };

    await processFullStream(result, {
        handlers: progressHandlers
    });
}

// 运行示例
async function runAllExamples() {
    console.log('🚀 开始运行 Stream Handler 示例\n');
    console.log('提示：如果遇到超时，请检查：');
    console.log('  1. 网络连接是否正常');
    console.log('  2. API 密钥是否有效');
    console.log('  3. API 端点是否可访问\n');
    console.log('='.repeat(60) + '\n');
    
    try {
        // 选择要运行的示例（一次运行一个避免 API 限流）
        await example1_ConsoleHandler();
        // await example2_CustomHandlers();
        // await example3_CollectorHandler();
        // await example4_HybridHandler();
        // await example5_ProgressHandler();
        
        console.log('\n' + '='.repeat(60));
        console.log('✅ 所有示例运行完成！');
    } catch (error) {
        console.log('\n' + '='.repeat(60));
        console.error('❌ 示例运行失败:\n');
        
        if (error instanceof Error) {
            console.error(`错误类型: ${error.name}`);
            console.error(`错误信息: ${error.message}`);
            
            // 针对常见错误提供建议
            if (error.name === 'TimeoutError') {
                console.error('\n💡 超时解决建议:');
                console.error('  - 增加 timeout 参数（当前已设置为 60 秒）');
                console.error('  - 检查网络连接');
                console.error('  - 尝试更换 API 端点');
            } else if (error.message.includes('API key')) {
                console.error('\n💡 API 密钥问题:');
                console.error('  - 检查 agent.json 中的 api_key 是否正确');
                console.error('  - 确认 API 密钥有足够的配额');
            } else if (error.message.includes('undefined is not an object')) {
                console.error('\n💡 配置问题:');
                console.error('  - 检查 agent.json 文件格式是否正确');
                console.error('  - 确认所有必需字段都已填写');
            }
            
            if (error.stack) {
                console.error('\n堆栈信息:');
                console.error(error.stack);
            }
        } else {
            console.error(error);
        }
        
        console.log('\n' + '='.repeat(60));
        process.exit(1);
    }
}

runAllExamples();
