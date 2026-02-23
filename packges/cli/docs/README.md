# Raya CLI 文档

## 概述

Raya CLI 是一个全局命令行工具，允许你在任何目录启动 Raya AI Agent，并以该目录作为工作目录进行智能对话和操作。

## 架构设计

### 职责定位

```
┌─────────────────────────────────────────────────────────┐
│                      Raya CLI                           │
│  - 全局命令入口                                          │
│  - 工作目录管理                                          │
│  - 配置文件加载                                          │
│  - 环境变量处理                                          │
│  - 命令行参数解析                                        │
└─────────────────────────────────────────────────────────┘
                          │
                          ↓
┌─────────────────────────────────────────────────────────┐
│                      UI Package                         │
│  - TUI 界面渲染                                          │
│  - 用户交互处理                                          │
│  - 消息展示                                              │
└─────────────────────────────────────────────────────────┘
                          │
                          ↓
┌─────────────────────────────────────────────────────────┐
│                     Core Package                        │
│  - Agent 核心逻辑                                        │
│  - 工具调用                                              │
│  - 会话管理                                              │
└─────────────────────────────────────────────────────────┘
```

### 依赖关系

```
cli → ui → core
```

单向依赖，职责清晰。

## 核心功能

### 1. 全局命令

```bash
# 在任何目录启动
cd ~/projects/my-app
raya

# 工作目录自动设置为 ~/projects/my-app
```

### 2. 配置管理

```bash
# 初始化配置
raya init

# 查看配置
raya config --show

# 编辑配置
raya config --edit
```

### 3. 工作目录感知

CLI 会自动：
1. 获取 `process.cwd()` 作为工作目录
2. 在当前目录或父目录查找 `.raya/config.json`
3. 将工作目录传递给 Agent
4. Agent 的所有文件操作都基于该工作目录

### 4. 配置文件查找策略

```
当前目录/.raya/config.json
    ↓ (未找到)
父目录/.raya/config.json
    ↓ (未找到)
祖父目录/.raya/config.json
    ↓ (未找到)
...直到根目录
    ↓ (未找到)
使用默认配置或提示初始化
```

## 配置文件

### 位置

```
项目目录/
└── .raya/
    ├── config.json      # 主配置文件
    ├── .gitignore       # 忽略敏感信息
    └── history/         # 会话历史（可选）
```

### 配置格式

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

### 环境变量支持

配置文件支持 `${VAR_NAME}` 格式的环境变量替换：

```json
{
  "api_key": "${OPENAI_API_KEY}",
  "base_url": "${CUSTOM_API_URL}"
}
```

在运行时会自动替换为实际的环境变量值。

## 命令详解

### `raya` / `raya start`

启动 Agent（默认命令）

```bash
# 基本用法
raya

# 指定配置文件
raya --config ./custom-config.json

# 指定模型（覆盖配置文件）
raya --model gpt-4-turbo

# 显示详细日志
raya --verbose

# 指定会话 ID（恢复会话）
raya --session session-123
```

**选项：**
- `-c, --config <path>` - 配置文件路径（默认：`.raya/config.json`）
- `-m, --model <model>` - 覆盖配置中的模型
- `-v, --verbose` - 显示详细日志
- `-s, --session <id>` - 指定会话 ID

### `raya init`

初始化配置文件

```bash
# 交互式初始化
raya init

# 强制覆盖已存在的配置
raya init --force

# 使用模板
raya init --template openai
raya init --template anthropic
```

**选项：**
- `-f, --force` - 强制覆盖已存在的配置
- `-t, --template <name>` - 使用预设模板

### `raya config`

管理配置

```bash
# 显示当前配置
raya config --show

# 编辑配置文件
raya config --edit

# 验证配置
raya config --validate

# 显示配置文件路径
raya config --path
```

**选项：**
- `-s, --show` - 显示当前配置
- `-e, --edit` - 在编辑器中打开配置
- `-v, --validate` - 验证配置格式
- `-p, --path` - 显示配置文件路径

### `raya version`

显示版本信息

```bash
raya version
raya --version
raya -v
```

### `raya help`

显示帮助信息

```bash
raya help
raya --help
raya -h
```

## 交互命令

在 Agent 运行时，可以使用以下内置命令：

| 命令 | 说明 |
|------|------|
| `help` | 显示帮助信息 |
| `clear` | 清空对话历史 |
| `save` | 保存当前会话 |
| `load <id>` | 加载历史会话 |
| `exit` / `quit` / `q` | 退出程序 |
| `pwd` | 显示当前工作目录 |
| `config` | 显示当前配置 |

## 使用场景

### 场景 1：代码项目助手

```bash
cd ~/projects/my-app
raya init
raya

# 在 TUI 中
You: 分析这个项目的结构
You: 帮我重构 src/utils.ts
You: 运行测试并修复错误
```

### 场景 2：文档写作助手

```bash
cd ~/documents/blog
raya init
raya

# 在 TUI 中
You: 帮我写一篇关于 AI 的文章
You: 检查 draft.md 的语法错误
You: 生成目录结构
```

### 场景 3：数据分析助手

```bash
cd ~/data/analysis
raya init
raya

# 在 TUI 中
You: 分析 data.csv 文件
You: 生成可视化图表
You: 写一份分析报告
```

### 场景 4：多项目管理

