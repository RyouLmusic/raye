import type { ModelMessage } from "ai";

export interface Compressor {
    compress(messages: ModelMessage[], threshold: number): ModelMessage[];
}

export function createCompressor(): Compressor {
    return {
        compress,
    };
}

/**
 * 压缩消息列表
 * @param messages 原始消息列表
 * @param threshold 阈值
 * @returns 压缩后的消息列表
 */
function compress(messages: ModelMessage[], threshold: number): ModelMessage[] {
    // TODO: 实现消息压缩逻辑
    return messages;
}