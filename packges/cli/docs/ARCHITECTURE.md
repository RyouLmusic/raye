# Raya CLI 架构设计

## 整体架构

### 分层设计

```
┌─────────────────────────────────────────────────────────┐
│                   CLI Layer (Entry)                     │
│  - 命令行参数解析 (Commander.js)                         │
│  - 全局命令注册                                          │
│  - 错误处理和日志                                        │
└─────────────────────────────────────────────────────────┘
                          │
                          ↓
┌─────────────────────────────────────────────────────────┐
│              Commands Layer (Business)                  │
│  - start: 启动 Agent                                     │
│  - init: 初始化配置                                      │
│  - config: 配置管理                                      │
└─────────────────────────────────────────────────────────┘
                          │
                          ↓
┌─────────────────────────────────────────────────────────┐
│               Utils Layer (Support)                     │
│  - config.ts: 配置加载和验证                             │
│  - workdir.ts: 工作目录管理                              │
│  - env.ts: 环境变量处理                                  │
│  - logger.ts: 日志工具                                   │
└─────────────────────────────────────────────────────────┘
                          │
                          ↓
┌─────────────────────────────────────────────────────────┐
│                  UI Package (TUI)                       │
│  - startTUI(): 启动 TUI 界面                             │
│  - 接收工作目录和配置                                    │
└─────────────────────────────────────────────────────────┘
                          │
                          ↓
┌─────────────────────────────────────────────────────────┐
│                 Core Package (Agent)                    │
│  - AgentLoop: 核心逻辑                                   │
│  - 工具调用                                              │
│  - 会话管理                                              │
└─────────────────────────────────────────────────────────┘
```

## 目录结构

```
packges/cli/
├── src/
│   ├── index.ts              # 入口文件，命令注册
│   ├── commands/             # 命令实现
│   │   ├── start.ts          # 启动命令
│   │   ├── init.ts           # 初始化命令
│   │   └── config.ts         # 配置命令
│   ├── utils/                # 工具函数
│   │   ├── config.ts         # 配置加载
│   │   ├── workdir.ts        # 工作目录
│   │   ├── env.ts            # 环境变量
│   │   ├── logger.ts         # 日志
│   │   └── validate.ts       # 验证
│   ├── templates/            # 配置模板
│   │   ├── openai.ts
│   │   ├── anthropic.ts
│   │   └── azure.ts
│   └── types/                # 类型定义
│       └── index.ts
├── test/                     # 测试文件
│   ├── unit/                 # 单元测试
│   ├── integration/          # 集成测试
│   └── e2e/                  # 端到端测试
├── docs/                     # 文档
│   ├── README.md
│   ├── ARCHITECTURE.md
│   ├── API.md
│   └── TASK.md
├── dist/                     # 构建输出
├── package.json
├── tsconfig.json
└── README.md
```

## 核心模块

### 1. 入口模块 (index.ts)

**职责：**
- 注册所有命令
- 解析命令行参数
- 全局错误处理
- 版本信息管理

