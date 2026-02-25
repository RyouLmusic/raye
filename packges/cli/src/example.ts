/**
 * 示例：展示如何使用方案 3（分层配置）
 */

import { startTUI } from 'ui';
import type { ConnectionConfig } from 'ui';

// 示例 1：使用连接配置（方案 3 - 推荐）
async function exampleWithConnectionConfig() {
  const connectionConfig: ConnectionConfig = {
    name: 'agent',  // 引用 Core 中的行为配置
    base_url: 'https://api.openai.com/v1',
    api_key: process.env.OPENAI_API_KEY || '',
    model: 'gpt-4',
  };

  await startTUI({
    sessionId: 'my-session',
    connectionConfig,  // 只传递连接配置
    workDir: process.cwd(),
  });
}

// 示例 2：使用连接配置并覆盖行为
async function exampleWithOverrides() {
  const connectionConfig: ConnectionConfig = {
    name: 'agent',
    base_url: 'https://api.openai.com/v1',
    api_key: process.env.OPENAI_API_KEY || '',
    model: 'gpt-4',
    // 覆盖行为配置
    overrides: {
      tools: ['calculate', 'finish_task'],  // 自定义工具列表
      prompt: 'You are a custom assistant',  // 自定义提示词
    },
  };

  await startTUI({
    sessionId: 'my-session',
    connectionConfig,
    workDir: process.cwd(),
  });
}

// 示例 3：使用默认配置启动（向后兼容）
async function exampleWithDefaults() {
  await startTUI({
    sessionId: 'my-session',
  });
}

// 示例 4：CLI 包的典型使用场景
async function cliUsageExample() {
  // 1. CLI 从配置文件加载连接配置
  const connectionConfig: ConnectionConfig = {
    name: 'agent',  // 引用 Core 中的 'agent' 行为配置
    base_url: 'https://api.openai.com/v1',
    api_key: '${OPENAI_API_KEY}',  // 环境变量占位符
    model: 'gpt-4',
  };

  // 2. CLI 替换环境变量
  const processedConfig: ConnectionConfig = {
    ...connectionConfig,
    api_key: process.env.OPENAI_API_KEY || '',
  };

  // 3. CLI 调用 startTUI（UI 会自动加载行为配置）
  await startTUI({
    sessionId: `session-${Date.now()}`,
    connectionConfig: processedConfig,
    workDir: process.cwd(),
  });
}

export { 
  exampleWithConnectionConfig, 
  exampleWithOverrides,
  exampleWithDefaults, 
  cliUsageExample 
};
