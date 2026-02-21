import React, { useState } from "react";
import { Box, Text, useInput } from "ink";
import { Icon } from "./Icon";

interface PromptInputProps {
    disabled: boolean;
    onSubmit: (message: string) => void;
    error?: string;
    isFocused?: boolean;
}

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
        <Box flexDirection="column" marginTop={1}>
            {error && (
                <Box paddingX={0} marginBottom={1}>
                    <Icon name="error" color="redBright" />
                    <Text color="redBright"> </Text>
                    <Text color="redBright">{error}</Text>
                </Box>
            )}
            <Box paddingX={0}>
                {disabled ? (
                    <Text color="gray" dimColor>[ Agent working... ]</Text>
                ) : (
                    <>
                        <Icon name="user" color="cyanBright" />
                        <Text color="cyanBright"> </Text>
                        <Text color="white">{value}</Text>
                        <Text color="cyanBright">_</Text>
                    </>
                )}
            </Box>
        </Box>
    );
}
