# Raya CLI 全局命令行工具需求文档

## 简介

Raya CLI 是一个全局命令行工具，允许用户在任何目录通过 `raya` 命令启动 Raya AI Agent，并以当前目录作为工作目录进行智能对话和文件操作。该工具负责命令行参数解析、配置文件加载、环境变量处理，并与 UI 包和 Core 包集成，提供完整的 AI Agent 使用体验。

## 术语表

- **CLI**: Command Line Interface，命令行界面工具
- **工作目录**: 用户执行 `raya` 命令时所在的目录，通过 `process.cwd()` 获取
- **配置文件**: 位于 `.raya/config.json` 的 JSON 格式配置文件
- **环境变量替换**: 将配置文件中的 `${VAR_NAME}` 格式替换为实际环境变量值
- **TUI**: Text User Interface，文本用户界面
- **Agent**: AI 智能代理，执行用户任务的核心逻辑
- **Commander**: Commander.js 库，用于命令行参数解析
- **配置查找**: 从当前目录向上递归查找 `.raya/config.json` 文件的过程
- **配置合并**: 将默认配置、文件配置和命令行参数按优先级合并的过程
- **会话**: Agent 的一次完整对话过程，包含历史消息和上下文

## 需求

### 需求 1: 全局命令入口

**用户故事**: 作为开发者，我希望在任何目录执行 `raya` 命令启动 Agent，这样我可以快速在不同项目中使用 AI 助手。

#### 验收标准

1. THE CLI SHALL 注册 `raya` 作为全局可执行命令
2. WHEN 用户在任何目录执行 `raya` 命令，THE CLI SHALL 启动 Agent 并使用当前目录作为工作目录
3. THE CLI SHALL 在 package.json 中配置 bin 字段指向入口文件
4. THE CLI SHALL 在入口文件顶部包含 shebang `#!/usr/bin/env bun`
5. WHEN 用户执行 `bun link` 后，THE CLI SHALL 在系统中全局可用

### 需求 2: 工作目录管理

**用户故事**: 作为开发者，我希望 Agent 自动识别我当前所在的目录作为工作目录，这样 Agent 的所有文件操作都基于正确的上下文。

#### 验收标准

1. THE CLI SHALL 通过 `process.cwd()` 获取当前工作目录
2. THE CLI SHALL 验证工作目录存在且可访问
3. THE CLI SHALL 将工作目录传递给 TUI 和 Agent
4. WHEN 工作目录不存在或无权限，THE CLI SHALL 显示错误信息并退出
5. THE CLI SHALL 规范化工作目录路径（处理相对路径、符号链接等）

### 需求 3: 配置文件查找和加载

**用户故事**: 作为开发者，我希望 CLI 能自动查找配置文件，这样我可以在项目的任何子目录启动 Agent 而无需指定配置路径。

#### 验收标准

1. THE CLI SHALL 从当前目录开始向上递归查找 `.raya/config.json` 文件
2. WHEN 找到配置文件，THE CLI SHALL 读取并解析 JSON 内容
3. WHEN 配置文件不存在，THE CLI SHALL 提示用户运行 `raya init` 初始化配置
4. WHEN 配置文件格式错误，THE CLI SHALL 显示详细的解析错误信息
5. THE CLI SHALL 在到达文件系统根目录后停止查找
6. WHEN 用户通过 `--config` 参数指定配置路径，THE CLI SHALL 使用指定的配置文件而不进行向上查找

### 需求 4: 环境变量处理

**用户故事**: 作为开发者，我希望在配置文件中使用环境变量引用敏感信息，这样我可以避免将 API Key 等敏感数据提交到版本控制系统。

#### 验收标准

1. THE CLI SHALL 识别配置文件中的 `${VAR_NAME}` 格式环境变量占位符
2. THE CLI SHALL 递归替换配置对象中所有字符串值的环境变量占位符
3. WHEN 环境变量不存在，THE CLI SHALL 将占位符替换为空字符串
4. WHEN 必需的环境变量缺失（如 api_key 为空），THE CLI SHALL 显示友好的错误提示和设置指南
5. THE CLI SHALL 支持在数组和嵌套对象中的环境变量替换

