# Raya CLI 工具实现任务列表 v2

## 概述

本任务列表基于方案 A 的新架构设计，明确了 CLI、UI、Core 包的职责划分。CLI 包专注于配置管理和命令行交互，通过调用 UI 包的 `startTUI()` 函数启动界面，并传递完整的配置对象。

## 架构说明

### 包依赖关系
```
CLI Package
  ├── 依赖 UI Package
  │   └── 导入 startTUI() 和 AgentConfig 类型
  ├── 依赖 Core Package（通过 UI）
  │   └── 使用 AgentConfig 类型
  └── 依赖 Common Package
      └── 使用共享工具函数
```

### 职责划分
- **CLI 包**：配置文件管理、环境变量处理、命令行交互
- **UI 包**：TUI 界面渲染、用户交互
- **Core 包**：Agent 核心逻辑、工具调用

## 任务列表

### P0 阶段：核心功能（必须）

- [x] 1. 项目初始化和基础配置
  - ✅ 创建项目目录结构（src/, test/, docs/）
  - ✅ 配置 package.json，包含 bin 字段和依赖（ui, core, common）
  - ✅ 配置 tsconfig.json 用于 TypeScript 编译
  - ✅ 创建 .gitignore 文件
  - ✅ 安装依赖并验证构建
  - _需求: 1.3, 20.1, 20.4_

- [ ] 2. 类型定义
  - [ ] 2.1 创建配置类型定义（src/types/config.ts）
    - ✅ 定义 RayaConfig 接口（扩展 AgentConfig）
    - ✅ 定义 LoadOptions 接口用于配置加载选项
    - ✅ 定义 ValidationResult 接口用于验证结果
    - ✅ 定义 TemplateType 类型
    - _需求: 8.1, 13.2_
  
  - [ ] 2.2 创建错误类型定义（src/types/error.ts）
    - ✅ 定义 ConfigError 类，包含错误代码和详细信息
    - ✅ 定义 EnvError 类，包含缺失的环境变量列表
    - ✅ 定义 WorkDirError 类，包含路径信息
    - _需求: 10.1, 10.2_
  
  - [ ] 2.3 创建类型导出文件（src/types/index.ts）
    - ✅ 导出所有类型定义
    - ✅ 重新导出 UI 包的 AgentConfig 类型
    - _需求: 通用_

- [ ] 3. 工具函数实现
  - [ ] 3.1 实现工作目录管理（src/utils/workdir.ts）
    - 实现 getWorkDir() 函数，通过 process.cwd() 获取当前目录
    - 实现 validateWorkDir() 函数，验证目录存在且可访问
    - 实现 normalizePath() 函数，规范化路径（处理相对路径、符号链接）
    - _需求: 2.1, 2.2, 2.5, 12.1, 12.2_
  
  - [ ] 3.2 实现环境变量处理（src/utils/env.ts）
    - 实现 replaceEnvVars() 函数，递归替换配置对象中的环境变量占位符
    - 实现 validateEnvVars() 函数，验证必需的环境变量
    - 实现 getEnvVarHints() 函数，提供环境变量设置提示
    - _需求: 4.1, 4.2, 4.3, 4.4, 4.5_
  
  - [ ] 3.3 实现配置验证（src/utils/validate.ts）
    - 实现 validateConfig() 函数，验证配置格式和必需字段
    - 验证 provider 字段值为有效选项（openai, anthropic, azure, custom）
    - 验证 base_url 格式为有效的 URL
    - 验证 max_retries 和 timeout 为正整数
    - _需求: 8.1, 8.2, 8.3, 8.4, 8.5, 8.6_
  
  - [ ] 3.4 实现配置加载（src/utils/config.ts）
    - 实现 findConfig() 函数，从当前目录向上递归查找配置文件
    - 实现 loadConfig() 函数，读取、解析和验证配置文件
    - 实现 mergeConfig() 函数，按优先级合并配置（命令行 > 文件 > 默认）
    - 处理配置文件不存在、格式错误等异常情况
    - **关键**：返回 AgentConfig 对象，供 startTUI() 使用
    - _需求: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 13.1, 13.2, 13.3, 13.4, 13.5_
  
  - [ ] 3.5 实现日志工具（src/utils/logger.ts）
    - 定义 LogLevel 枚举（DEBUG, INFO, WARN, ERROR）
    - 实现 Logger 类，支持不同日志级别
    - 实现 createLogger() 函数，根据 verbose 选项创建日志器
    - 实现 sanitizeConfig() 函数，隐藏敏感信息（如 api_key）
    - _需求: 10.3, 10.4, 10.5, 17.3, 17.4_
  
  - [ ] 3.6 实现显示工具（src/utils/display.ts）
    - 实现 displayWelcome() 函数，显示欢迎信息和配置摘要
    - 使用 chalk 添加颜色
    - 显示工作目录、模型、提供商等信息
    - _需求: 18.3_
  
  - [ ] 3.7 实现错误处理（src/utils/error.ts）
    - 实现 handleError() 函数，统一处理各种错误类型
    - 根据错误类型显示友好的错误信息和解决方案
    - 支持 verbose 模式显示堆栈跟踪
    - _需求: 10.1, 10.2, 10.6_