**依赖：**
- commander: 命令行解析
- chalk: 终端颜色
- commands/*: 各个命令实现

**接口：**
```typescript
// 无导出，直接执行
```

### 2. 启动命令 (commands/start.ts)

**职责：**
- 获取当前工作目录
- 加载配置文件
- 处理命令行参数覆盖
- 启动 TUI

**依赖：**
- ui: startTUI
- utils/config: loadConfig
- utils/workdir: getWorkDir

**接口：**
```typescript
export async function startAgent(options: StartOptions): Promise<void>

interface StartOptions {
  config?: string;
  model?: string;
  verbose?: boolean;
  session?: string;
}
```

### 3. 初始化命令 (commands/init.ts)

**职责：**
- 交互式配置创建
- 模板选择
- 配置文件写入
- .gitignore 创建

**依赖：**
- inquirer: 交互式提示
- templates/*: 配置模板
- utils/validate: 配置验证

**接口：**
```typescript
export async function initConfig(options: InitOptions): Promise<void>

interface InitOptions {
  force?: boolean;
  template?: string;
}
```

### 4. 配置管理 (commands/config.ts)

**职责：**
- 显示当前配置
- 编辑配置文件
- 验证配置格式
- 显示配置路径

**依赖：**
- utils/config: loadConfig, validateConfig
- utils/editor: openInEditor

**接口：**
```typescript
export async function manageConfig(options: ConfigOptions): Promise<void>

interface ConfigOptions {
  show?: boolean;
  edit?: boolean;
  validate?: boolean;
  path?: boolean;
}
```

### 5. 配置加载 (utils/config.ts)

**职责：**
- 查找配置文件（向上查找）
- 解析 JSON 配置
- 环境变量替换
- 配置合并（默认 + 文件 + 命令行）

**依赖：**
- fs/promises: 文件操作
- utils/env: 环境变量处理
- utils/validate: 配置验证

**接口：**
```typescript
export async function loadConfig(
  workDir: string,
  options?: LoadOptions
): Promise<AgentConfig>

export async function findConfig(
  startDir: string
): Promise<string | null>

export function mergeConfig(
  base: Partial<AgentConfig>,
  override: Partial<AgentConfig>
): AgentConfig
```

### 6. 工作目录管理 (utils/workdir.ts)

**职责：**
- 获取当前工作目录
- 验证目录权限
- 规范化路径

**接口：**
```typescript
export function getWorkDir(): string
export function validateWorkDir(dir: string): boolean
export function normalizePath(path: string): string
```

### 7. 环境变量处理 (utils/env.ts)

**职责：**
- 替换配置中的环境变量
- 验证必需的环境变量
- 提供环境变量提示

**接口：**
```typescript
export function replaceEnvVars(obj: any): any
export function validateEnvVars(config: AgentConfig): string[]
export function getEnvVarHints(provider: string): string[]
```

## 数据流

### 启动流程

```
用户执行 raya
    ↓
index.ts 解析命令
    ↓
commands/start.ts
    ↓
获取工作目录 (process.cwd())
    ↓
查找配置文件 (.raya/config.json)
    ↓
加载并解析配置
    ↓
替换环境变量
    ↓
合并命令行参数
    ↓
验证配置
    ↓
调用 startTUI({ workDir, config })
    ↓
TUI 启动，传递给 AgentLoop
    ↓
Agent 在 workDir 中工作
```

### 配置加载流程

```
loadConfig(workDir)
    ↓
findConfig(workDir)
    ↓
向上查找 .raya/config.json
    ↓
找到 → 读取文件
    ↓
解析 JSON
    ↓
replaceEnvVars(config)
    ↓
validateConfig(config)
    ↓
返回 AgentConfig
```

### 初始化流程

```
raya init
    ↓
检查是否已存在配置
    ↓
存在 → 询问是否覆盖
    ↓
选择模板（openai/anthropic/azure/custom）
    ↓
交互式输入配置项
    ↓
验证配置
    ↓
创建 .raya/ 目录
    ↓
写入 config.json
    ↓
创建 .gitignore
    ↓
显示成功信息和下一步提示
```

## 错误处理

### 错误类型

```typescript
// 配置错误
class ConfigError extends Error {
  code: 'CONFIG_NOT_FOUND' | 'CONFIG_INVALID' | 'CONFIG_PARSE_ERROR'
}

// 环境变量错误
class EnvError extends Error {
  code: 'ENV_VAR_MISSING' | 'ENV_VAR_INVALID'
}

// 工作目录错误
class WorkDirError extends Error {
  code: 'WORKDIR_NOT_FOUND' | 'WORKDIR_NO_PERMISSION'
}
```

### 错误处理策略

```typescript
try {
  const config = await loadConfig(workDir);
} catch (error) {
  if (error instanceof ConfigError) {
    if (error.code === 'CONFIG_NOT_FOUND') {
      console.log(chalk.yellow('配置文件未找到'));
      console.log(chalk.cyan('请运行: raya init'));
      process.exit(1);
    }
  }
  // 其他错误处理
}
```

## 配置系统

### 配置优先级

```
命令行参数 > 配置文件 > 默认值
```

### 配置合并示例

```typescript
const defaultConfig = {
  max_retries: 3,
  timeout: 30000,
};

const fileConfig = {
  model: 'gpt-4',
  api_key: '${OPENAI_API_KEY}',
};

const cliConfig = {
  model: 'gpt-4-turbo', // 覆盖文件配置
};

const finalConfig = mergeConfig(
  defaultConfig,
  fileConfig,
  cliConfig
);
// 结果: { max_retries: 3, timeout: 30000, model: 'gpt-4-turbo', api_key: 'sk-...' }
```

## 扩展点

### 1. 添加新命令

```typescript
// src/commands/my-command.ts
export async function myCommand(options: MyOptions) {
  // 实现
}

// src/index.ts
program
  .command('my-command')
  .description('...')
  .action(myCommand);
```

### 2. 添加新模板

```typescript
// src/templates/my-provider.ts
export const myProviderTemplate = {
  name: 'my-agent',
  provider: 'my-provider',
  // ...
};

// src/commands/init.ts
const templates = {
  // ...
  'my-provider': myProviderTemplate,
};
```

### 3. 添加新的配置验证规则

```typescript
// src/utils/validate.ts
export function validateConfig(config: AgentConfig): ValidationResult {
  const errors: string[] = [];
  
  // 添加新的验证规则
  if (config.custom_field && !isValid(config.custom_field)) {
    errors.push('custom_field is invalid');
  }
  
  return { valid: errors.length === 0, errors };
}
```

## 性能考虑

### 1. 配置缓存

```typescript
// 缓存已加载的配置，避免重复读取
const configCache = new Map<string, AgentConfig>();

export async function loadConfig(workDir: string) {
  if (configCache.has(workDir)) {
    return configCache.get(workDir)!;
  }
  
  const config = await loadConfigFromFile(workDir);
  configCache.set(workDir, config);
  return config;
}
```

### 2. 懒加载

```typescript
// 只在需要时加载大型依赖
export async function startAgent(options: StartOptions) {
  // 延迟加载 TUI
  const { startTUI } = await import('ui');
  await startTUI(options);
}
```

### 3. 并行处理

```typescript
// 并行执行独立任务
const [config, workDir, envVars] = await Promise.all([
  loadConfig(process.cwd()),
  validateWorkDir(process.cwd()),
  loadEnvVars(),
]);
```

## 安全考虑

### 1. 敏感信息保护

```typescript
// 不在日志中输出敏感信息
function sanitizeConfig(config: AgentConfig) {
  return {
    ...config,
    api_key: config.api_key ? '***' : undefined,
  };
}

console.log('Config:', sanitizeConfig(config));
```

### 2. 路径验证

```typescript
// 防止路径遍历攻击
function validatePath(path: string): boolean {
  const normalized = normalizePath(path);
  return !normalized.includes('..');
}
```

### 3. 配置文件权限

```typescript
// 创建配置文件时设置适当权限
await fs.writeFile(configPath, content, {
  mode: 0o600, // 只有所有者可读写
});
```

## 测试策略

### 1. 单元测试

```typescript
// test/unit/config.test.ts
describe('loadConfig', () => {
  it('should load config from file', async () => {
    const config = await loadConfig('/tmp/test');
    expect(config.model).toBe('gpt-4');
  });
});
```

### 2. 集成测试

```typescript
// test/integration/cli.test.ts
describe('CLI integration', () => {
  it('should start agent with config', async () => {
    const result = await exec('raya --config test-config.json');
    expect(result.exitCode).toBe(0);
  });
});
```

### 3. E2E 测试

```bash
# test/e2e/test-cli.sh
cd /tmp/test-project
raya init --force
raya --version
```

## 日志系统

### 日志级别

```typescript
enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
}

// 使用
logger.debug('Loading config from:', configPath);
logger.info('Agent started');
logger.warn('Config file not found');
logger.error('Failed to start agent:', error);
```

### 日志格式

```
[2024-02-23 10:30:45] [INFO] Agent started in /home/user/project
[2024-02-23 10:30:46] [DEBUG] Config loaded: { model: 'gpt-4', ... }
```

## 依赖管理

### 核心依赖

- `commander`: 命令行解析
- `inquirer`: 交互式提示
- `chalk`: 终端颜色
- `ora`: 加载动画

### 内部依赖

- `ui`: TUI 界面
- `core`: Agent 核心

### 依赖注入

```typescript
// 便于测试和扩展
interface Dependencies {
  loadConfig: (dir: string) => Promise<AgentConfig>;
  startTUI: (options: any) => Promise<void>;
}

export function createCLI(deps: Dependencies) {
  // 使用注入的依赖
}
```

## 版本管理

### 语义化版本

```
MAJOR.MINOR.PATCH
1.0.0 → 初始版本
1.1.0 → 添加新功能
1.1.1 → 修复 bug
2.0.0 → 破坏性更新
```

### 版本兼容性

```typescript
// 检查配置文件版本
function checkConfigVersion(config: AgentConfig) {
  if (config.version && !isCompatible(config.version)) {
    throw new Error('Config version incompatible');
  }
}
```
