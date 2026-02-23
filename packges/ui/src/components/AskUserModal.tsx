import React, { useState } from "react";
import { Box, Text, useInput } from "ink";

export interface AskUserModalProps {
    /** 要询问的问题 */
    question: string;
    /** 用户提交答案时的回调 */
    onSubmit: (answer: string) => void;
    /** 用户取消时的回调（可选） */
    onCancel?: () => void;
    /** 是否显示取消按钮提示 */
    showCancelHint?: boolean;
}

/**
 * ask_user 工具专用的模态输入框组件（简化版）
 * 
 * 特点：
 * - 简洁的黄色主题
 * - 单层边框
 * - 清晰的操作提示
 */
export function AskUserModal({ 
    question, 
    onSubmit, 
    onCancel,
    showCancelHint = true 
}: AskUserModalProps) {
    const [input, setInput] = useState("");

    useInput(
        (char, key) => {
            if (key.return) {
                const trimmed = input.trim();
                if (trimmed) {
                    onSubmit(trimmed);
                    setInput("");
                }
                return;
            }

            if (key.backspace || key.delete) {
                setInput(v => v.slice(0, -1));
                return;
            }

            // Ctrl+C 取消
            if (key.ctrl && char === 'c' && onCancel) {
                onCancel();
                return;
            }

            // 过滤控制字符
            if (char && !key.ctrl && !key.meta) {
                setInput(v => v + char);
            }
        },
        { isActive: true }
    );

    return (
        <Box 
            flexDirection="column" 
            borderStyle="round" 
            borderColor="yellowBright"
            paddingX={1}
            marginY={1}
        >
            {/* 问题 */}
            <Box marginBottom={1}>
                <Text color="yellowBright" bold>? </Text>
                <Text color="yellow">{question}</Text>
            </Box>
            
            {/* 输入区域 */}
            <Box>
                <Text color="cyanBright">▶ </Text>
                <Text color="white">{input}</Text>
                <Text color="cyan">_</Text>
            </Box>
            
            {/* 操作提示 */}
            <Box marginTop={1}>
                <Text dimColor>按 </Text>
                <Text color="green">Enter</Text>
                <Text dimColor> 提交</Text>
                {showCancelHint && (
                    <>
                        <Text dimColor> | </Text>
                        <Text color="red">Ctrl+C</Text>
                        <Text dimColor> 取消</Text>
                    </>
                )}
            </Box>
        </Box>
    );
}

/**
 * 简化版 - 无边框，适合嵌入式使用
 */
export function AskUserInline({ 
    question, 
    onSubmit 
}: Pick<AskUserModalProps, "question" | "onSubmit">) {
    const [input, setInput] = useState("");

    useInput(
        (char, key) => {
            if (key.return) {
                const trimmed = input.trim();
                if (trimmed) {
                    onSubmit(trimmed);
                    setInput("");
                }
                return;
            }

            if (key.backspace || key.delete) {
                setInput(v => v.slice(0, -1));
                return;
            }

            // 过滤控制字符
            if (char && !key.ctrl && !key.meta) {
                setInput(v => v + char);
            }
        },
        { isActive: true }
    );

    return (
        <Box flexDirection="column" marginY={1}>
            <Box>
                <Text color="yellowBright" bold>? </Text>
                <Text color="yellow">{question}</Text>
            </Box>
            <Box marginTop={0}>
                <Text color="cyanBright">▶ </Text>
                <Text color="white">{input}</Text>
                <Text color="cyan">_</Text>
            </Box>
        </Box>
    );
}
