import chalk from 'chalk';

export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
}

export class Logger {
  constructor(
    private level: LogLevel = LogLevel.INFO,
    private prefix?: string
  ) {}

  debug(message: string, ...args: any[]): void {
    if (this.level <= LogLevel.DEBUG) {
      const prefixStr = this.prefix ? `[${this.prefix}] ` : '';
      console.log(chalk.gray(`${prefixStr}[DEBUG] ${message}`), ...args);
    }
  }

  info(message: string, ...args: any[]): void {
    if (this.level <= LogLevel.INFO) {
      const prefixStr = this.prefix ? `[${this.prefix}] ` : '';
      console.log(chalk.blue(`${prefixStr}[INFO] ${message}`), ...args);
    }
  }

  warn(message: string, ...args: any[]): void {
    if (this.level <= LogLevel.WARN) {
      const prefixStr = this.prefix ? `[${this.prefix}] ` : '';
      console.warn(chalk.yellow(`${prefixStr}[WARN] ${message}`), ...args);
    }
  }

  error(message: string, ...args: any[]): void {
    if (this.level <= LogLevel.ERROR) {
      const prefixStr = this.prefix ? `[${this.prefix}] ` : '';
      console.error(chalk.red(`${prefixStr}[ERROR] ${message}`), ...args);
    }
  }

  /**
   * 通用日志方法（用于向后兼容）
   */
  log(...args: any[]): void {
    if (this.level <= LogLevel.DEBUG) {
      const prefixStr = this.prefix ? `[${this.prefix}]` : '';
      console.log(prefixStr, ...args);
    }
  }
}

/**
 * 创建日志器（支持两种调用方式）
 * 
 * 方式 1（旧版本，向后兼容）:
 * ```ts
 * const logger = createLogger("AgentLoop", debug);
 * logger.log("message");  // 只在 debug=true 时输出
 * ```
 * 
 * 方式 2（新版本）:
 * ```ts
 * const logger = createLogger({ verbose: true, prefix: "AgentLoop" });
 * logger.debug("message");
 * ```
 * 
 * @param prefixOrOptions - 日志前缀（字符串）或配置选项（对象）
 * @param debug - 是否启用调试日志（仅在第一个参数为字符串时使用）
 * @returns Logger 实例或旧版日志器对象
 */
export function createLogger(
  prefixOrOptions?: string | {
    verbose?: boolean;
    prefix?: string;
    level?: LogLevel;
  },
  debug?: boolean
): Logger | ReturnType<typeof createPrefixLogger> {
  // 旧版本调用方式：createLogger(prefix, debug)
  if (typeof prefixOrOptions === 'string') {
    return createPrefixLogger(prefixOrOptions, debug ?? false);
  }
  
  // 新版本调用方式：createLogger({ verbose, prefix, level })
  const options = prefixOrOptions;
  const level = options?.level ?? (options?.verbose ? LogLevel.DEBUG : LogLevel.INFO);
  return new Logger(level, options?.prefix);
}

/**
 * 创建带前缀的日志器（向后兼容旧版本）
 * 
 * @param prefix - 日志前缀（如 "AgentLoop", "Executor"）
 * @param debug - 是否启用调试日志
 * @returns 日志器对象
 * 
 * @example
 * ```ts
 * const logger = createPrefixLogger("AgentLoop", debug);
 * logger.log("初始化成功");  // 只在 debug=true 时输出
 * logger.warn("警告信息");   // 始终输出
 * logger.error("错误信息");  // 始终输出
 * ```
 */
export function createPrefixLogger(prefix: string, debug: boolean) {
  const logger = new Logger(debug ? LogLevel.DEBUG : LogLevel.INFO, prefix);
  
  return {
    log: (...args: any[]) => {
      if (debug) {
        console.log(`[${prefix}]`, ...args);
      }
    },
    warn: (...args: any[]) => {
      console.warn(`[${prefix}]`, ...args);
    },
    error: (...args: any[]) => {
      console.error(`[${prefix}]`, ...args);
    },
    info: (...args: any[]) => {
      console.log(`[${prefix}]`, ...args);
    }
  };
}

/**
 * 创建一个条件日志器（更轻量，不带前缀）
 * 
 * @param debug - 是否启用调试日志
 * @returns 日志函数
 * 
 * @example
 * ```ts
 * const log = createConditionalLogger(debug);
 * log("[AgentLoop] 初始化成功");  // 只在 debug=true 时输出
 * ```
 */
export function createConditionalLogger(debug: boolean) {
  return (...args: any[]) => {
    if (debug) {
      console.log(...args);
    }
  };
}

/**
 * 隐藏配置中的敏感信息
 * 
 * @param config - 配置对象
 * @returns 脱敏后的配置
 */
export function sanitizeConfig(config: any): any {
  const sanitized = { ...config };
  
  // 隐藏 API 密钥
  if (sanitized.api_key) {
    const key = sanitized.api_key;
    if (key.length > 8) {
      sanitized.api_key = `${key.substring(0, 4)}...${key.substring(key.length - 4)}`;
    } else {
      sanitized.api_key = '***';
    }
  }
  
  return sanitized;
}
