/**
 * 递归替换对象中的环境变量占位符
 * 
 * @param obj - 任意对象
 * @returns 替换后的对象
 */
export function replaceEnvVars(obj: any): any {
  // 字符串：替换占位符
  if (typeof obj === 'string') {
    return obj.replace(/\$\{([^}]+)\}/g, (match, varName) => {
      return process.env[varName] || '';
    });
  }
  
  // 数组：递归处理每个元素
  if (Array.isArray(obj)) {
    return obj.map(item => replaceEnvVars(item));
  }
  
  // 对象：递归处理每个属性
  if (obj && typeof obj === 'object') {
    const result: any = {};
    for (const [key, value] of Object.entries(obj)) {
      result[key] = replaceEnvVars(value);
    }
    return result;
  }
  
  // 其他类型：直接返回
  return obj;
}

/**
 * 验证必需的环境变量
 * 
 * @param config - Agent 配置
 * @returns 缺失的环境变量列表
 */
export function validateEnvVars(config: any): string[] {
  const missing: string[] = [];
  
  // 检查必需的环境变量
  if (!config.api_key || config.api_key.trim() === '') {
    missing.push('api_key');
  }
  
  if (!config.base_url || config.base_url.trim() === '') {
    missing.push('base_url');
  }
  
  return missing;
}

/**
 * 获取环境变量设置提示
 * 
 * @param provider - 提供商名称
 * @returns 提示信息列表
 */
export function getEnvVarHints(provider: string): string[] {
  const hints: Record<string, string[]> = {
    openai: [
      'export OPENAI_API_KEY="sk-..."',
      '或在配置文件中设置: "api_key": "${OPENAI_API_KEY}"',
    ],
    anthropic: [
      'export ANTHROPIC_API_KEY="sk-ant-..."',
      '或在配置文件中设置: "api_key": "${ANTHROPIC_API_KEY}"',
    ],
    azure: [
      'export AZURE_OPENAI_ENDPOINT="https://..."',
      'export AZURE_OPENAI_API_KEY="..."',
    ],
  };
  
  return hints[provider] || [];
}