### 需求 5: 命令行参数解析

**用户故事**: 作为开发者，我希望通过命令行参数快速覆盖配置选项，这样我可以在不修改配置文件的情况下测试不同的设置。

#### 验收标准

1. THE CLI SHALL 使用 Commander.js 解析命令行参数
2. THE CLI SHALL 支持 `start` 命令（默认命令）及其选项：`--config`, `--model`, `--verbose`, `--session`
3. THE CLI SHALL 支持 `init` 命令及其选项：`--force`, `--template`
4. THE CLI SHALL 支持 `config` 命令及其选项：`--show`, `--edit`, `--validate`, `--path`
5. THE CLI SHALL 支持 `version` 命令显示版本信息
6. THE CLI SHALL 支持 `help` 命令显示帮助信息
7. WHEN 命令行参数与配置文件冲突，THE CLI SHALL 优先使用命令行参数值

### 需求 6: 配置初始化

**用户故事**: 作为开发者，我希望通过交互式向导初始化配置文件，这样我可以快速设置 Agent 而无需手动编写 JSON 配置。

#### 验收标准

1. WHEN 用户执行 `raya init`，THE CLI SHALL 启动交互式配置向导
2. THE CLI SHALL 提供预设模板选项：openai, anthropic, azure, custom
3. THE CLI SHALL 通过 inquirer 库收集必需的配置项（name, provider, model 等）
4. THE CLI SHALL 创建 `.raya` 目录（如果不存在）
5. THE CLI SHALL 将配置写入 `.raya/config.json` 文件
6. THE CLI SHALL 创建 `.raya/.gitignore` 文件以忽略敏感信息
7. WHEN 配置文件已存在且未使用 `--force` 选项，THE CLI SHALL 询问用户是否覆盖
8. THE CLI SHALL 在初始化完成后显示配置文件路径和下一步操作提示

### 需求 7: 配置管理

**用户故事**: 作为开发者，我希望能够查看、编辑和验证配置文件，这样我可以方便地管理 Agent 的设置。

#### 验收标准

1. WHEN 用户执行 `raya config --show`，THE CLI SHALL 显示当前加载的配置（隐藏敏感信息如 API Key）
2. WHEN 用户执行 `raya config --edit`，THE CLI SHALL 在默认编辑器中打开配置文件
3. WHEN 用户执行 `raya config --validate`，THE CLI SHALL 验证配置格式并显示验证结果
4. WHEN 用户执行 `raya config --path`，THE CLI SHALL 显示当前使用的配置文件路径
5. WHEN 配置文件不存在，THE CLI SHALL 提示用户运行 `raya init`

### 需求 8: 配置验证

**用户故事**: 作为开发者，我希望 CLI 能验证配置文件的正确性，这样我可以在启动前发现配置错误。

#### 验收标准

1. THE CLI SHALL 验证配置文件包含所有必需字段：name, base_url, api_key, model, model_id, provider
2. THE CLI SHALL 验证 provider 字段值为有效选项：openai, anthropic, azure, custom
3. THE CLI SHALL 验证 base_url 格式为有效的 URL
4. THE CLI SHALL 验证 max_retries 为正整数
5. THE CLI SHALL 验证 timeout 为正整数
6. WHEN 验证失败，THE CLI SHALL 显示所有验证错误的详细列表
7. WHEN 验证成功，THE CLI SHALL 继续启动流程

### 需求 9: 与 UI 包集成

**用户故事**: 作为开发者，我希望 CLI 能正确启动 TUI 界面，这样我可以通过友好的界面与 Agent 交互。

#### 验收标准

1. THE CLI SHALL 从 UI 包导入 `startTUI` 函数
2. THE CLI SHALL 调用 `startTUI` 并传递必需参数：sessionId, agentConfig, workDir
3. WHEN TUI 启动失败，THE CLI SHALL 捕获错误并显示友好的错误信息
4. THE CLI SHALL 在启动 TUI 前显示欢迎信息和当前配置摘要
5. THE CLI SHALL 等待 TUI 进程结束后正常退出

