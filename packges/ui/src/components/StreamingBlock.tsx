import React from "react";
import { Box, Text } from "ink";

interface StreamingBlockProps {
    /** 当前正在 streaming 的文本 */
    text: string;
}

/**
 * 主执行阶段正在 streaming 的 AI 回复
 * 展示最后 10 行 + 光标
 */
export function StreamingBlock({ text }: StreamingBlockProps) {
    const lines = text.split("\n");
    const visible = lines.slice(-10);

    return (
        <Box flexDirection="column" paddingLeft={1}>
            <Box marginBottom={0}>
                <Text color="green" bold>● </Text>
                <Text color="green">Assistant</Text>
                <Text color="gray"> (streaming…)</Text>
            </Box>
            {visible.map((line, i) => {
                const isLast = i === visible.length - 1;
                return (
                    <Text key={i} color="white">
                        {line}
                        {isLast ? <Text color="green">▋</Text> : ""}
                    </Text>
                );
            })}
        </Box>
    );
}
