import chalk from 'chalk';
import type { ConnectionConfig } from 'ui';
import { sanitizeConfig } from 'common'
/**
 * 显示欢迎信息和配置摘要
 * 
 * @param workDir - 工作目录
 * @param config - 连接配置
 */
export function displayWelcome(workDir: string, config: ConnectionConfig): void {
  console.log('\n' + chalk.bold.cyan('🤖 Raya AI Agent'));
  console.log(chalk.gray('─'.repeat(50)));
  
  // 显示工作目录
  console.log(chalk.bold('工作目录:'), chalk.green(workDir));
  
  // 显示配置信息（脱敏）
  const sanitized = sanitizeConfig(config);
  console.log(chalk.bold('配置名称:'), chalk.green(sanitized.name));
  console.log(chalk.bold('模型:'), chalk.green(config.model));
  console.log(chalk.bold('API 地址:'), chalk.green(config.base_url));
  console.log(chalk.bold('API 密钥:'), chalk.yellow(sanitized.api_key));
  
  console.log(chalk.gray('─'.repeat(50)) + '\n');
}