- [ ] 4. 启动命令实现（src/commands/start.ts）
  - 定义 StartOptions 接口（config, model, verbose, session）
  - 实现 startAgent() 函数
  - 获取和验证工作目录
  - 加载和验证配置文件
  - 处理命令行参数覆盖配置
  - 生成或验证会话 ID
  - 显示欢迎信息和配置摘要
  - **关键**：调用 UI 包的 startTUI() 函数，传递 agentConfig 和 workDir
  - 实现错误处理和友好的错误提示
  - _需求: 1.2, 2.3, 5.2, 5.7, 9.1, 9.2, 9.3, 9.4, 9.5, 16.1, 16.2, 16.3, 18.1, 18.2, 18.3, 18.4, 18.5_

- [ ] 5. 入口文件实现（src/index.ts）
  - 添加 shebang `#!/usr/bin/env bun`
  - 使用 Commander.js 创建 CLI 程序
  - 注册 start 命令（默认命令）及其选项
  - 注册 version 命令，从 package.json 读取版本号
  - 注册 help 命令
  - 实现全局错误处理（uncaughtException, unhandledRejection）
  - 解析命令行参数并执行相应命令
  - _需求: 1.1, 1.4, 5.1, 5.6, 10.6, 14.1, 14.2, 14.3, 14.4, 15.1, 15.2, 15.3, 15.4, 15.5_

- [ ] 6. 检查点 - 核心功能验证
  - 确保所有 P0 任务完成
  - 运行基本的手动测试，验证 raya 命令可以启动
  - 验证配置加载、环境变量替换、工作目录管理功能正常
  - **验证 CLI 正确传递配置给 UI 包**
  - 如有问题，询问用户

### P1 阶段：扩展功能（重要）

- [ ] 7. 配置模板实现
  - [ ] 7.1 创建 OpenAI 模板（src/templates/openai.ts）
    - 定义 openaiTemplate 对象，包含默认配置
    - 使用环境变量占位符 ${OPENAI_API_KEY}
    - _需求: 11.1, 11.6_
  
  - [ ] 7.2 创建 Anthropic 模板（src/templates/anthropic.ts）
    - 定义 anthropicTemplate 对象，包含 Claude 模型配置
    - 使用环境变量占位符 ${ANTHROPIC_API_KEY}
    - _需求: 11.2, 11.6_
  
  - [ ] 7.3 创建 Azure 模板（src/templates/azure.ts）
    - 定义 azureTemplate 对象，包含 Azure OpenAI 配置
    - 使用环境变量占位符 ${AZURE_OPENAI_ENDPOINT} 和 ${AZURE_OPENAI_API_KEY}
    - _需求: 11.3, 11.6_
  
  - [ ] 7.4 创建模板导出文件（src/templates/index.ts）
    - 导出所有模板
    - 创建 templates 对象，映射模板名称到模板对象
    - 实现 getTemplate() 函数
    - _需求: 11.5_

- [ ] 8. 初始化命令实现（src/commands/init.ts）
  - 定义 InitOptions 接口（force, template）
  - 实现 initConfig() 函数
  - 检查配置文件是否已存在，如未使用 --force 则询问是否覆盖
  - 提供交互式模板选择（使用 inquirer）
  - 根据选择的模板获取基础配置
  - 通过交互式提示收集配置项（name, model 等）
  - 验证配置有效性
  - 创建 .raya 目录
  - 写入配置文件到 .raya/config.json
  - 创建 .raya/.gitignore 文件，包含 config.json
  - 显示初始化成功信息和下一步操作提示
  - _需求: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7, 6.8, 17.1, 17.2_

