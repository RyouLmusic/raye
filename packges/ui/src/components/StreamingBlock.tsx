import React from "react";
import { Box, Text } from "ink";
import { Icon } from "./Icon";

interface StreamingBlockProps {
    text: string;
}

/**
 * 主执行阶段正在 streaming 的 AI 回复
 * 极简冷峻风，左侧无大量缩进，只显示最后 8 行 + 光标
 */
export function StreamingBlock({ text }: StreamingBlockProps) {
    const lines = text.split("\n");
    const visible = lines.slice(-8);

    return (
        <Box flexDirection="column" paddingLeft={0} marginTop={1}>
            <Box flexDirection="row">
                <Icon name="ai" color="whiteBright" />
                <Text color="whiteBright">:</Text>
            </Box>
            <Box paddingLeft={1} flexDirection="column">
                {visible.map((line, i) => {
                    const isLast = i === visible.length - 1;
                    return (
                        <Text key={i} color="white">
                            {line}
                            {isLast ? <Text color="whiteBright">▋</Text> : ""}
                        </Text>
                    );
                })}
            </Box>
        </Box>
    );
}
