# Common Package

共享工具函数和类型定义包，供其他包（CLI、UI、Core）使用。

## 功能

### Logger（日志工具）

提供统一的日志功能，支持不同日志级别和颜色输出。

#### 特性

- 支持多种日志级别（DEBUG、INFO、WARN、ERROR）
- 彩色输出（使用 chalk）
- 支持日志前缀
- 向后兼容旧版本 API
- 敏感信息脱敏

#### 使用方法

**旧版本用法（向后兼容）：**

```typescript
import { createLogger } from 'common';

// 启用调试日志
const logger = createLogger('AgentLoop', true);
logger.log('调试消息');    // 只在 debug=true 时输出
logger.info('信息消息');   // 始终输出
logger.warn('警告消息');   // 始终输出
logger.error('错误消息');  // 始终输出

// 禁用调试日志
const logger2 = createLogger('AgentLoop', false);
logger2.log('不会显示');   // 不会输出
```

**新版本用法：**

```typescript
import { createLogger, LogLevel } from 'common';

// 使用 verbose 选项
const logger = createLogger({ 
  verbose: true, 
  prefix: 'MyModule' 
});
logger.debug('调试消息');  // 会输出（带颜色）
logger.info('信息消息');   // 会输出（带颜色）
logger.warn('警告消息');   // 会输出（带颜色）
logger.error('错误消息');  // 会输出（带颜色）

// 使用 LogLevel
const logger2 = createLogger({ 
  level: LogLevel.WARN, 
  prefix: 'Critical' 
});
logger2.debug('不会显示');  // 不会输出
logger2.info('不会显示');   // 不会输出
logger2.warn('警告消息');   // 会输出
logger2.error('错误消息');  // 会输出
```

**敏感信息脱敏：**

```typescript
import { sanitizeConfig } from 'common';

const config = {
  api_key: 'sk-1234567890abcdef',
  base_url: 'https://api.openai.com/v1'
};

const sanitized = sanitizeConfig(config);
console.log(sanitized.api_key);  // 输出: sk-1...cdef
```

### 其他工具函数

```typescript
import { formatDate, sleep } from 'common';

// 格式化日期
const dateStr = formatDate(new Date());  // ISO 8601 格式

// 延迟执行
await sleep(1000);  // 等待 1 秒
```

## 依赖

- `chalk`: 终端颜色输出

## 开发

```bash
# 安装依赖
bun install

# 运行测试
bun test

# 构建
bun run build
```

## 向后兼容性

Logger 完全向后兼容旧版本 API。现有代码无需修改即可继续使用：

```typescript
// 旧代码仍然可以正常工作
const logger = createLogger('ModuleName', debug);
logger.log('message');
```

同时也支持新的 API：

```typescript
// 新代码可以使用更强大的功能
const logger = createLogger({ verbose: true, prefix: 'ModuleName' });
logger.debug('message');
```
