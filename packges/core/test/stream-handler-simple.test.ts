import { streamTextWrapper } from "@/session/stream-text-wrapper";
import { loadAndGetAgent } from "@/agent/agent.js";
import { processFullStream, createConsoleHandlers } from "@/session/stream-handler";

/**
 * 简单测试 - 验证 stream handler 基本功能
 */
async function simpleTest() {
    console.log("🧪 Stream Handler 简单测试\n");
    
    const agentConfig = loadAndGetAgent().agent;
    
    if (!agentConfig) {
        console.error('❌ 错误: Agent 配置未找到！');
        console.error('请确保 agent.json 文件存在且格式正确\n');
        return;
    }

    console.log(`✅ Agent 配置加载成功`);
    console.log(`   名称: ${agentConfig.name}`);
    console.log(`   模型: ${agentConfig.model}`);
    console.log(`   提供商: ${agentConfig.provider}\n`);

    try {
        console.log('📡 发送请求中...\n');
        
        const result = await streamTextWrapper({
            agent: agentConfig,
            messages: [
                {
                    role: 'user',
                    content: '用 10 个字以内介绍你自己'
                }
            ],
            timeout: 60000,  // 60 秒超时
            maxOutputTokens: 100  // 限制输出长度，加快测试
        });

        console.log('✅ 请求成功，开始处理流...\n');
        console.log('─'.repeat(60) + '\n');

        await processFullStream(result, {
            handlers: createConsoleHandlers({
                showReasoning: true,
                showTools: false,
                showSteps: false
            })
        });

        console.log('\n' + '─'.repeat(60));
        console.log('\n✅ 测试完成！Stream Handler 工作正常。\n');

    } catch (error) {
        console.log('\n' + '─'.repeat(60));
        console.error('\n❌ 测试失败:\n');
        
        if (error instanceof Error) {
            console.error(`错误: ${error.name} - ${error.message}\n`);
            
            if (error.name === 'TimeoutError') {
                console.error('💡 超时问题解决建议:');
                console.error('   1. 检查网络连接');
                console.error('   2. 验证 API 端点是否可访问');
                console.error('   3. 尝试增加 timeout 值');
                console.error(`   4. 当前 API: ${agentConfig.base_url}\n`);
            } else if (error.message.includes('fetch')) {
                console.error('💡 网络问题:');
                console.error('   - 检查防火墙设置');
                console.error('   - 验证 API 密钥是否有效');
                console.error('   - 确认 base_url 配置正确\n');
            }
        } else {
            console.error(error);
        }
        
        console.error('\n请检查以上问题后重试。\n');
        process.exit(1);
    }
}

simpleTest();
