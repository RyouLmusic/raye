export { startTUI } from "./src/tui";
export { App } from "./src/app";
export type { AgentLoopUIState, TurnMessage, MessagePhase } from "./src/hooks/useAgentLoop";
// 重新导出 Core 包的类型，方便 CLI 使用
export type { AgentConfig, ConnectionConfig, BehaviorConfig } from "core/agent/type";