- [ ] 9. 会话管理工具（src/utils/session.ts）
  - 实现 generateSessionId() 函数，生成格式为 session-<timestamp> 的 ID
  - 实现 validateSessionId() 函数，验证 ID 仅包含字母、数字、连字符和下划线
  - _需求: 16.2, 16.4, 16.5_

- [ ] 10. 编辑器工具（src/utils/editor.ts）
  - 实现 getDefaultEditor() 函数，根据平台返回默认编辑器
  - 实现 openInEditor() 函数，在编辑器中打开文件
  - 优先使用 EDITOR 环境变量
  - 处理编辑器启动失败的情况
  - _需求: 19.2, 19.3, 19.4, 19.5_

- [ ] 11. 配置管理命令实现（src/commands/config.ts）
  - 定义 ConfigOptions 接口（show, edit, validate, path）
  - 实现 manageConfig() 函数
  - 实现 --show 选项：显示当前配置（隐藏敏感信息）
  - 实现 --edit 选项：在编辑器中打开配置文件
  - 实现 --validate 选项：验证配置格式并显示结果
  - 实现 --path 选项：显示配置文件路径
  - 处理配置文件不存在的情况
  - _需求: 7.1, 7.2, 7.3, 7.4, 7.5_

- [ ] 12. 更新入口文件，注册新命令
  - 在 src/index.ts 中注册 init 命令及其选项
  - 在 src/index.ts 中注册 config 命令及其选项
  - _需求: 5.3, 5.4_

- [ ] 13. 检查点 - 扩展功能验证
  - 确保所有 P1 任务完成
  - 测试 raya init 命令，验证配置初始化流程
  - 测试 raya config 命令的所有选项
  - 验证配置模板功能正常
  - 如有问题，询问用户

### P1 阶段：单元测试（重要）

- [ ] 14. 工具函数单元测试
  - [ ]* 14.1 工作目录管理测试（test/unit/workdir.test.ts）
    - 测试 getWorkDir() 返回当前目录
    - 测试 validateWorkDir() 验证有效和无效目录
    - 测试 normalizePath() 规范化各种路径格式
    - _需求: 2.1, 2.2, 2.5_
  
  - [ ]* 14.2 环境变量处理测试（test/unit/env.test.ts）
    - 测试 replaceEnvVars() 替换字符串中的环境变量
    - 测试递归替换嵌套对象中的环境变量
    - 测试不存在的环境变量替换为空字符串
    - 测试 validateEnvVars() 检测缺失的环境变量
    - _需求: 4.1, 4.2, 4.3_
  
  - [ ]* 14.3 配置验证测试（test/unit/validate.test.ts）
    - 测试 validateConfig() 验证有效配置
    - 测试检测缺失的必需字段
    - 测试验证 provider 字段
    - 测试验证 base_url 格式
    - 测试验证 max_retries 和 timeout
    - _需求: 8.1, 8.2, 8.3, 8.4, 8.5_
  
  - [ ]* 14.4 配置加载测试（test/unit/config.test.ts）
    - 测试 loadConfig() 加载有效配置文件
    - 测试配置不存在时抛出 CONFIG_NOT_FOUND 错误
    - 测试 JSON 格式错误时抛出 CONFIG_PARSE_ERROR
    - 测试 findConfig() 在当前目录和父目录查找配置
    - 测试到达根目录时返回 null
    - 测试 mergeConfig() 合并配置对象
    - 测试深度合并嵌套对象
    - _需求: 3.1, 3.2, 3.3, 3.4, 13.1, 13.5_
  
  - [ ]* 14.5 会话管理测试（test/unit/session.test.ts）
    - 测试 generateSessionId() 生成正确格式的 ID
    - 测试 validateSessionId() 验证有效和无效 ID
    - _需求: 16.2, 16.4_

- [ ] 15. 检查点 - 单元测试验证
  - 确保所有单元测试通过
  - 检查测试覆盖率是否 > 80%
  - 如有问题，询问用户

