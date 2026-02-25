/**
 * CLI 错误类型定义
 */

/**
 * 配置错误
 */
export class ConfigError extends Error {
  code: 'CONFIG_NOT_FOUND' | 'CONFIG_INVALID' | 'CONFIG_PARSE_ERROR';
  details?: string;
  
  constructor(
    code: 'CONFIG_NOT_FOUND' | 'CONFIG_INVALID' | 'CONFIG_PARSE_ERROR',
    message: string,
    details?: string
  ) {
    super(message);
    this.name = 'ConfigError';
    this.code = code;
    this.details = details;
  }
}

/**
 * 环境变量错误
 */
export class EnvError extends Error {
  code: 'ENV_VAR_MISSING' | 'ENV_VAR_INVALID';
  missingVars?: string[];
  
  constructor(
    code: 'ENV_VAR_MISSING' | 'ENV_VAR_INVALID',
    message: string,
    missingVars?: string[]
  ) {
    super(message);
    this.name = 'EnvError';
    this.code = code;
    this.missingVars = missingVars;
  }
}

/**
 * 工作目录错误
 */
export class WorkDirError extends Error {
  code: 'WORKDIR_NOT_FOUND' | 'WORKDIR_NO_PERMISSION';
  path?: string;
  
  constructor(
    code: 'WORKDIR_NOT_FOUND' | 'WORKDIR_NO_PERMISSION',
    message: string,
    path?: string
  ) {
    super(message);
    this.name = 'WorkDirError';
    this.code = code;
    this.path = path;
  }
}
