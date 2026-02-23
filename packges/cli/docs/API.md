# Raya CLI API 文档

## 命令行 API

### `raya [start]`

启动 Raya Agent（默认命令）

#### 语法

```bash
raya [options]
raya start [options]
```

#### 选项

| 选项 | 简写 | 类型 | 默认值 | 说明 |
|------|------|------|--------|------|
| `--config` | `-c` | string | `.raya/config.json` | 配置文件路径 |
| `--model` | `-m` | string | - | 覆盖配置中的模型 |
| `--verbose` | `-v` | boolean | false | 显示详细日志 |
| `--session` | `-s` | string | auto | 指定会话 ID |

#### 示例

```bash
# 基本用法
raya

# 指定配置文件
raya --config ./custom-config.json

# 使用不同模型
raya --model gpt-4-turbo

# 显示详细日志
raya --verbose

# 恢复会话
raya --session session-123
```

---

### `raya init`

初始化配置文件

#### 语法

```bash
raya init [options]
```

#### 选项

| 选项 | 简写 | 类型 | 默认值 | 说明 |
|------|------|------|--------|------|
| `--force` | `-f` | boolean | false | 强制覆盖已存在的配置 |
| `--template` | `-t` | string | - | 使用预设模板 |

#### 模板选项

- `openai` - OpenAI GPT 模型
- `anthropic` - Anthropic Claude 模型
- `azure` - Azure OpenAI
- `custom` - 自定义 API

#### 示例

```bash
# 交互式初始化
raya init

# 强制覆盖
raya init --force

# 使用模板
raya init --template openai
raya init --template anthropic
```

---

### `raya config`

管理配置

#### 语法

```bash
raya config [options]
```

#### 选项

| 选项 | 简写 | 类型 | 默认值 | 说明 |
|------|------|------|--------|------|
| `--show` | `-s` | boolean | false | 显示当前配置 |
| `--edit` | `-e` | boolean | false | 编辑配置文件 |
| `--validate` | `-v` | boolean | false | 验证配置格式 |
| `--path` | `-p` | boolean | false | 显示配置文件路径 |

#### 示例

```bash
# 显示配置
raya config --show

# 编辑配置
raya config --edit

# 验证配置
raya config --validate

# 显示路径
raya config --path
```

---

### `raya version`

显示版本信息

#### 语法

```bash
raya version
raya --version
raya -v
```

#### 输出

```
Raya CLI v0.1.0
```

---

### `raya help`

显示帮助信息

#### 语法

```bash
raya help [command]
raya --help
raya -h
```

#### 示例

```bash
# 显示所有命令
raya help

# 显示特定命令帮助
raya help init
raya help config
```

---

## 编程 API

### startAgent

启动 Agent

```typescript
import { startAgent } from '@raye/cli';

await startAgent({
  config: './config.json',
  model: 'gpt-4',
  verbose: true,
  session: 'my-session',
});
```

#### 参数

```typescript
interface StartOptions {
  config?: string;      // 配置文件路径
  model?: string;       // 模型名称
  verbose?: boolean;    // 详细日志
  session?: string;     // 会话 ID
}
```

#### 返回值

```typescript
Promise<void>
```

---

### initConfig

初始化配置

```typescript
import { initConfig } from '@raye/cli';

await initConfig({
  force: true,
  template: 'openai',
});
```

#### 参数

```typescript
interface InitOptions {
  force?: boolean;      // 强制覆盖
  template?: string;    // 模板名称
}
```

#### 返回值

```typescript
Promise<void>
```

---

### loadConfig

加载配置文件

```typescript
import { loadConfig } from '@raye/cli/utils';

const config = await loadConfig('/path/to/workdir');
```

#### 参数

```typescript
loadConfig(workDir: string, options?: LoadOptions): Promise<AgentConfig>

interface LoadOptions {
  configPath?: string;  // 自定义配置路径
  validate?: boolean;   // 是否验证配置
}
```

#### 返回值

