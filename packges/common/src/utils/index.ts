// 工具函数示例
export function formatDate(date: Date): string {
    return date.toISOString();
}

export function sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * 创建一个带 debug 控制的日志器
 * 
 * @param prefix - 日志前缀（如 "AgentLoop", "Executor"）
 * @param debug - 是否启用调试日志
 * @returns 日志器对象
 * 
 * @example
 * ```ts
 * const logger = createLogger("AgentLoop", debug);
 * logger.log("初始化成功");  // 只在 debug=true 时输出
 * logger.warn("警告信息");   // 始终输出
 * logger.error("错误信息");  // 始终输出
 * ```
 */
export function createLogger(prefix: string, debug: boolean) {
    return {
        /**
         * 调试日志 - 仅在 debug=true 时输出
         */
        log: (...args: any[]) => {
            if (debug) {
                console.log(`[${prefix}]`, ...args);
            }
        },
        
        /**
         * 警告日志 - 始终输出
         */
        warn: (...args: any[]) => {
            console.warn(`[${prefix}]`, ...args);
        },
        
        /**
         * 错误日志 - 始终输出
         */
        error: (...args: any[]) => {
            console.error(`[${prefix}]`, ...args);
        },
        
        /**
         * 信息日志 - 始终输出
         */
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
