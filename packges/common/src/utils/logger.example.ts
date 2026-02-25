/**
 * Logger 使用示例
 */

import { createLogger, LogLevel } from './logger';

// ============ 旧版本用法（向后兼容）============

// 示例 1：启用调试日志
const logger1 = createLogger('AgentLoop', true);
logger1.log('这条消息会显示');  // 会输出
logger1.info('信息消息');        // 会输出
logger1.warn('警告消息');        // 会输出
logger1.error('错误消息');       // 会输出

// 示例 2：禁用调试日志
const logger2 = createLogger('AgentLoop', false);
logger2.log('这条消息不会显示');  // 不会输出
logger2.info('信息消息');          // 会输出
logger2.warn('警告消息');          // 会输出
logger2.error('错误消息');         // 会输出

// ============ 新版本用法 ============

// 示例 3：使用 verbose 选项
const logger3 = createLogger({ verbose: true, prefix: 'MyModule' });
logger3.debug('调试消息');  // 会输出（带颜色）
logger3.info('信息消息');   // 会输出（带颜色）
logger3.warn('警告消息');   // 会输出（带颜色）
logger3.error('错误消息');  // 会输出（带颜色）

// 示例 4：使用 LogLevel
const logger4 = createLogger({ level: LogLevel.WARN, prefix: 'Critical' });
logger4.debug('不会显示');  // 不会输出
logger4.info('不会显示');   // 不会输出
logger4.warn('警告消息');   // 会输出
logger4.error('错误消息');  // 会输出

// 示例 5：默认配置
const logger5 = createLogger();
logger5.debug('不会显示');  // 不会输出（默认 INFO 级别）
logger5.info('信息消息');   // 会输出

// ============ 实际使用场景 ============

// 场景 1：在 Core 包中（旧版本）
function oldStyleUsage() {
  const debug = process.env.RAYE_DEBUG === '1';
  const logger = createLogger('AgentLoop', debug);
  
  logger.log('开始处理...');  // 只在 debug=true 时输出
  logger.info('处理完成');    // 始终输出
}

// 场景 2：在 CLI 包中（新版本）
function newStyleUsage(verbose: boolean) {
  const logger = createLogger({ verbose, prefix: 'CLI' });
  
  logger.debug('详细调试信息');  // 只在 verbose=true 时输出
  logger.info('正在加载配置...');
  logger.warn('配置文件未找到');
  logger.error('加载失败');
}

export { oldStyleUsage, newStyleUsage };