### 需求 10: 错误处理和日志

**用户故事**: 作为开发者，我希望看到清晰的错误信息和日志，这样我可以快速诊断和解决问题。

#### 验收标准

1. THE CLI SHALL 为不同错误类型定义错误代码：CONFIG_NOT_FOUND, CONFIG_INVALID, CONFIG_PARSE_ERROR, ENV_VAR_MISSING, WORKDIR_NOT_FOUND
2. WHEN 发生错误，THE CLI SHALL 显示错误类型、详细信息和建议的解决方案
3. WHEN 使用 `--verbose` 选项，THE CLI SHALL 显示详细的调试日志
4. THE CLI SHALL 使用 chalk 库为不同类型的消息添加颜色：错误（红色）、警告（黄色）、成功（绿色）、信息（蓝色）
5. THE CLI SHALL 使用 ora 库显示加载动画（如"正在加载配置..."）
6. WHEN 发生未捕获的异常，THE CLI SHALL 显示错误堆栈（在 verbose 模式下）并以非零状态码退出

### 需求 11: 配置模板系统

**用户故事**: 作为开发者，我希望使用预设的配置模板快速初始化常见的 AI 提供商配置，这样我可以节省手动配置的时间。

#### 验收标准

1. THE CLI SHALL 提供 OpenAI 配置模板，包含 base_url, model, provider 等默认值
2. THE CLI SHALL 提供 Anthropic 配置模板，包含 Claude 模型的默认配置
3. THE CLI SHALL 提供 Azure OpenAI 配置模板，包含 Azure 特定的配置项
4. THE CLI SHALL 提供 Custom 配置模板，允许用户自定义所有配置项
5. WHEN 用户选择模板，THE CLI SHALL 使用模板的默认值并允许用户覆盖
6. THE CLI SHALL 在所有模板中使用环境变量占位符存储敏感信息

### 需求 12: 跨平台兼容性

**用户故事**: 作为开发者，我希望 CLI 在不同操作系统上都能正常工作，这样我可以在 Windows、Linux 和 macOS 上使用相同的工具。

#### 验收标准

1. THE CLI SHALL 使用 Node.js path 模块处理路径，确保跨平台兼容
2. THE CLI SHALL 正确处理不同操作系统的路径分隔符（/ 和 \\）
3. THE CLI SHALL 在 Windows 上正确识别驱动器根目录（如 C:\\）
4. THE CLI SHALL 在所有平台上正确处理环境变量
5. THE CLI SHALL 使用跨平台的文件系统 API（fs/promises）

### 需求 13: 配置合并策略

**用户故事**: 作为开发者，我希望配置能按照明确的优先级合并，这样我可以理解最终使用的配置值来自哪里。

#### 验收标准

1. THE CLI SHALL 按照优先级合并配置：命令行参数 > 配置文件 > 默认值
2. THE CLI SHALL 提供默认配置值：max_retries=3, timeout=30000
3. WHEN 配置文件中存在某个字段，THE CLI SHALL 覆盖默认值
4. WHEN 命令行参数中存在某个字段，THE CLI SHALL 覆盖配置文件和默认值
5. THE CLI SHALL 使用深度合并策略处理嵌套对象（如 extra_body, mcp）

### 需求 14: 版本管理

**用户故事**: 作为开发者，我希望能查看 CLI 的版本信息，这样我可以确认使用的是最新版本或报告 bug 时提供版本号。

#### 验收标准

1. WHEN 用户执行 `raya version` 或 `raya --version` 或 `raya -v`，THE CLI SHALL 显示版本号
2. THE CLI SHALL 从 package.json 读取版本号
3. THE CLI SHALL 显示格式为 "Raya CLI vX.Y.Z" 的版本信息
4. THE CLI SHALL 在帮助信息中包含版本号

### 需求 15: 帮助信息

