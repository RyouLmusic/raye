import { streamTextWrapper } from "@/session/stream-text-wrapper.js";
import { loadAndGetAgent } from "@/agent/agent.js";
import { calculate } from "@/tools/caculate.ts";

/**
 * 示例1A: 使用配置中的工具 - 使用 fullStream（完整流式输出）
 * 优点：实时显示思考、工具调用、文本，体验最佳
 * 缺点：需要处理多种 chunk 类型
 */
async function useConfiguredToolsFullStream() {
    console.log("=== 示例1A: 使用配置中的工具（fullStream） ===\n");
    
    const agent = loadAndGetAgent().subAgent!;

    const result = await streamTextWrapper({
        agent,
        messages: [
            {
                role: 'user',
                content: '请帮我计算 123 加 456 和 234 乘以 456 等于多少？并且给出答案的详细步骤'
            }
        ]
    });

    console.log("📝 流式输出（包含思考过程和工具调用）:");
    
    let isReasoning = false;
    let currentSection = '';
    
    for await (const chunk of result.fullStream) {
        // === 思考过程 ===
        if (chunk.type === 'reasoning-delta' && chunk.text) {
            if (!isReasoning) {
                console.log('\n💭 思考过程:');
                console.log('─'.repeat(60));
                isReasoning = true;
            }
            process.stdout.write('\x1b[36m' + chunk.text + '\x1b[0m');
        } else if (chunk.type === 'reasoning-end') {
            if (isReasoning) {
                console.log('\n' + '─'.repeat(60));
                isReasoning = false;
            }
        }
        
        // === 工具调用 ===
        else if (chunk.type === 'tool-call') {
            console.log('\n\n🔧 工具调用:');
            console.log('─'.repeat(60));
            console.log(`工具名称: ${chunk.toolName}`);
            console.log(`调用ID: ${chunk.toolCallId}`);
            console.log('参数:');
            console.log(JSON.stringify(chunk.input, null, 2));
            console.log('─'.repeat(60));
        }
        
        // === 工具结果 ===
        else if (chunk.type === 'tool-result') {
            console.log('\n✅ 工具结果:');
            console.log('─'.repeat(60));
            console.log(`工具名称: ${chunk.toolName}`);
            console.log(`调用ID: ${chunk.toolCallId}`);
            console.log('输出:');
            console.log(JSON.stringify(chunk.output, null, 2));
            console.log('─'.repeat(60));
        }
        
        // === 文本回复 ===
        else if (chunk.type === 'text-delta' && chunk.text) {
            if (currentSection !== 'text') {
                console.log('\n\n📄 AI 回复:');
                console.log('─'.repeat(60));
                currentSection = 'text';
            }
            process.stdout.write(chunk.text);
        }
        
        // === 完成统计 ===
        else if (chunk.type === 'finish') {
            if (currentSection === 'text') {
                console.log('\n' + '─'.repeat(60));
            }
            console.log('\n\n📊 使用统计:');
            console.log('─'.repeat(60));
            if (chunk.totalUsage) {
                console.log(JSON.stringify(chunk.totalUsage, null, 2));
            }
            console.log('─'.repeat(60));
            console.log('\n✓ 完成原因:', chunk.finishReason);
        }
    }
    console.log('\n');
}

/**
 * 示例1B: 使用配置中的工具 - 使用 textStream + Promise（混合方式）
 * 优点：代码简单，只处理文本流
 * 缺点：思考和工具信息需等待完成后才显示
 */
