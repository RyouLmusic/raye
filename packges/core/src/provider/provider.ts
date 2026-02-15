import type { LanguageModelV3, ProviderV3 } from '@ai-sdk/provider';
import { createOpenAICompatible, type OpenAICompatibleProviderSettings } from '@ai-sdk/openai-compatible';
import type { AgentConfig, AgentConfigs } from '@/agent/type.js';
import { readFileSync } from 'fs';
import { agentConfigList } from '@/agent/type.js';

export namespace Provider {

    export function createProviderFromAgentConfig(config: AgentConfig): ProviderV3 {
        const baseConfig: OpenAICompatibleProviderSettings = {
            name: config.provider,
            apiKey: config.api_key,
            baseURL: config.base_url
        };
        
        baseConfig.transformRequestBody = (body: Record<string, any>) => {
            return {
                ...body,
                ...config.extra_body
            };
        };
        
        return createOpenAICompatible(baseConfig);
    }

    export function getAgentLanguage(agentConfig: AgentConfig): LanguageModelV3 | null {
        const provider = createProviderFromAgentConfig(agentConfig);
        if (!provider || !agentConfig) {
            return null;
        }
        return provider.languageModel(agentConfig.model);
    }
}