**用户故事**: 作为开发者，我希望能查看详细的帮助信息，这样我可以了解所有可用的命令和选项。

#### 验收标准

1. WHEN 用户执行 `raya help` 或 `raya --help` 或 `raya -h`，THE CLI SHALL 显示所有可用命令的列表
2. WHEN 用户执行 `raya help <command>`，THE CLI SHALL 显示特定命令的详细帮助
3. THE CLI SHALL 在帮助信息中包含命令描述、选项说明和使用示例
4. THE CLI SHALL 使用 Commander.js 的内置帮助格式化功能
5. WHEN 用户输入无效命令，THE CLI SHALL 显示错误信息和帮助提示

### 需求 16: 会话管理

**用户故事**: 作为开发者，我希望能指定或恢复特定的会话，这样我可以继续之前的对话或管理多个独立的会话。

#### 验收标准

1. WHEN 用户执行 `raya --session <id>`，THE CLI SHALL 使用指定的会话 ID
2. WHEN 用户未指定会话 ID，THE CLI SHALL 生成格式为 `session-<timestamp>` 的新会话 ID
3. THE CLI SHALL 将会话 ID 传递给 TUI 和 Agent
4. THE CLI SHALL 验证会话 ID 格式（仅包含字母、数字、连字符和下划线）
5. WHEN 会话 ID 格式无效，THE CLI SHALL 显示错误信息并使用默认会话 ID

### 需求 17: 配置文件安全

**用户故事**: 作为开发者，我希望配置文件中的敏感信息得到保护，这样我可以避免意外泄露 API Key 等敏感数据。

#### 验收标准

1. THE CLI SHALL 在初始化时创建 `.raya/.gitignore` 文件
2. THE CLI SHALL 在 `.gitignore` 中包含 `config.json` 以防止提交到版本控制
3. WHEN 显示配置时（`config --show`），THE CLI SHALL 隐藏 api_key 字段的值，显示为 `***`
4. THE CLI SHALL 在日志中不输出完整的 api_key 值
5. THE CLI SHALL 建议用户使用环境变量而非硬编码敏感信息

### 需求 18: 启动流程优化

**用户故事**: 作为开发者，我希望 CLI 启动快速且提供清晰的反馈，这样我可以快速开始使用 Agent。

#### 验收标准

1. THE CLI SHALL 在启动时显示加载动画和当前步骤（如"正在加载配置..."）
2. THE CLI SHALL 在配置加载成功后显示成功提示
3. THE CLI SHALL 在启动 TUI 前显示欢迎横幅和配置摘要（工作目录、模型）
4. THE CLI SHALL 使用异步操作避免阻塞启动流程
5. WHEN 启动失败，THE CLI SHALL 显示失败原因和建议的解决步骤

### 需求 19: 配置文件编辑器集成

**用户故事**: 作为开发者，我希望能在我喜欢的编辑器中编辑配置文件，这样我可以使用熟悉的工具修改配置。

#### 验收标准

1. WHEN 用户执行 `raya config --edit`，THE CLI SHALL 在编辑器中打开配置文件
2. THE CLI SHALL 优先使用 `EDITOR` 环境变量指定的编辑器
3. WHEN `EDITOR` 环境变量未设置，THE CLI SHALL 使用系统默认编辑器（vim/nano/notepad）
4. THE CLI SHALL 等待编辑器进程结束后返回
5. WHEN 编辑器启动失败，THE CLI SHALL 显示错误信息和配置文件路径

### 需求 20: 依赖管理

**用户故事**: 作为开发者，我希望 CLI 的依赖清晰且最小化，这样我可以快速安装和使用工具。

#### 验收标准

1. THE CLI SHALL 在 package.json 中声明所有直接依赖：commander, inquirer, chalk, ora
2. THE CLI SHALL 将 UI 和 Core 包声明为内部依赖
3. THE CLI SHALL 使用 TypeScript 进行类型检查
4. THE CLI SHALL 在 package.json 中配置正确的 bin 字段
5. THE CLI SHALL 支持通过 bun 或 npm 安装和运行