async function useConfiguredToolsTextStream() {
    console.log("=== 示例1B: 使用配置中的工具（textStream） ===\n");
    
    const agent = loadAndGetAgent().agent!;

    const result = await streamTextWrapper({
        agent,
        messages: [
            {
                role: 'user',
                content: '请帮我计算 123 加 456 等于多少？并且给出答案的详细步骤'
            }
        ]
    });

    console.log("📝 流式输出（仅文本）:");
    
    // 步骤1: 实时显示文本
    console.log('\n📄 AI 回复:');
    console.log('─'.repeat(60));
    for await (const textPart of result.textStream) {
        process.stdout.write(textPart);
    }
    console.log('\n' + '─'.repeat(60));
    
    // 步骤2: 等待完成后获取其他数据
    const [text, reasoning, toolCalls, toolResults, usage, finishReason] = await Promise.all([
        result.text,
        result.reasoning,
        result.toolCalls,
        result.toolResults,
        result.usage,
        result.finishReason
    ]);
    
    // 步骤3: 显示思考过程（如果有）
    if (reasoning) {
        console.log('\n💭 思考过程（完成后）:');
        console.log('─'.repeat(60));
        const reasoningText = typeof reasoning === 'string' ? reasoning : JSON.stringify(reasoning, null, 2);
        console.log('\x1b[36m' + reasoningText + '\x1b[0m');
        console.log('─'.repeat(60));
    }
    
    // 步骤4: 显示工具调用信息
    if (toolCalls && toolCalls.length > 0) {
        console.log('\n🔧 工具调用（完成后）:');
        console.log('─'.repeat(60));
        for (const call of toolCalls) {
            console.log(`工具名称: ${call.toolName}`);
            console.log(`调用ID: ${call.toolCallId}`);
            console.log('详情:');
            console.log(JSON.stringify(call, null, 2));
        }
        console.log('─'.repeat(60));
    }
    
    // 步骤5: 显示工具结果
    if (toolResults && toolResults.length > 0) {
        console.log('\n✅ 工具结果（完成后）:');
        console.log('─'.repeat(60));
        for (const res of toolResults) {
            console.log(`工具名称: ${res.toolName}`);
            console.log(`调用ID: ${res.toolCallId}`);
            console.log('详情:');
            console.log(JSON.stringify(res, null, 2));
        }
        console.log('─'.repeat(60));
    }
    
    // 步骤6: 显示完整文本
    console.log('\n📝 完整文本:');
    console.log(`   ${text}`);
    
    // 步骤7: 显示使用统计
    console.log('\n📊 使用统计:');
    console.log('─'.repeat(60));
    console.log(JSON.stringify(usage, null, 2));
    console.log('─'.repeat(60));
    
    console.log('\n✓ 完成原因:', finishReason);
    console.log('\n');
}

/**
 * 示例2A: 临时覆盖工具 - 使用 fullStream（完整流式输出）
 * 优点：实时显示思考、工具调用、文本，体验最佳
 * 缺点：需要处理多种 chunk 类型
 */
async function overrideToolsFullStream() {
    console.log("=== 示例2A: 使用 fullStream（完整流式） ===\n");
    
    const agent = loadAndGetAgent().agent2!;

    const result = await streamTextWrapper({
        agent,
        messages: [
            {
                role: 'user',
                content: '计算 100 乘以 5'
            }
        ],
        tools: {
            calculate: calculate,
        }
    });

    console.log("📝 流式输出（包含思考过程和工具调用）:");
    
    let isReasoning = false;
    let currentSection = '';
    
    for await (const chunk of result.fullStream) {
        // === 思考过程 ===
        if (chunk.type === 'reasoning-delta' && chunk.text) {
            if (!isReasoning) {
                console.log('\n💭 思考过程:');
                console.log('─'.repeat(60));
                isReasoning = true;
            }
            process.stdout.write('\x1b[36m' + chunk.text + '\x1b[0m');
        } else if (chunk.type === 'reasoning-end') {
            if (isReasoning) {
                console.log('\n' + '─'.repeat(60));
                isReasoning = false;
            }
        }
        
        // === 工具调用 ===
        else if (chunk.type === 'tool-call') {
            console.log('\n\n🔧 工具调用:');
            console.log('─'.repeat(60));
            console.log(`工具名称: ${chunk.toolName}`);
            console.log(`调用ID: ${chunk.toolCallId}`);
            console.log('参数:');
            console.log(JSON.stringify(chunk.input, null, 2));
            console.log('─'.repeat(60));
        }
        
        // === 工具结果 ===
        else if (chunk.type === 'tool-result') {
            console.log('\n✅ 工具结果:');
            console.log('─'.repeat(60));
            console.log(`工具名称: ${chunk.toolName}`);
            console.log(`调用ID: ${chunk.toolCallId}`);
            console.log('输出:');
            console.log(JSON.stringify(chunk.output, null, 2));
            console.log('─'.repeat(60));
        }
        
        // === 文本回复 ===
        else if (chunk.type === 'text-delta' && chunk.text) {
            if (currentSection !== 'text') {
                console.log('\n\n📄 AI 回复:');
                console.log('─'.repeat(60));
                currentSection = 'text';
            }
            process.stdout.write(chunk.text);
        }
        
        // === 完成统计 ===
        else if (chunk.type === 'finish') {
            if (currentSection === 'text') {
                console.log('\n' + '─'.repeat(60));
            }
            console.log('\n\n📊 使用统计:');
            console.log('─'.repeat(60));
            if (chunk.totalUsage) {
                console.log(JSON.stringify(chunk.totalUsage, null, 2));
            }
            console.log('─'.repeat(60));
            console.log('\n✓ 完成原因:', chunk.finishReason);
        }
    }
    console.log('\n');
}