### P2 阶段：属性测试（可选）

- [ ]* 16. 配置属性测试（test/property/config.property.test.ts）
  - [ ]* 16.1 属性 5: 配置文件读写往返
    - **属性 5: 配置文件读写往返**
    - **验证需求: 3.2, 6.5**
    - 使用 fast-check 生成随机 AgentConfig 对象
    - 写入文件后再读取，验证等价性
    - 运行 100 次迭代
  
  - [ ]* 16.2 属性 7: 环境变量递归替换
    - **属性 7: 环境变量递归替换**
    - **验证需求: 4.1, 4.2**
    - 使用 fast-check 生成随机环境变量名和值
    - 验证所有占位符都被正确替换
    - 运行 100 次迭代
  
  - [ ]* 16.3 属性 8: 配置合并优先级
    - **属性 8: 配置合并优先级**
    - **验证需求: 5.7, 13.1**
    - 使用 fast-check 生成随机配置值
    - 验证合并优先级：命令行 > 文件 > 默认
    - 运行 100 次迭代
  
  - [ ]* 16.4 属性 14: 配置深度合并
    - **属性 14: 配置深度合并**
    - **验证需求: 13.5**
    - 使用 fast-check 生成随机嵌套对象
    - 验证深度合并而非整体替换
    - 运行 100 次迭代

- [ ]* 17. 工作目录属性测试（test/property/workdir.property.test.ts）
  - [ ]* 17.1 属性 2: 工作目录验证
    - **属性 2: 工作目录验证**
    - **验证需求: 2.2**
    - 使用 fast-check 生成随机路径
    - 验证 validateWorkDir() 返回值与目录存在性一致
    - 运行 100 次迭代
  
  - [ ]* 17.2 属性 3: 路径规范化
    - **属性 3: 路径规范化**
    - **验证需求: 2.5**
    - 使用 fast-check 生成各种路径格式
    - 验证 normalizePath() 返回绝对路径且不包含 . 或 ..
    - 运行 100 次迭代

- [ ]* 18. 配置验证属性测试（test/property/validate.property.test.ts）
  - [ ]* 18.1 属性 10: 配置验证完整性
    - **属性 10: 配置验证完整性**
    - **验证需求: 8.1, 8.2, 8.3, 8.4, 8.5**
    - 使用 fast-check 生成随机配置对象
    - 验证 validateConfig() 正确识别有效和无效配置
    - 运行 100 次迭代

- [ ]* 19. 会话管理属性测试（test/property/session.property.test.ts）
  - [ ]* 19.1 属性 15: 会话 ID 生成和验证
    - **属性 15: 会话 ID 生成和验证**
    - **验证需求: 16.2, 16.4**
    - 验证生成的 ID 符合格式 session-<timestamp>
    - 使用 fast-check 生成随机字符串，验证 validateSessionId() 逻辑
    - 运行 100 次迭代

### P2 阶段：集成测试和 E2E 测试（可选）

- [ ]* 20. CLI 集成测试（test/integration/cli.test.ts）
  - 测试 raya --version 显示版本信息
  - 测试 raya --help 显示帮助信息
  - 测试 raya init 初始化配置文件
  - 测试 raya config --validate 验证配置
  - _需求: 14.1, 15.1, 6.1, 7.3_

- [ ]* 21. E2E 测试脚本（test/e2e/test-cli.sh）
  - 创建测试目录
  - 测试初始化配置流程
  - 测试配置验证
  - 测试显示配置路径
  - 测试子目录中查找配置
  - 清理测试环境
  - _需求: 3.1, 6.1, 7.4_

- [ ]* 22. 检查点 - 测试完整性验证
  - 确保所有测试通过
  - 生成测试覆盖率报告
  - 验证覆盖率 > 80%
  - 如有问题，询问用户

### P2 阶段：文档和发布（可选）

- [ ]* 23. 文档完善
  - [ ]* 23.1 创建使用文档（docs/README.md）
    - 安装说明
    - 快速开始指南
    - 命令参考
    - 配置选项说明
    - 常见问题解答
  
  - [ ]* 23.2 创建架构文档（docs/ARCHITECTURE.md）
    - 系统架构图
    - 模块职责说明
    - 数据流图
    - 设计决策记录
  
  - [ ]* 23.3 创建 API 文档（docs/API.md）
    - 所有公开函数的 API 文档
    - 类型定义说明
    - 使用示例
  
  - [ ]* 23.4 更新项目 README.md
    - 项目简介
    - 功能特性
    - 安装和使用说明
    - 开发指南
    - 贡献指南

