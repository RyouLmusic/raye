import fs from 'fs/promises';
import path from 'path';

/**
 * 获取当前工作目录
 * 
 * @returns 当前工作目录的绝对路径
 */
export function getWorkDir(): string {
  return process.cwd();
}

/**
 * 验证工作目录是否存在且可访问
 * 
 * @param workDir - 工作目录路径
 * @returns 目录是否有效
 */
export async function validateWorkDir(workDir: string): Promise<boolean> {
  try {
    const stats = await fs.stat(workDir);
    return stats.isDirectory();
  } catch {
    return false;
  }
}

/**
 * 规范化路径（处理相对路径、符号链接）
 * 
 * @param inputPath - 输入路径
 * @returns 规范化后的绝对路径
 */
export async function normalizePath(inputPath: string): Promise<string> {
  // 解析为绝对路径
  const absolutePath = path.resolve(inputPath);
  
  try {
    // 解析符号链接
    const realPath = await fs.realpath(absolutePath);
    return realPath;
  } catch {
    // 如果路径不存在，返回绝对路径
    return absolutePath;
  }
}