/**
 * 示例2B: 临时覆盖工具 - 使用 textStream + Promise（混合方式）
 * 优点：代码简单，只处理文本流
 * 缺点：思考和工具信息需等待完成后才显示
 */
async function overrideToolsTextStream() {
    console.log("=== 示例2B: 使用 textStream + Promise（混合方式） ===\n");
    
    const agent = loadAndGetAgent().agent2!;

    const result = await streamTextWrapper({
        agent,
        messages: [
            {
                role: 'user',
                content: '计算 100 乘以 5，并且给出答案的详细步骤'
            }
        ],
        tools: {
            calculate: calculate,
        }
    });

    console.log("📝 流式输出（仅文本）:");
    
    // 步骤1: 实时显示文本
    console.log('\n📄 AI 回复:');
    console.log('─'.repeat(60));
    for await (const textPart of result.textStream) {
        process.stdout.write(textPart);
    }
    console.log('\n' + '─'.repeat(60));
    
    // 步骤2: 等待完成后获取其他数据
    const [reasoning, toolCalls, toolResults, usage, finishReason] = await Promise.all([
        result.reasoning,
        result.toolCalls,
        result.toolResults,
        result.usage,
        result.finishReason
    ]);
    
    // 步骤3: 显示思考过程（如果有）
    if (reasoning) {
        console.log('\n💭 思考过程（完成后）:');
        console.log('─'.repeat(60));
        const reasoningText = typeof reasoning === 'string' ? reasoning : JSON.stringify(reasoning, null, 2);
        console.log('\x1b[36m' + reasoningText + '\x1b[0m');
        console.log('─'.repeat(60));
    }
    
    // 步骤4: 显示工具调用信息
    if (toolCalls && toolCalls.length > 0) {
        console.log('\n🔧 工具调用（完成后）:');
        console.log('─'.repeat(60));
        for (const call of toolCalls) {
            console.log(`工具名称: ${call.toolName}`);
            console.log(`调用ID: ${call.toolCallId}`);
            console.log('详情:');
            console.log(JSON.stringify(call, null, 2));
        }
        console.log('─'.repeat(60));
    }
    
    // 步骤5: 显示工具结果
    if (toolResults && toolResults.length > 0) {
        console.log('\n✅ 工具结果（完成后）:');
        console.log('─'.repeat(60));
        for (const res of toolResults) {
            console.log(`工具名称: ${res.toolName}`);
            console.log(`调用ID: ${res.toolCallId}`);
            console.log('详情:');
            console.log(JSON.stringify(res, null, 2));
        }
        console.log('─'.repeat(60));
    }
    
    // 步骤6: 显示使用统计
    console.log('\n📊 使用统计:');
    console.log('─'.repeat(60));
    console.log(JSON.stringify(usage, null, 2));
    console.log('─'.repeat(60));
    
    console.log('\n✓ 完成原因:', finishReason);
    console.log('\n');
}

/**
 * 示例3: 不使用任何工具的 Agent
 */
