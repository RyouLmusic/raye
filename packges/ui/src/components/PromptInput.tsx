import React, { useState } from "react";
import { Box, Text, useInput } from "ink";

interface PromptInputProps {
    /** Loop 运行时禁用输入 */
    disabled: boolean;
    /** 提交回调 */
    onSubmit: (message: string) => void;
    /** 错误提示 */
    error?: string;
    /** 是否获取焦点（ink 要求明确传递） */
    isFocused?: boolean;
}

/**
 * 底部用户输入框
 *
 * disabled=true  时显示 "waiting…" 并不响应键盘
 * disabled=false 时激活，响应输入，回车提交
 */
export function PromptInput({ disabled, onSubmit, error, isFocused = true }: PromptInputProps) {
    const [value, setValue] = useState("");

    useInput(
        (input, key) => {
            if (disabled) return;

            if (key.return) {
                const trimmed = value.trim();
                if (trimmed) {
                    onSubmit(trimmed);
                    setValue("");
                }
                return;
            }

            if (key.backspace || key.delete) {
                setValue(v => v.slice(0, -1));
                return;
            }

            // 过滤控制字符
            if (input && !key.ctrl && !key.meta) {
                setValue(v => v + input);
            }
        },
        { isActive: isFocused && !disabled }
    );

    return (
        <Box flexDirection="column">
            {error && (
                <Box paddingX={1}>
                    <Text color="red">⚠  {error}</Text>
                </Box>
            )}
            <Box borderStyle="single" borderColor={disabled ? "gray" : "blue"} paddingX={1}>
                {disabled ? (
                    <Text color="gray">waiting for agent…</Text>
                ) : (
                    <>
                        <Text color="blue" bold>❯ </Text>
                        <Text color="white">{value}</Text>
                        <Text color="blue">█</Text>
                    </>
                )}
            </Box>
        </Box>
    );
}
