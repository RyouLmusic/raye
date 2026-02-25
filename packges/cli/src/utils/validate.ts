import type { ConnectionConfig } from 'ui';
import type { ValidationResult } from '../types/config';

/**
 * 验证配置格式和必需字段
 * 
 * @param config - 连接配置对象
 * @returns 验证结果
 */
export function validateConfig(config: any): ValidationResult {
  const errors: string[] = [];
  
  // 验证必需字段
  if (!config.name || typeof config.name !== 'string') {
    errors.push('缺少必需字段: name');
  }
  
  if (!config.base_url || typeof config.base_url !== 'string') {
    errors.push('缺少必需字段: base_url');
  }
  
  if (!config.api_key || typeof config.api_key !== 'string') {
    errors.push('缺少必需字段: api_key');
  }
  
  if (!config.model || typeof config.model !== 'string') {
    errors.push('缺少必需字段: model');
  }
  
  // 验证 base_url 格式
  if (config.base_url) {
    try {
      new URL(config.base_url);
    } catch {
      errors.push('base_url 格式无效，必须是有效的 URL');
    }
  }
  
  // 验证 max_retries
  if (config.max_retries !== undefined) {
    if (typeof config.max_retries !== 'number' || config.max_retries < 0) {
      errors.push('max_retries 必须是非负整数');
    }
  }
  
  // 验证 timeout
  if (config.timeout !== undefined) {
    if (typeof config.timeout !== 'number' || config.timeout < 0) {
      errors.push('timeout 必须是非负整数');
    }
  }
  
  return {
    valid: errors.length === 0,
    errors,
  };
}