```typescript
interface AgentConfig {
  name: string;
  version: string;
  description: string;
  base_url: string;
  api_key: string;
  model: string;
  model_id: string;
  provider: string;
  extra_body: Record<string, any>;
  tools: string[];
  mcp: Record<string, any>;
  max_retries: number;
  timeout: number;
  prompt?: string;
}
```

---

### findConfig

查找配置文件

```typescript
import { findConfig } from '@raye/cli/utils';

const configPath = await findConfig('/path/to/start');
```

#### 参数

```typescript
findConfig(startDir: string): Promise<string | null>
```

#### 返回值

- 找到：返回配置文件的绝对路径
- 未找到：返回 `null`

---

### mergeConfig

合并配置

```typescript
import { mergeConfig } from '@raye/cli/utils';

const merged = mergeConfig(baseConfig, overrideConfig);
```

#### 参数

```typescript
mergeConfig(
  base: Partial<AgentConfig>,
  override: Partial<AgentConfig>
): AgentConfig
```

#### 返回值

```typescript
AgentConfig
```

---

### validateConfig

验证配置

```typescript
import { validateConfig } from '@raye/cli/utils';

const result = validateConfig(config);
if (!result.valid) {
  console.error('Errors:', result.errors);
}
```

#### 参数

```typescript
validateConfig(config: AgentConfig): ValidationResult

interface ValidationResult {
  valid: boolean;
  errors: string[];
}
```

---

### replaceEnvVars

替换环境变量

```typescript
import { replaceEnvVars } from '@raye/cli/utils';

const config = {
  api_key: '${OPENAI_API_KEY}',
  base_url: '${API_URL}',
};

const replaced = replaceEnvVars(config);
// { api_key: 'sk-...', base_url: 'https://...' }
```

#### 参数

```typescript
replaceEnvVars(obj: any): any
```

#### 返回值

替换后的对象

---

### getWorkDir

获取工作目录

```typescript
import { getWorkDir } from '@raye/cli/utils';

const workDir = getWorkDir();
// '/home/user/project'
```

#### 返回值

```typescript
string
```

---

### validateWorkDir

验证工作目录

```typescript
import { validateWorkDir } from '@raye/cli/utils';

const isValid = validateWorkDir('/path/to/dir');
```

#### 参数

```typescript
validateWorkDir(dir: string): boolean
```

#### 返回值

- `true`: 目录有效
- `false`: 目录无效

---

## 配置文件 API

### 配置文件格式

```json
{
  "name": "my-agent",
  "version": "1.0.0",
  "description": "My AI Agent",
  "base_url": "https://api.openai.com/v1",
  "api_key": "${OPENAI_API_KEY}",
  "model": "gpt-4",
  "model_id": "gpt-4-0613",
  "provider": "openai",
  "extra_body": {},
  "tools": ["calculator", "search"],
  "mcp": {},
  "max_retries": 3,
  "timeout": 30000,
  "prompt": "You are a helpful AI assistant."
}
```

### 字段说明

| 字段 | 类型 | 必需 | 说明 |
|------|------|------|------|
| `name` | string | ✅ | Agent 名称 |
| `version` | string | ✅ | 配置版本 |
| `description` | string | ❌ | Agent 描述 |
| `base_url` | string | ✅ | API 基础 URL |
| `api_key` | string | ✅ | API 密钥（支持环境变量） |
| `model` | string | ✅ | 模型名称 |
| `model_id` | string | ✅ | 模型 ID |
| `provider` | string | ✅ | 提供商（openai/anthropic/azure/custom） |
| `extra_body` | object | ❌ | 额外的请求参数 |
| `tools` | string[] | ❌ | 启用的工具列表 |
| `mcp` | object | ❌ | MCP 配置 |
| `max_retries` | number | ❌ | 最大重试次数（默认：3） |
| `timeout` | number | ❌ | 超时时间（毫秒，默认：30000） |
| `prompt` | string | ❌ | 系统提示词 |

---

## 环境变量 API

### 支持的环境变量

