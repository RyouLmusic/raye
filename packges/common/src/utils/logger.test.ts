import { describe, test, expect } from 'bun:test';
import { createLogger, LogLevel, Logger } from './logger';

describe('Logger - 向后兼容性测试', () => {
  test('旧版本调用方式：createLogger(prefix, debug=true)', () => {
    const logger = createLogger('TestPrefix', true);
    
    // 旧版本返回的对象应该有这些方法
    expect(typeof logger.log).toBe('function');
    expect(typeof logger.info).toBe('function');
    expect(typeof logger.warn).toBe('function');
    expect(typeof logger.error).toBe('function');
  });

  test('旧版本调用方式：createLogger(prefix, debug=false)', () => {
    const logger = createLogger('TestPrefix', false);
    
    // debug=false 时，log 方法不应该输出（但方法仍然存在）
    expect(typeof logger.log).toBe('function');
    expect(typeof logger.info).toBe('function');
    expect(typeof logger.warn).toBe('function');
    expect(typeof logger.error).toBe('function');
  });

  test('新版本调用方式：createLogger({ verbose: true })', () => {
    const logger = createLogger({ verbose: true });
    
    // 新版本返回 Logger 实例
    expect(logger).toBeInstanceOf(Logger);
    expect(typeof logger.debug).toBe('function');
    expect(typeof logger.info).toBe('function');
    expect(typeof logger.warn).toBe('function');
    expect(typeof logger.error).toBe('function');
  });

  test('新版本调用方式：createLogger({ verbose: false })', () => {
    const logger = createLogger({ verbose: false });
    
    expect(logger).toBeInstanceOf(Logger);
  });

  test('新版本调用方式：带前缀', () => {
    const logger = createLogger({ verbose: true, prefix: 'MyPrefix' });
    
    expect(logger).toBeInstanceOf(Logger);
  });

  test('默认调用：createLogger()', () => {
    const logger = createLogger();
    
    // 不传参数时，应该返回 Logger 实例
    expect(logger).toBeInstanceOf(Logger);
  });
});
