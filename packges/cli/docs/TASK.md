# Raya CLI 开发任务

## 项目目标

创建一个全局 CLI 工具，让用户可以在任何目录通过 `raya` 命令启动 AI Agent，并以当前目录作为工作目录。

## 开发阶段

### 阶段 1：基础架构 ✅

**目标**：搭建项目基础结构

**任务清单**：
- [x] 创建 `packges/cli` 目录
- [x] 初始化 `package.json`
- [x] 配置 TypeScript (`tsconfig.json`)
- [x] 设置构建脚本
- [x] 创建基本目录结构

**验收标准**：
- 项目结构清晰
- TypeScript 配置正确
- 可以成功构建

---

### 阶段 2：核心功能实现 🚧

**目标**：实现核心命令和工具函数

#### 任务 2.1：入口文件

**文件**：`src/index.ts`

**任务**：
- [ ] 使用 Commander.js 创建命令行程序
- [ ] 注册所有命令（start, init, config, version, help）
- [ ] 添加全局错误处理
- [ ] 添加 shebang (`#!/usr/bin/env bun`)

**代码框架**：
```typescript
#!/usr/bin/env bun
import { Command } from 'commander';
import { startAgent } from './commands/start';
import { initConfig } from './commands/init';
import { manageConfig } from './commands/config';

const program = new Command();

program
  .name('raya')
  .description('Raya AI Agent CLI')
  .version('0.1.0');

// 注册命令
program
  .command('start', { isDefault: true })
  .description('启动 Agent')
  .option('-c, --config <path>', '配置文件路径')
  .option('-m, --model <model>', '模型名称')
  .option('-v, --verbose', '详细日志')
  .option('-s, --session <id>', '会话 ID')
  .action(startAgent);

// ... 其他命令

program.parse();
```

**验收标准**：
- `raya --help` 显示帮助信息
- `raya --version` 显示版本号
- 命令注册正确

---

#### 任务 2.2：配置加载工具

**文件**：`src/utils/config.ts`

**任务**：
- [ ] 实现 `loadConfig()` - 加载配置文件
- [ ] 实现 `findConfig()` - 向上查找配置文件
- [ ] 实现 `mergeConfig()` - 合并配置
- [ ] 实现 `validateConfig()` - 验证配置格式

**代码框架**：
```typescript
import fs from 'fs/promises';
import path from 'path';
import type { AgentConfig } from 'core';

export async function loadConfig(
  workDir: string,
  options?: LoadOptions
): Promise<AgentConfig> {
  // 1. 查找配置文件
  const configPath = await findConfig(workDir);
  if (!configPath) {
    throw new ConfigError('CONFIG_NOT_FOUND');
  }
  
  // 2. 读取并解析
  const content = await fs.readFile(configPath, 'utf-8');
  const config = JSON.parse(content);
  
  // 3. 替换环境变量
  const replaced = replaceEnvVars(config);
  
  // 4. 验证
  const validation = validateConfig(replaced);
  if (!validation.valid) {
    throw new ConfigError('CONFIG_INVALID', validation.errors);
  }
  
  return replaced;
}

export async function findConfig(startDir: string): Promise<string | null> {
  let currentDir = startDir;
  
  while (true) {
    const configPath = path.join(currentDir, '.raya', 'config.json');
    
    try {
      await fs.access(configPath);
      return configPath;
    } catch {
      // 继续向上查找
    }
    
    const parentDir = path.dirname(currentDir);
    if (parentDir === currentDir) {
      return null; // 已到根目录
    }
    
    currentDir = parentDir;
  }
}
```

**验收标准**：
- 可以加载配置文件
- 可以向上查找配置
- 环境变量正确替换
- 配置验证正常工作

---

#### 任务 2.3：环境变量处理

**文件**：`src/utils/env.ts`

**任务**：
- [ ] 实现 `replaceEnvVars()` - 递归替换环境变量
- [ ] 实现 `validateEnvVars()` - 验证必需的环境变量
- [ ] 实现 `getEnvVarHints()` - 提供环境变量提示

**代码框架**：
```typescript
export function replaceEnvVars(obj: any): any {
  if (typeof obj === 'string') {
    return obj.replace(/\$\{([^}]+)\}/g, (_, varName) => {
      return process.env[varName] || '';
    });
  }
  
  if (Array.isArray(obj)) {
    return obj.map(replaceEnvVars);
  }
  
  if (obj && typeof obj === 'object') {
    const result: any = {};
    for (const [key, value] of Object.entries(obj)) {
      result[key] = replaceEnvVars(value);
    }
    return result;
  }
  
  return obj;
}
```

