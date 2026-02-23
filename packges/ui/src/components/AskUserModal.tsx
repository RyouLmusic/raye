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
 * ask_user 工具专用的模态输入框组件
 * 
 * 特点：
 * - 醒目的黄色主题，突出显示 Agent 正在等待用户输入
 * - 双层边框设计，增强视觉层次
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
            borderStyle="double" 
            borderColor="yellowBright"
            padding={1}
            marginY={1}
        >
            {/* 标题栏 - 使用反色突出显示 */}
            <Box marginBottom={1}>
                <Text bold color="black" backgroundColor="yellowBright">
                    {" ⚠️  AGENT 正在询问 "}
                </Text>
            </Box>
            
            {/* 问题内容 - 内嵌边框 */}
            <Box 
                flexDirection="column" 
                paddingX={1} 
                paddingY={1}
                borderStyle="round"
                borderColor="yellow"
                marginBottom={1}
            >
                <Text color="white" bold>{question}</Text>
            </Box>
            
            {/* 输入区域 */}
            <Box flexDirection="column" marginBottom={1}>
                <Text color="cyanBright" bold>您的回答:</Text>
                <Box marginTop={0}>
                    <Text color="cyan" bold>▶ </Text>
                    <Text color="white">{input}</Text>
                    <Text color="cyan">_</Text>
                </Box>
            </Box>
            
            {/* 操作提示 */}
            <Box borderStyle="single" borderColor="gray" paddingX={1}>
                <Text dimColor>💡 按 </Text>
                <Text color="green" bold>Enter</Text>
                <Text dimColor> 提交</Text>
                {showCancelHint && (
                    <>
                        <Text dimColor> | </Text>
                        <Text color="red" bold>Ctrl+C</Text>
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