async function noTools() {
    console.log("=== 示例3: 不使用工具 ===\n");
    
    const agent = loadAndGetAgent().agent2!;  // 此 agent 配置中 tools 为空

    const result = await streamTextWrapper({
        agent,
        messages: [
            {
                role: 'user',
                content: '请介绍一下你自己'
            }
        ]
    });

    console.log("📝 纯对话（无工具）:");
    
    // 使用 textStream 实时显示文本输出
    console.log('\n📄 回复内容:');
    for await (const textPart of result.textStream) {
        process.stdout.write(textPart);
    }
    console.log('\n');
    
    // 等待完成后获取使用统计
    const [text, usage, finishReason] = await Promise.all([
        result.text,
        result.usage,
        result.finishReason
    ]);
    
    console.log('\n📝 完整文本:');
    console.log(`   ${text}`);
    
    console.log('\n📊 使用统计:');
    console.log(JSON.stringify(usage, null, 2));
    
    console.log('\n✓ 完成原因:', finishReason);
    console.log('\n');
}

// 运行示例
const mode = process.argv[2] || 'help';

switch (mode) {
    case 'configured-full':
        await useConfiguredToolsFullStream();
        break;
    case 'configured-text':
        await useConfiguredToolsTextStream();
        break;
    case 'override-full':
        await overrideToolsFullStream();
        break;
    case 'override-text':
        await overrideToolsTextStream();
        break;
    case 'compare-configured':
        console.log('🔄 对比示例1的两种方式：\n');
        await useConfiguredToolsFullStream();
        console.log('\n' + '='.repeat(80) + '\n');
        await useConfiguredToolsTextStream();
        break;
    case 'compare-override':
        console.log('🔄 对比示例2的两种方式：\n');
        await overrideToolsFullStream();
        console.log('\n' + '='.repeat(80) + '\n');
        await overrideToolsTextStream();
        break;
    case 'fullstream':
        console.log('🚀 所有 fullStream 示例：\n');
        await useConfiguredToolsFullStream();
        console.log('\n' + '='.repeat(80) + '\n');
        await overrideToolsFullStream();
        break;
    case 'textstream':
        console.log('🚀 所有 textStream 示例：\n');
        await useConfiguredToolsTextStream();
        console.log('\n' + '='.repeat(80) + '\n');
        await overrideToolsTextStream();
        break;
    case 'none':
        await noTools();
        break;
    case 'all':
        await useConfiguredToolsFullStream();
        console.log('\n' + '='.repeat(80) + '\n');
        await useConfiguredToolsTextStream();
        console.log('\n' + '='.repeat(80) + '\n');
        await overrideToolsFullStream();
        console.log('\n' + '='.repeat(80) + '\n');
        await overrideToolsTextStream();
        console.log('\n' + '='.repeat(80) + '\n');
        await noTools();
        break;
    default:
        console.log('用法: bun tool-usage-examples.ts <选项>');
        console.log('');
        console.log('📋 单个示例:');
        console.log('  configured-full  - 示例1A: 配置工具 + fullStream（完整实时流）');
        console.log('  configured-text  - 示例1B: 配置工具 + textStream（混合方式）');
        console.log('  override-full    - 示例2A: 覆盖工具 + fullStream（完整实时流）');
        console.log('  override-text    - 示例2B: 覆盖工具 + textStream（混合方式）');
        console.log('  none             - 示例3: 纯对话无工具');
        console.log('');
        console.log('🔄 对比模式:');
        console.log('  compare-configured - 对比示例1的两种实现方式');
        console.log('  compare-override   - 对比示例2的两种实现方式');
        console.log('');
        console.log('🚀 批量运行:');
        console.log('  fullstream  - 运行所有 fullStream 示例');
        console.log('  textstream  - 运行所有 textStream 示例');
        console.log('  all         - 运行所有示例');
        console.log('');
        console.log('💡 推荐:');
        console.log('  bun tool-usage-examples.ts compare-configured  # 对比两种方式');
        console.log('  bun tool-usage-examples.ts fullstream          # 体验完整流式输出');
}
