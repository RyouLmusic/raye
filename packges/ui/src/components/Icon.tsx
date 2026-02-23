import React from "react";
import { Text } from "ink";
import type { TextProps } from "ink";

export type IconName =
    | "user"
    | "ai"
    | "tool_pending"
    | "tool_done"
    | "error"
    | "expand"
    | "collapse"
    | "arrow_right"
    | "ask_user"
    | "user_reply";

export interface IconProps extends TextProps {
    name: IconName;
}

const icons: Record<IconName, string> = {
    user: "❯",
    ai: "RAYE",
    tool_pending: "◇",
    tool_done: "◆",
    error: "!",
    expand: "+",
    collapse: "-",
    arrow_right: "→",
    ask_user: "?",
    user_reply: "✓",
};

/**
 * 极简终端字符图标组件
 * 用于替代 Emoji 的标准符号和特征标识，保持硬核的 CLI 美学。
 */
export function Icon({ name, ...props }: IconProps) {
    return <Text {...props}>{icons[name] || "•"}</Text>;
}