**验收标准**：
- 环境变量正确替换
- 支持嵌套对象
- 缺失的环境变量有提示

---

#### 任务 2.4：工作目录管理

**文件**：`src/utils/workdir.ts`

**任务**：
- [ ] 实现 `getWorkDir()` - 获取当前工作目录
- [ ] 实现 `validateWorkDir()` - 验证目录有效性
- [ ] 实现 `normalizePath()` - 规范化路径

**代码框架**：
```typescript
export function getWorkDir(): string {
  return process.cwd();
}

export function validateWorkDir(dir: string): boolean {
  try {
    const stats = fs.statSync(dir);
    return stats.isDirectory();
  } catch {
    return false;
  }
}

export function normalizePath(p: string): string {
  return path.normalize(path.resolve(p));
}
```

**验收标准**：
- 正确获取工作目录
- 目录验证正常
- 路径规范化正确

---

#### 任务 2.5：启动命令

**文件**：`src/commands/start.ts`

**任务**：
- [ ] 获取工作目录
- [ ] 加载配置文件
- [ ] 处理命令行参数覆盖
- [ ] 调用 `startTUI()` 启动界面

**代码框架**：
```typescript
import { startTUI } from 'ui';
import { loadConfig } from '../utils/config';
import { getWorkDir } from '../utils/workdir';
import chalk from 'chalk';
import ora from 'ora';

export async function startAgent(options: StartOptions) {
  const spinner = ora('正在启动 Raya Agent...').start();
  
  try {
    // 1. 获取工作目录
    const workDir = getWorkDir();
    spinner.text = `工作目录: ${chalk.cyan(workDir)}`;
    
    // 2. 加载配置
    const config = await loadConfig(workDir, {
      configPath: options.config,
    });
    
    // 3. 命令行参数覆盖
    if (options.model) {
      config.model = options.model;
    }
    
    spinner.succeed(chalk.green('配置加载成功'));
    
    // 4. 显示欢迎信息
    console.log(chalk.bold.blue('\n╔════════════════════════════════════════╗'));
    console.log(chalk.bold.blue('║        Raya AI Agent 已启动            ║'));
    console.log(chalk.bold.blue('╚════════════════════════════════════════╝\n'));
    console.log(chalk.gray(`工作目录: ${workDir}`));
    console.log(chalk.gray(`模型: ${config.model}\n`));
    
    // 5. 启动 TUI
    await startTUI({
      sessionId: options.session || `session-${Date.now()}`,
      agentConfig: config,
      workDir,
    });
    
  } catch (error) {
    spinner.fail(chalk.red('启动失败'));
    console.error(chalk.red('\n错误详情:'), error);
    process.exit(1);
  }
}
```

**验收标准**：
- 可以成功启动 TUI
- 工作目录正确传递
- 配置正确加载
- 错误处理完善

---

#### 任务 2.6：初始化命令

**文件**：`src/commands/init.ts`

**任务**：
- [ ] 交互式配置创建
- [ ] 模板选择
- [ ] 配置文件写入
- [ ] 创建 `.gitignore`

**代码框架**：
```typescript
import inquirer from 'inquirer';
import fs from 'fs/promises';
import path from 'path';
import chalk from 'chalk';
import ora from 'ora';

export async function initConfig(options: InitOptions) {
  const workDir = process.cwd();
  const configDir = path.join(workDir, '.raya');
  const configPath = path.join(configDir, 'config.json');
  
  console.log(chalk.bold.blue('\n🚀 初始化 Raya 配置\n'));
  
  // 1. 检查是否已存在
  try {
    await fs.access(configPath);
    if (!options.force) {
      const { overwrite } = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'overwrite',
          message: '配置文件已存在，是否覆盖？',
          default: false,
        },
      ]);
      
      if (!overwrite) {
        console.log(chalk.yellow('❌ 取消初始化'));
        return;
      }
    }
  } catch {
    // 文件不存在，继续
  }
  
  // 2. 交互式配置
  const answers = await inquirer.prompt([
    {
      type: 'input',
      name: 'name',
      message: 'Agent 名称:',
      default: 'raya-agent',
    },
    {
      type: 'list',
      name: 'provider',
      message: '选择 AI 提供商:',
      choices: ['openai', 'anthropic', 'azure', 'custom'],
    },
    // ... 更多问题
  ]);
  
  // 3. 创建配置
  const config = buildConfig(answers);
  
  // 4. 写入文件
  const spinner = ora('正在创建配置文件...').start();
  
  await fs.mkdir(configDir, { recursive: true });
  await fs.writeFile(configPath, JSON.stringify(config, null, 2));
  await fs.writeFile(
    path.join(configDir, '.gitignore'),
    'config.json\n*.log\n'
  );
  
  spinner.succeed(chalk.green('配置文件创建成功'));
  
  console.log(chalk.bold.green('\n✅ 初始化完成！\n'));
  console.log(chalk.gray(`配置文件: ${configPath}`));
  console.log(chalk.gray(`\n现在可以运行: ${chalk.cyan('raya')}\n`));
}
```

