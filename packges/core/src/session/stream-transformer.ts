import type { TextStreamPart } from "ai";

/**
 * 通用的流转换器，用于统一处理不同模型的推理输出
 * 支持：
 * 1. 原生 reasoning chunks (DeepSeek)
 * 2. <think> 标签包裹的推理内容 (MiniMax without reasoning_split)
 */
export function createUnifiedStreamTransform() {
    return ({ tools, stopStream }: { tools: any; stopStream: () => void }) => {
        let buffer = '';
        let inThinkingTag = false;
        let hasEmittedReasoningStart = false;

        return new TransformStream<TextStreamPart<any>, TextStreamPart<any>>({
            async transform(chunk, controller) {
                // 1. 原生 reasoning chunks - 直接透传
                if (chunk.type === 'reasoning-start' || 
                    chunk.type === 'reasoning-delta' || 
                    chunk.type === 'reasoning-end') {
                    controller.enqueue(chunk);
                    return;
                }

                // 2. 处理 text-delta chunks，解析 <think> 标签
                if (chunk.type === 'text-delta' && chunk.text) {
                    buffer += chunk.text;

                    // 处理缓冲区内容
                    while (buffer.length > 0) {
                        if (!inThinkingTag) {
                            // 查找 <think> 标签
                            const thinkStart = buffer.indexOf('<think>');
                            
                            if (thinkStart !== -1) {
                                // 输出 <think> 之前的文本
                                if (thinkStart > 0) {
                                    const textBefore = buffer.substring(0, thinkStart);
                                    controller.enqueue({
                                        type: 'text-delta',
                                        id: chunk.id,
                                        text: textBefore,
                                        providerMetadata: chunk.providerMetadata
                                    });
                                }

                                // 发出 reasoning-start
                                if (!hasEmittedReasoningStart) {
                                    controller.enqueue({ 
                                        type: 'reasoning-start',
                                        id: chunk.id,
                                        providerMetadata: chunk.providerMetadata
                                    });
                                    hasEmittedReasoningStart = true;
                                }

                                buffer = buffer.substring(thinkStart + 7); // 移除 '<think>'
                                inThinkingTag = true;
                            } else {
                                // 检查是否可能在缓冲区末尾有部分 <think> 标签
                                const lastFewChars = buffer.slice(-7);
                                if ('<think>'.startsWith(lastFewChars) && lastFewChars.length < 7) {
                                    // 保留最后几个字符，可能是不完整的标签
                                    const outputLength = buffer.length - lastFewChars.length;
                                    if (outputLength > 0) {
                                        controller.enqueue({
                                            type: 'text-delta',
                                            id: chunk.id,
                                            text: buffer.substring(0, outputLength),
                                            providerMetadata: chunk.providerMetadata
                                        });
                                        buffer = lastFewChars;
                                    }
                                } else {
                                    // 没有潜在的标签,输出所有内容
                                    if (buffer.length > 0) {
                                        controller.enqueue({
                                            type: 'text-delta',
                                            id: chunk.id,
                                            text: buffer,
                                            providerMetadata: chunk.providerMetadata
                                        });
                                        buffer = '';
                                    }
                                }
                                break;
                            }
                        } else {
                            // 在 thinking 标签内，查找 </think>
                            const thinkEnd = buffer.indexOf('</think>');
                            
                            if (thinkEnd !== -1) {
                                // 输出 thinking 内容
                                if (thinkEnd > 0) {
                                    controller.enqueue({
                                        type: 'reasoning-delta',
                                        id: chunk.id,
                                        text: buffer.substring(0, thinkEnd),
                                        providerMetadata: chunk.providerMetadata
                                    });
                                }

                                // 发出 reasoning-end
                                controller.enqueue({ 
                                    type: 'reasoning-end',
                                    id: chunk.id,
                                    providerMetadata: chunk.providerMetadata
                                });
                                hasEmittedReasoningStart = false;

                                buffer = buffer.substring(thinkEnd + 8); // 移除 '</think>'
                                inThinkingTag = false;
                            } else {
                                // 检查是否可能在缓冲区末尾有部分 </think> 标签
                                const lastFewChars = buffer.slice(-8);
                                if ('</think>'.startsWith(lastFewChars) && lastFewChars.length < 8) {
                                    const outputLength = buffer.length - lastFewChars.length;
                                    if (outputLength > 0) {
                                        controller.enqueue({
                                            type: 'reasoning-delta',
                                            id: chunk.id,
                                            text: buffer.substring(0, outputLength),
                                            providerMetadata: chunk.providerMetadata
                                        });
                                        buffer = lastFewChars;
                                    }
                                } else {
                                    // 输出除最后8个字符外的所有内容
                                    if (buffer.length > 8) {
                                        controller.enqueue({
                                            type: 'reasoning-delta',
                                            id: chunk.id,
                                            text: buffer.substring(0, buffer.length - 8),
                                            providerMetadata: chunk.providerMetadata
                                        });
                                        buffer = buffer.slice(-8);
                                    }
                                }
                                break;
                            }
                        }
                    }
                    return;
                }

                // 3. finish chunk - 清理缓冲区
                if (chunk.type === 'finish') {
                    if (buffer.length > 0) {
                        if (inThinkingTag) {
                            // 输出剩余的 thinking 内容
                            controller.enqueue({
                                type: 'reasoning-delta',
                                id: 'reasoning-final',
                                text: buffer,
                            });
                            controller.enqueue({ 
                                type: 'reasoning-end',
                                id: 'reasoning-final'
                            });
                        } else {
                            // 输出剩余的文本
                            controller.enqueue({
                                type: 'text-delta',
                                id: 'txt-0',
                                text: buffer,
                            });
                        }
                        buffer = '';
                    }
                    controller.enqueue(chunk);
                    return;
                }

                // 4. 其他 chunks 直接透传
                controller.enqueue(chunk);
            }
        });
    };
}
