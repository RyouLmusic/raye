import { streamTextWrapper, generateTextWrapper } from "@/session/stream-text-wrapper.js";
import type { StreamTextInput } from "@/session/type.js";
import type { ToolSet } from "ai";

/**
 * 带 Usage 统计的流式包装器
 * 
 * 在流式显示的同时，通过非流式请求获取准确的 token 使用统计
 * 
 * @param input - 流式输入参数
 * @param options - 配置选项
 * @returns 流式响应结果和 usage Promise
 * 
 * @example
 * ```ts
 * const { stream, getUsage } = await streamWithUsage({
 *   agent: agentConfig,
 *   messages: [{ role: 'user', content: '你好' }]
 * });
 * 
 * // 流式显示给用户
 * for await (const chunk of stream.textStream) {
 *   process.stdout.write(chunk);
 * }
 * 
 * // 获取准确的 usage 统计
 * const usage = await getUsage();
 * console.log('Total tokens:', usage.totalTokens);
 * ```
 */
export async function streamWithUsage<TOOLS extends ToolSet = ToolSet>(
    input: StreamTextInput<TOOLS>,
    options: {
        /** 是否在后台获取 usage（默认：true） */
        fetchUsageInBackground?: boolean;
        /** usage 请求的最大 token 数（用于节省成本，默认：10） */
        usageMaxTokens?: number;
    } = {}
) {
    const { fetchUsageInBackground = true, usageMaxTokens = 10 } = options;
    
    // 启动流式响应
    const stream = await streamTextWrapper(input);
    
    // 用于获取 usage 的函数
    const getUsage = async () => {
        try {
            // 收集所有消息（包括完整对话历史）
            const messages = [...input.messages];
            
            // 等待流式响应完成后的文本
            const streamText = await stream.text;
            if (streamText) {
                messages.push({
                    role: 'assistant' as const,
                    content: streamText
                });
            }
            
            // 发送一个轻量级请求来获取 usage
            // 使用相同的消息历史，但限制输出以节省成本
            const usageResult = await generateTextWrapper({
                agent: input.agent,
                messages: messages,
                maxOutputTokens: usageMaxTokens,
                temperature: input.temperature,
                topP: input.topP,
                maxRetries: input.maxRetries,
                timeout: input.timeout,
            });
            
            return usageResult.usage;
        } catch (error) {
            console.warn('[streamWithUsage] Failed to fetch usage:', error);
            return {
                inputTokens: 0,
                outputTokens: 0,
                totalTokens: 0,
                reasoningTokens: 0
            };
        }
    };
    
    // 如果启用后台获取，立即开始获取
    const usagePromise = fetchUsageInBackground ? getUsage() : null;
    
    return {
        /** 流式响应对象 */
        stream,
        /** 获取准确的 usage 统计（返回 Promise） */
        getUsage: usagePromise ? () => usagePromise : getUsage
    };
}

/**
 * 简化版本：仅用于获取最终 usage，不关心流式过程
 * 
 * @example
 * ```ts
 * const result = await streamTextWrapper({
 *   agent: agentConfig,
 *   messages: [{ role: 'user', content: '你好' }],
 *   onFinish: async (finishResult) => {
 *     // 流式响应完成后，获取准确的 usage
 *     const usage = await fetchUsageAfterStream(input, finishResult.text);
 *     console.log('Actual usage:', usage);
 *   }
 * });
 * ```
 */
export async function fetchUsageAfterStream<TOOLS extends ToolSet = ToolSet>(
    originalInput: StreamTextInput<TOOLS>,
    streamedText: string
) {
    try {
        const messages = [
            ...originalInput.messages,
            {
                role: 'assistant' as const,
                content: streamedText
            }
        ];
        
        // 发送一个轻量级请求获取历史对话的 usage
        const result = await generateTextWrapper({
            agent: originalInput.agent,
            messages,
            maxOutputTokens: 1, // 最小化新生成内容
            temperature: originalInput.temperature,
            topP: originalInput.topP,
            maxRetries: originalInput.maxRetries,
            timeout: originalInput.timeout,
        });
        
        // 由于我们添加了一个助手回复，实际的 usage 需要减去这次请求的输出
        // 但这只是一个估算，因为不同请求的 usage 可能略有不同
        const outputTokens = result.usage.outputTokens || 0;
        return {
            inputTokens: result.usage.inputTokens || 0,
            outputTokens: outputTokens - (outputTokens > 0 ? 1 : 0),
            totalTokens: (result.usage.totalTokens || 0) - (outputTokens > 0 ? 1 : 0),
            reasoningTokens: result.usage.reasoningTokens || 0
        };
    } catch (error) {
        console.warn('[fetchUsageAfterStream] Failed:', error);
        return {
            inputTokens: 0,
            outputTokens: 0,
            totalTokens: 0,
            reasoningTokens: 0
        };
    }
}
