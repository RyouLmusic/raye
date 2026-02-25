/**
 * CLI 配置类型定义
 * 
 * 这些类型定义了 CLI 工具使用的配置结构，
 * 与 Core 包的 AgentConfig 保持兼容
 */

import type { AgentConfig } from "core";

/**
 * CLI 配置文件结构
 * 
 * 存储在 .raya/config.json 中的配置格式
 */
export interface RayaConfig extends AgentConfig {
  // CLI 特定的配置可以在这里扩展
  // 例如：CLI 行为、日志级别等
}

/**
 * 配置加载选项
 */
export interface LoadOptions {
  /** 自定义配置文件路径 */
  configPath?: string;
  /** 是否验证配置 */
  validate?: boolean;
}

/**
 * 配置验证结果
 */
export interface ValidationResult {
  /** 配置是否有效 */
  valid: boolean;
  /** 验证错误列表 */
  errors: string[];
}

/**
 * 配置模板类型
 */
export type TemplateType = 'openai' | 'anthropic' | 'azure' | 'custom';