- [ ]* 24. 发布准备
  - 确保所有测试通过
  - 更新版本号
  - 生成 CHANGELOG
  - 构建项目（bun run build）
  - 验证构建输出
  - 测试全局安装（bun link）

- [ ]* 25. 最终检查点
  - 验证所有 20 个需求的验收标准都得到满足
  - 验证所有正确性属性都有对应的测试
  - 验证在 Windows、Linux 和 macOS 上都能正常工作
  - 验证文档完整清晰
  - 询问用户是否准备发布

## 任务依赖关系

```
1 (项目初始化) ✅
├── 2 (类型定义) ✅
│   └── 3 (工具函数)
│       ├── 4 (启动命令) ← 关键：调用 startTUI()
│       ├── 7 (配置模板)
│       ├── 8 (初始化命令)
│       ├── 9 (会话管理)
│       ├── 10 (编辑器工具)
│       └── 11 (配置管理命令)
├── 5 (入口文件) ← 依赖 4, 8, 11
├── 6 (检查点 P0)
├── 12 (更新入口文件) ← 依赖 8, 11
├── 13 (检查点 P1)
├── 14 (单元测试) ← 依赖 3
├── 15 (检查点单元测试)
├── 16-19 (属性测试) ← 依赖 3
├── 20-21 (集成测试) ← 依赖 5, 12
├── 22 (检查点测试)
├── 23 (文档)
├── 24 (发布准备)
└── 25 (最终检查点)
```

## 预计时间

| 阶段 | 任务 | 预计时间 | 优先级 |
|------|------|----------|--------|
| P0 核心功能 | 1-6 | 6 小时 | 必须 |
| P1 扩展功能 | 7-13 | 5 小时 | 重要 |
| P1 单元测试 | 14-15 | 4 小时 | 重要 |
| P2 属性测试 | 16-19 | 4 小时 | 可选 |
| P2 集成测试 | 20-22 | 3 小时 | 可选 |
| P2 文档发布 | 23-25 | 3 小时 | 可选 |

**总计**：约 25 小时

## 关键变更说明

### 与原任务列表的主要区别

1. **任务 1 已完成**：
   - ✅ 项目初始化和基础配置已完成
   - ✅ 添加了 ui, core, common 包依赖

2. **任务 2 已完成**：
   - ✅ 类型定义已创建（config.ts, error.ts, index.ts）
   - ✅ 从 UI 包导入 AgentConfig 类型

3. **任务 4 的关键变更**：
   - **新增**：调用 `startTUI({ sessionId, agentConfig, workDir })`
   - **强调**：CLI 负责加载配置并传递给 UI

4. **简化的实现**：
   - 移除了一些不必要的复杂性
   - 专注于核心职责：配置管理和命令行交互

## 注意事项

1. **任务标记说明**：
   - `[x]` - 已完成的任务
   - `[ ]` - 未完成的任务
   - `*` - 可选任务（测试相关）

2. **实现顺序**：
   - 严格按照 P0 → P1 → P2 的顺序实现
   - 每个阶段完成后进行检查点验证
   - 遇到问题及时询问用户

3. **架构原则**：
   - CLI 专注于配置管理，不涉及 UI 和 Agent 逻辑
   - 通过 `startTUI()` 传递完整配置给 UI 包
   - 保持包之间的职责边界清晰

4. **测试策略**：
   - 单元测试和属性测试是互补的
   - 单元测试验证特定示例和边缘情况
   - 属性测试验证通用属性和大量随机输入
   - 所有测试任务标记为可选（*），但强烈建议实现

5. **跨平台兼容性**：
   - 所有路径处理使用 path 模块
   - 文件操作使用 fs/promises
   - 测试在多个平台上验证

6. **安全考虑**：
   - 配置文件权限设置为 0o600
   - 日志中隐藏敏感信息
   - 验证所有用户输入

7. **代码质量**：
   - 遵循 TypeScript 最佳实践
   - 添加适当的注释和文档
   - 保持代码简洁和可维护性
