import type { AgentConfig, AgentConfigs } from '@/agent/type.js';
import { readFileSync } from 'fs';
import { agentConfigList } from '@/agent/type.js';
import { isValidToolName } from '@/tools/tools-register.ts';
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import PLAN_PROMPT from "@/agent/prompt/plan.txt";
import AGENT_PROMPT from "@/agent/prompt/agent.txt";
import SUMMARY_PROMPT from "@/agent/prompt/summary.txt";
const __dirname = dirname(fileURLToPath(import.meta.url));

export function loadAndGetAgent(): Record<string, AgentConfig> {
    const configPath = join(__dirname, 'agent.json');
    const configFile = readFileSync(configPath, 'utf-8');
    const configData = JSON.parse(configFile);
    const agents = agentConfigList.parse(configData);
    
    // 验证工具名称
    for (const agent of agents) {
        for (const toolName of agent.tools) {
            if (!isValidToolName(toolName)) {
                console.error(`[Agent: ${agent.name}] Invalid tool name "${toolName}". This tool is not registered.`);
            }
        }
    }
    
    // 创建 prompt 占位符映射
    const promptMap: Record<string, string> = {
        '{PLAN_PROMPT}': PLAN_PROMPT,
        '{AGENT_PROMPT}': AGENT_PROMPT,
        '{SUMMARY_PROMPT}': SUMMARY_PROMPT
    };
    
    // 将 agentConfig 中的 prompt 字段替换为对应的文本内容
    for (const agent of agents) {
        if (agent.prompt) {
            // 替换所有已知的占位符
            let processedPrompt = agent.prompt;
            for (const [placeholder, content] of Object.entries(promptMap)) {
                processedPrompt = processedPrompt.replace(placeholder, content);
            }
            agent.prompt = processedPrompt;
        }
    }
    
    return agents.reduce((record, agent) => {
        record[agent.name] = agent as AgentConfig;
        return record;
    }, {} as Record<string, AgentConfig>);
}