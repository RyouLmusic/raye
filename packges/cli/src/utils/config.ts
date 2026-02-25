import fs from 'fs/promises';
import path from 'path';
import type { ConnectionConfig } from 'ui';
import { replaceEnvVars } from './env';
import { validateConfig } from './validate';
import { ConfigError } from '../types/error';

export interface LoadOptions {
  configPath?: string;  // 自定义配置路径
  validate?: boolean;   // 是否验证配置
}

/**
 * 加载配置文件
 * 
 * @param workDir - 工作目录
 * @param options - 加载选项
 * @returns 连接配置对象
 */
export async function loadConfig(
  workDir: string,
  options: LoadOptions = {}
): Promise<ConnectionConfig> {
  // 1. 查找配置文件
  let configPath: string | null;
  
  if (options.configPath) {
    // 使用指定路径
    configPath = path.resolve(options.configPath);
  } else {
    // 向上查找
    configPath = await findConfig(workDir);
  }
  
  if (!configPath) {
    throw new ConfigError(
      'CONFIG_NOT_FOUND',
      '配置文件未找到，请运行: raya init'
    );
  }
  
  // 2. 读取文件
  const content = await fs.readFile(configPath, 'utf-8');
  
  // 3. 解析 JSON
  let config: any;
  try {
    config = JSON.parse(content);
  } catch (error) {
    throw new ConfigError(
      'CONFIG_PARSE_ERROR',
      `配置文件解析失败: ${(error as Error).message}`
    );
  }
  
  // 4. 替换环境变量
  const replaced = replaceEnvVars(config);
  
  // 5. 验证配置
  if (options.validate !== false) {
    const validation = validateConfig(replaced);
    if (!validation.valid) {
      throw new ConfigError(
        'CONFIG_INVALID',
        `配置验证失败:\n${validation.errors.map(e => `  - ${e}`).join('\n')}`
      );
    }
  }
  
  return replaced as ConnectionConfig;
}

/**
 * 向上递归查找配置文件
 * 
 * @param startDir - 起始目录
 * @returns 配置文件路径或 null
 */
export async function findConfig(startDir: string): Promise<string | null> {
  let currentDir = path.resolve(startDir);
  
  while (true) {
    const configPath = path.join(currentDir, '.raya', 'config.json');
    
    try {
      await fs.access(configPath);
      return configPath;
    } catch {
      // 文件不存在，继续向上查找
    }
    
    const parentDir = path.dirname(currentDir);
    
    // 到达根目录
    if (parentDir === currentDir) {
      return null;
    }
    
    currentDir = parentDir;
  }
}

/**
 * 合并配置对象（深度合并）
 * 
 * @param base - 基础配置
 * @param override - 覆盖配置
 * @returns 合并后的配置
 */
export function mergeConfig(
  base: Partial<ConnectionConfig>,
  override: Partial<ConnectionConfig>
): ConnectionConfig {
  // 简单的深度合并实现
  const result = { ...base };
  
  for (const [key, value] of Object.entries(override)) {
    if (value === undefined) continue;
    
    if (typeof value === 'object' && !Array.isArray(value) && value !== null) {
      // 递归合并对象
      result[key as keyof ConnectionConfig] = {
        ...(result[key as keyof ConnectionConfig] as any),
        ...value,
      } as any;
    } else {
      // 直接覆盖
      result[key as keyof ConnectionConfig] = value as any;
    }
  }
  
  return result as ConnectionConfig;
}
