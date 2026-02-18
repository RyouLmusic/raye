import type { ModelMessage, StreamTextResult, ToolSet } from "ai";
import { streamTextWrapper } from "@/session/stream-text-wrapper";
import { loadAndGetAgent } from "@/agent/agent";
import { SessionContext } from "@/session/seesion";
import { processFullStream } from "@/session/stream-handler";
import { on } from "node:cluster";

export interface Planner {
    plan(messages: readonly ModelMessage[]): Promise<StreamTextResult<ToolSet, never>>;
}

export function createPlanner(): Planner {
    return {
        plan,
    };
}

/**
 * 规划消息处理
 * @param messages 输入消息列表
 * @returns 规划结果的流
 */
async function plan(messages: readonly ModelMessage[]): Promise<StreamTextResult<ToolSet, never>> {
    const planAgent = loadAndGetAgent().plan!;
    const session = SessionContext.current();
    const result = await streamTextWrapper({
        agent: planAgent,
        messages: [...messages],
        maxRetries: 0, // 规划阶段不需要重试
    });

    await processFullStream(result, {
        handlers: {
            reasoning: {
                onStart: () => {
                    console.log('💭 开始推理...');
                },
                onDelta: (text: string) => {
                    console.log(text);
                },
                onEnd: (full: string) => {
                    console.log('\n推理完成');
                    console.log('📋 规划结果:', full);
                }
            },
            text: {
                onStart: () => {
                    console.log('💭 开始推理...');
                },
                onDelta: (text: string) => {
                    console.log(text);
                },
                onEnd: (full: string) => {
                    console.log('\n推理完成');
                    console.log('📋 规划结果:', full);
                }
            },
            tool: {
                onCall: (id, name, args) => {
                    console.log('🔧 工具调用:', name);
                    console.log('参数:', args);
                },
                onResult: (id: string, name: string, result: any) => {
                    console.log(`🔧 工具调用返回 - ID: ${id}, Name: ${name}, Result:`, result);
                }
            },
            step: {
                onStart: (numbser) => {
                    console.log(`➡️ 开始步骤 ${numbser}...`);
                },
                onEnd: (number) => {
                    console.log(`✅ 步骤 ${number} 完成`);
                }
            },
            onError: (err) => {
                console.error('❌ 规划过程中发生错误:', err);
            },
            onFinish: (result) => {
                console.log('🎉 规划流程结束');
                console.log('最终结果:', result);
                console.log('plan结果', result.text);
                console.log('结束原因:', result.finishReason);
                console.log('推理结果:', result.reasoning); 
                console.log('使用量', result.usage);
            }
        },
        debug: false
    });

    return result;
}