```bash
# 项目 A
cd ~/projects/project-a
raya init  # 配置为 gpt-4
raya

# 项目 B
cd ~/projects/project-b
raya init  # 配置为 claude-3
raya

# 每个项目有独立的配置和会话历史
```

## 安装和部署

### 开发模式

```bash
# 1. 安装依赖
cd packges/cli
bun install

# 2. 构建
bun run build

# 3. 链接到全局
bun link

# 4. 验证
raya --version
```

### 生产模式

```bash
# 发布到 npm
npm publish @raye/cli

# 用户安装
npm install -g @raye/cli

# 或使用 bun
bun add -g @raye/cli
```

### 卸载

```bash
# 取消链接
cd packges/cli
bun unlink

# 或卸载全局包
npm uninstall -g @raye/cli
```

## 配置模板

### OpenAI 模板

```json
{
  "name": "openai-agent",
  "provider": "openai",
  "base_url": "https://api.openai.com/v1",
  "api_key": "${OPENAI_API_KEY}",
  "model": "gpt-4",
  "model_id": "gpt-4-0613"
}
```

### Anthropic 模板

```json
{
  "name": "claude-agent",
  "provider": "anthropic",
  "base_url": "https://api.anthropic.com",
  "api_key": "${ANTHROPIC_API_KEY}",
  "model": "claude-3-opus-20240229",
  "model_id": "claude-3-opus-20240229"
}
```

### Azure OpenAI 模板

```json
{
  "name": "azure-agent",
  "provider": "azure",
  "base_url": "${AZURE_OPENAI_ENDPOINT}",
  "api_key": "${AZURE_OPENAI_API_KEY}",
  "model": "gpt-4",
  "model_id": "gpt-4-deployment-name"
}
```

### 自定义 API 模板

```json
{
  "name": "custom-agent",
  "provider": "custom",
  "base_url": "https://your-api.com/v1",
  "api_key": "${CUSTOM_API_KEY}",
  "model": "your-model",
  "model_id": "your-model-id"
}
```

## 环境变量

### 必需的环境变量

```bash
# OpenAI
export OPENAI_API_KEY="sk-..."

# Anthropic
export ANTHROPIC_API_KEY="sk-ant-..."

# Azure
export AZURE_OPENAI_ENDPOINT="https://..."
export AZURE_OPENAI_API_KEY="..."
```

### 可选的环境变量

```bash
# 自定义配置路径
export RAYA_CONFIG_PATH="~/.raya/config.json"

# 日志级别
export RAYA_LOG_LEVEL="debug"

# 会话历史目录
export RAYA_HISTORY_DIR="~/.raya/history"
```

## 故障排查

### 问题 1：命令未找到

```bash
# 检查是否已链接
which raya

# 重新链接
cd packges/cli
bun link
```

### 问题 2：配置文件未找到

```bash
# 检查当前目录
ls -la .raya/

# 初始化配置
raya init

# 或指定配置路径
raya --config /path/to/config.json
```

### 问题 3：API Key 错误

```bash
# 检查环境变量
echo $OPENAI_API_KEY

# 设置环境变量
export OPENAI_API_KEY="sk-..."

# 或在配置文件中直接设置（不推荐）
```

### 问题 4：工作目录不正确

```bash
# 在 TUI 中检查
You: pwd

# 应该显示当前目录
# 如果不对，检查启动时的目录
```

## 最佳实践

### 1. 配置管理

- ✅ 使用环境变量存储 API Key
- ✅ 将 `.raya/config.json` 加入 `.gitignore`
- ✅ 为不同项目使用不同配置
- ❌ 不要在配置文件中硬编码敏感信息

### 2. 会话管理

- ✅ 定期清理对话历史（`clear` 命令）
- ✅ 为重要会话指定有意义的 session ID
- ✅ 使用 `save` 命令保存重要对话
- ❌ 不要在一个会话中处理无关的任务

### 3. 工作目录

- ✅ 在项目根目录启动
- ✅ 确保 Agent 有必要的文件访问权限
- ✅ 使用相对路径引用文件
- ❌ 不要在系统目录（如 `/`）启动

### 4. 性能优化

- ✅ 使用 `--verbose` 调试性能问题
- ✅ 合理设置 `timeout` 和 `max_retries`
- ✅ 选择合适的模型（速度 vs 质量）
- ❌ 不要在配置中启用不需要的工具

## 扩展开发

### 添加新命令

```typescript
// src/commands/my-command.ts
export async function myCommand(options: MyOptions) {
  // 实现逻辑
}

// src/index.ts
program
  .command("my-command")
  .description("My custom command")
  .action(myCommand);
```

### 添加新配置模板

```typescript
// src/templates/my-template.ts
export const myTemplate = {
  name: "my-agent",
  // ...配置
};

// src/commands/init.ts
const templates = {
  openai: openaiTemplate,
  anthropic: anthropicTemplate,
  custom: myTemplate,
};
```

### 添加新的配置验证

```typescript
// src/utils/validate.ts
export function validateConfig(config: AgentConfig) {
  // 验证逻辑
}
```

## 相关文档

- [核心架构](../../core/README.md)
- [TUI 界面](../../ui/README.md)
- [工具系统](../../core/docs/TOOLS_README.md)
- [会话管理](../../core/docs/SESSION-ARCHITECTURE-IMPLEMENTATION.md)

## 贡献指南

欢迎贡献！请查看 [CONTRIBUTING.md](./CONTRIBUTING.md)

## 许可证

MIT
