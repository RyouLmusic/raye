/**
 * 示例：展示如何使用重构后的架构
 */

import { startTUI } from 'ui';
import type { AgentConfig } from 'core';
import type { RayaConfig } from './types';

// 示例 1：使用自定义配置启动
async function exampleWithConfig() {
  const config: AgentConfig = {
    name: 'my-agent',
    base_url: 'https://api.openai.com/v1',
    api_key: process.env.OPENAI_API_KEY || '',
    model: 'gpt-4',
    model_id: 'gpt-4',
    provider: 'openai',
    tools: [],
    prompt: 'You are a helpful assistant',
  };

  await startTUI({
    sessionId: 'my-session',
    agentConfig: config,
    workDir: process.cwd(),
  });
}

// 示例 2：使用默认配置启动（向后兼容）
async function exampleWithDefaults() {
  await startTUI({
    sessionId: 'my-session',
  });
}

// 示例 3：CLI 包的典型使用场景
async function cliUsageExample() {
  // 1. CLI 加载配置文件
  const config: RayaConfig = {
    name: 'raya-agent',
    base_url: 'https://api.openai.com/v1',
    api_key: '${OPENAI_API_KEY}', // 环境变量占位符
    model: 'gpt-4',
    model_id: 'gpt-4',
    provider: 'openai',
    tools: ['file_tool', 'search'],
    prompt: 'You are Raya, an AI assistant',
  };

  // 2. CLI 替换环境变量
  const processedConfig = {
    ...config,
    api_key: process.env.OPENAI_API_KEY || '',
  };

  // 3. CLI 调用 startTUI
  await startTUI({
    sessionId: `session-${Date.now()}`,
    agentConfig: processedConfig,
    workDir: process.cwd(),
  });
}

export { exampleWithConfig, exampleWithDefaults, cliUsageExample };