**验收标准**：
- 交互式配置流程顺畅
- 配置文件正确创建
- `.gitignore` 正确创建
- 提示信息友好

---

#### 任务 2.7：配置管理命令

**文件**：`src/commands/config.ts`

**任务**：
- [ ] 显示当前配置
- [ ] 编辑配置文件
- [ ] 验证配置
- [ ] 显示配置路径

**代码框架**：
```typescript
import { loadConfig, validateConfig, findConfig } from '../utils/config';
import chalk from 'chalk';
import { exec } from 'child_process';

export async function manageConfig(options: ConfigOptions) {
  const workDir = process.cwd();
  
  if (options.show) {
    const config = await loadConfig(workDir);
    console.log(chalk.blue('\n当前配置:\n'));
    console.log(JSON.stringify(sanitizeConfig(config), null, 2));
  }
  
  if (options.edit) {
    const configPath = await findConfig(workDir);
    if (!configPath) {
      console.log(chalk.red('配置文件未找到'));
      return;
    }
    
    const editor = process.env.EDITOR || 'vim';
    exec(`${editor} ${configPath}`);
  }
  
  if (options.validate) {
    const config = await loadConfig(workDir);
    const result = validateConfig(config);
    
    if (result.valid) {
      console.log(chalk.green('✅ 配置有效'));
    } else {
      console.log(chalk.red('❌ 配置无效:'));
      result.errors.forEach(err => console.log(chalk.red(`  - ${err}`)));
    }
  }
  
  if (options.path) {
    const configPath = await findConfig(workDir);
    console.log(configPath || chalk.yellow('配置文件未找到'));
  }
}
```

**验收标准**：
- 可以显示配置
- 可以编辑配置
- 可以验证配置
- 可以显示路径

---

### 阶段 3：配置模板 📋

**目标**：创建常用的配置模板

#### 任务 3.1：OpenAI 模板

**文件**：`src/templates/openai.ts`

```typescript
export const openaiTemplate = {
  name: 'openai-agent',
  version: '1.0.0',
  description: 'OpenAI GPT Agent',
  base_url: 'https://api.openai.com/v1',
  api_key: '${OPENAI_API_KEY}',
  model: 'gpt-4',
  model_id: 'gpt-4-0613',
  provider: 'openai',
  extra_body: {},
  tools: ['calculator', 'search'],
  mcp: {},
  max_retries: 3,
  timeout: 30000,
};
```

#### 任务 3.2：Anthropic 模板

**文件**：`src/templates/anthropic.ts`

```typescript
export const anthropicTemplate = {
  name: 'claude-agent',
  version: '1.0.0',
  description: 'Anthropic Claude Agent',
  base_url: 'https://api.anthropic.com',
  api_key: '${ANTHROPIC_API_KEY}',
  model: 'claude-3-opus-20240229',
  model_id: 'claude-3-opus-20240229',
  provider: 'anthropic',
  extra_body: {},
  tools: ['calculator', 'search'],
  mcp: {},
  max_retries: 3,
  timeout: 30000,
};
```

#### 任务 3.3：Azure 模板

**文件**：`src/templates/azure.ts`

```typescript
export const azureTemplate = {
  name: 'azure-agent',
  version: '1.0.0',
  description: 'Azure OpenAI Agent',
  base_url: '${AZURE_OPENAI_ENDPOINT}',
  api_key: '${AZURE_OPENAI_API_KEY}',
  model: 'gpt-4',
  model_id: 'gpt-4-deployment',
  provider: 'azure',
  extra_body: {},
  tools: ['calculator', 'search'],
  mcp: {},
  max_retries: 3,
  timeout: 30000,
};
```

**验收标准**：
- 所有模板格式正确
- 环境变量占位符正确
- 可以在 `init` 命令中使用

---

### 阶段 4：测试 🧪