| 变量名 | 说明 | 示例 |
|--------|------|------|
| `OPENAI_API_KEY` | OpenAI API 密钥 | `sk-...` |
| `ANTHROPIC_API_KEY` | Anthropic API 密钥 | `sk-ant-...` |
| `AZURE_OPENAI_ENDPOINT` | Azure OpenAI 端点 | `https://...` |
| `AZURE_OPENAI_API_KEY` | Azure OpenAI 密钥 | `...` |
| `RAYA_CONFIG_PATH` | 自定义配置路径 | `~/.raya/config.json` |
| `RAYA_LOG_LEVEL` | 日志级别 | `debug/info/warn/error` |
| `RAYA_HISTORY_DIR` | 会话历史目录 | `~/.raya/history` |

### 使用方式

```bash
# 设置环境变量
export OPENAI_API_KEY="sk-..."
export RAYA_LOG_LEVEL="debug"

# 在配置文件中引用
{
  "api_key": "${OPENAI_API_KEY}"
}
```

---

## 错误代码

### 配置错误

| 代码 | 说明 |
|------|------|
| `CONFIG_NOT_FOUND` | 配置文件未找到 |
| `CONFIG_INVALID` | 配置格式无效 |
| `CONFIG_PARSE_ERROR` | 配置解析错误 |

### 环境变量错误

| 代码 | 说明 |
|------|------|
| `ENV_VAR_MISSING` | 必需的环境变量缺失 |
| `ENV_VAR_INVALID` | 环境变量值无效 |

### 工作目录错误

| 代码 | 说明 |
|------|------|
| `WORKDIR_NOT_FOUND` | 工作目录不存在 |
| `WORKDIR_NO_PERMISSION` | 工作目录无权限 |

---

## 事件 API

### 生命周期事件

```typescript
import { on } from '@raye/cli';

// Agent 启动前
on('before:start', (options) => {
  console.log('Starting agent with:', options);
});

// Agent 启动后
on('after:start', () => {
  console.log('Agent started');
});

// 配置加载后
on('config:loaded', (config) => {
  console.log('Config loaded:', config);
});

// 错误发生时
on('error', (error) => {
  console.error('Error:', error);
});
```

---

## 插件 API

### 创建插件

```typescript
import { definePlugin } from '@raye/cli';

export default definePlugin({
  name: 'my-plugin',
  version: '1.0.0',
  
  // 注册命令
  commands: [
    {
      name: 'my-command',
      description: 'My custom command',
      action: async (options) => {
        // 实现
      },
    },
  ],
  
  // 注册钩子
  hooks: {
    'before:start': async (options) => {
      // 在启动前执行
    },
  },
  
  // 注册配置模板
  templates: {
    'my-template': {
      name: 'my-agent',
      // ...
    },
  },
});
```

### 使用插件

```typescript
// raya.config.ts
import myPlugin from './my-plugin';

export default {
  plugins: [myPlugin],
};
```

---

## TypeScript 类型

### 导出的类型

```typescript
import type {
  AgentConfig,
  StartOptions,
  InitOptions,
  ConfigOptions,
  LoadOptions,
  ValidationResult,
} from '@raye/cli';
```

### 类型定义

```typescript
// AgentConfig
interface AgentConfig {
  name: string;
  version: string;
  description: string;
  base_url: string;
  api_key: string;
  model: string;
  model_id: string;
  provider: 'openai' | 'anthropic' | 'azure' | 'custom';
  extra_body: Record<string, any>;
  tools: string[];
  mcp: Record<string, any>;
  max_retries: number;
  timeout: number;
  prompt?: string;
}

// StartOptions
interface StartOptions {
  config?: string;
  model?: string;
  verbose?: boolean;
  session?: string;
}

// InitOptions
interface InitOptions {
  force?: boolean;
  template?: string;
}

// ConfigOptions
interface ConfigOptions {
  show?: boolean;
  edit?: boolean;
  validate?: boolean;
  path?: boolean;
}

// LoadOptions
interface LoadOptions {
  configPath?: string;
  validate?: boolean;
}

// ValidationResult
interface ValidationResult {
  valid: boolean;
  errors: string[];
}
```