**目标**：编写完整的测试套件

#### 任务 4.1：单元测试

**文件**：`test/unit/*.test.ts`

**任务**：
- [ ] 测试 `loadConfig()`
- [ ] 测试 `findConfig()`
- [ ] 测试 `mergeConfig()`
- [ ] 测试 `validateConfig()`
- [ ] 测试 `replaceEnvVars()`
- [ ] 测试 `getWorkDir()`

**示例**：
```typescript
// test/unit/config.test.ts
import { describe, it, expect } from 'bun:test';
import { loadConfig, findConfig } from '../../src/utils/config';

describe('loadConfig', () => {
  it('should load config from file', async () => {
    const config = await loadConfig('/tmp/test');
    expect(config.model).toBe('gpt-4');
  });
  
  it('should throw error if config not found', async () => {
    await expect(loadConfig('/nonexistent')).rejects.toThrow();
  });
});
```

#### 任务 4.2：集成测试

**文件**：`test/integration/*.test.ts`

**任务**：
- [ ] 测试完整的启动流程
- [ ] 测试配置初始化流程
- [ ] 测试配置管理流程

#### 任务 4.3：E2E 测试

**文件**：`test/e2e/test-cli.sh`

**任务**：
- [ ] 测试全局命令可用性
- [ ] 测试多目录隔离
- [ ] 测试配置文件查找
- [ ] 测试工作目录正确性

**验收标准**：
- 所有单元测试通过
- 集成测试通过
- E2E 测试通过
- 测试覆盖率 > 80%

---

### 阶段 5：文档和发布 📚

**目标**：完善文档并准备发布

#### 任务 5.1：文档

**任务**：
- [x] 编写 `README.md`
- [x] 编写 `ARCHITECTURE.md`
- [x] 编写 `API.md`
- [x] 编写 `TASK.md`
- [ ] 编写 `CONTRIBUTING.md`
- [ ] 编写 `CHANGELOG.md`

#### 任务 5.2：发布准备

**任务**：
- [ ] 配置 npm 发布
- [ ] 添加 LICENSE
- [ ] 添加 `.npmignore`
- [ ] 配置 CI/CD

#### 任务 5.3：发布

**任务**：
- [ ] 发布到 npm
- [ ] 创建 GitHub Release
- [ ] 更新文档

**验收标准**：
- 文档完整清晰
- 可以成功发布
- 用户可以全局安装使用

---

## 开发规范

### 代码风格

- 使用 TypeScript
- 遵循 ESLint 规则
- 使用 Prettier 格式化
- 添加必要的注释

### 提交规范

```
feat: 添加新功能
fix: 修复 bug
docs: 更新文档
test: 添加测试
refactor: 重构代码
chore: 其他修改
```

### 分支策略

- `main`: 主分支，稳定版本
- `develop`: 开发分支
- `feature/*`: 功能分支
- `fix/*`: 修复分支

---

## 时间估算

| 阶段 | 预计时间 | 优先级 |
|------|----------|--------|
| 阶段 1：基础架构 | 2 小时 | P0 |
| 阶段 2：核心功能 | 8 小时 | P0 |
| 阶段 3：配置模板 | 2 小时 | P1 |
| 阶段 4：测试 | 6 小时 | P1 |
| 阶段 5：文档和发布 | 4 小时 | P2 |

**总计**：约 22 小时

---

## 风险和挑战

### 技术风险

1. **TUI 集成**：需要修改 UI 包以支持工作目录参数
2. **配置兼容性**：确保配置格式与 Core 包兼容
3. **跨平台**：Windows/Linux/macOS 路径处理差异

### 解决方案

1. 与 UI 包开发者协调接口
2. 使用 Core 包的类型定义
3. 使用 `path` 模块处理路径

---

## 下一步行动

### 立即开始

1. ✅ 创建项目结构
2. 🚧 实现配置加载工具
3. 🚧 实现启动命令
4. ⏳ 编写单元测试

### 本周完成

- 完成阶段 2 的所有任务
- 完成阶段 3 的模板创建
- 开始阶段 4 的测试编写

### 本月完成

- 完成所有开发任务
- 完成测试和文档
- 准备发布

---

## 相关资源

- [Commander.js 文档](https://github.com/tj/commander.js)
- [Inquirer.js 文档](https://github.com/SBoudrias/Inquirer.js)
- [Chalk 文档](https://github.com/chalk/chalk)
- [Ora 文档](https://github.com/sindresorhus/ora)
- [Bun 文档](https://bun.sh/docs)
