import { dirname, join, basename, relative } from 'path';
import {
    mkdir,
    writeFile,
    readFile,
    rm,
    rename,
    readdir,
    stat,
    copyFile,
    cp,
} from 'fs/promises';
import { tool } from 'ai';
import { z } from 'zod';
import type {
    CreateResult,
    ReadResult,
    WriteResult,
    DeleteResult,
    MoveResult,
    ListResult,
    SearchResult,
    ReplaceResult,
    StatResult,
    CopyResult,
    BatchReadResult,
    GlobResult,
    TreeResult,
    TreeNode,
} from './type';


// ### 1. 文件与目录创建
// - `fs_create` - 创建文件（自动创建父目录）或目录
export const fs_create = tool({
    description: `创建文件或目录。
                    - 创建文件时需提供 filePath 和可选的 content，会自动递归创建所需的父级目录
                    - 仅创建目录时，将 onlyDir 设为 true，只需提供 filePath（作为目录路径）
                    - 如果文件已存在，内容将被覆盖
                    - 路径支持相对路径和绝对路径`,
    inputSchema: z.object({
        filePath: z.string().describe('文件或目录的路径，创建文件时需包含文件名和扩展名'),
        content: z.string().describe('文件内容，仅创建文件时有效').default(''),
        onlyDir: z.boolean().describe('为 true 时仅创建目录，忽略 content').default(false),
    }),
    execute: async ({ filePath, content, onlyDir }): Promise<CreateResult> => {
        try {
            if (onlyDir) {
                await mkdir(filePath, { recursive: true });
                return { success: true, message: `目录已创建：${filePath}` };
            }

            const dir = dirname(filePath);
            await mkdir(dir, { recursive: true });
            await writeFile(filePath, content, { encoding: 'utf8' });
            return { success: true, message: `文件已创建：${filePath}` };
        } catch (error) {
            return { success: false, message: `操作失败：${(error as Error).message}` };
        }
    },
});

// ### 2. 文件读取
// - `fs_read` - 读取文件内容，支持指定编码
export const fs_read = tool({
    description: `读取文件内容并以字符串形式返回。
                    - 默认使用 UTF-8 编码读取
                    - 如果文件不存在或无权限，返回错误信息`,
    inputSchema: z.object({
        filePath: z.string().describe('要读取的文件路径'),
        encoding: z
            .enum(['utf8', 'base64', 'hex'])
            .describe('文件编码，默认为 utf8')
            .default('utf8'),
    }),
    execute: async ({ filePath, encoding }): Promise<ReadResult> => {
        try {
            const content = await readFile(filePath, { encoding });
            return { success: true, content };
        } catch (error) {
            return { success: false, message: `读取失败：${(error as Error).message}` };
        }
    },
});

// ### 3. 文件写入
// - `fs_write` - 写入文件，支持覆盖（overwrite）或追加（append）模式
export const fs_write = tool({
    description: `写入内容到文件。
                    - 默认覆盖（overwrite）模式：会替换文件已有内容
                    - 追加（append）模式：在文件末尾追加内容
                    - 如果目标目录不存在，会自动递归创建`,
    inputSchema: z.object({
        filePath: z.string().describe('要写入的文件路径'),
        content: z.string().describe('要写入的内容'),
        mode: z
            .enum(['overwrite', 'append'])
            .describe('写入模式：overwrite 覆盖，append 追加')
            .default('overwrite'),
    }),
    execute: async ({ filePath, content, mode }): Promise<WriteResult> => {
        try {
            // 确保父目录存在
            await mkdir(dirname(filePath), { recursive: true });
            const flag = mode === 'append' ? 'a' : 'w';
            await writeFile(filePath, content, { encoding: 'utf8', flag });
            return { success: true, message: `文件写入成功：${filePath}（模式：${mode}）` };
        } catch (error) {
            return { success: false, message: `写入失败：${(error as Error).message}` };
        }
    },
});

// ### 4. 删除
// - `fs_delete` - 删除文件或目录（自动判断类型）
export const fs_delete = tool({
    description: `删除文件或目录。
                    - 自动判断路径类型（文件或目录）
                    - 删除目录时会递归删除其所有子内容
                    - 删除不存在的路径默认不报错（force 模式）`,
    inputSchema: z.object({
        targetPath: z.string().describe('要删除的文件或目录路径'),
    }),
    execute: async ({ targetPath }): Promise<DeleteResult> => {
        try {
            // recursive: true 同时支持文件和目录；force: true 路径不存在时不抛错
            await rm(targetPath, { recursive: true, force: true });
            return { success: true, message: `已删除：${targetPath}` };
        } catch (error) {
            return { success: false, message: `删除失败：${(error as Error).message}` };
        }
    },
});

// ### 5. 移动 / 重命名
// - `fs_move` - 移动或重命名文件/目录
export const fs_move = tool({
    description: `移动或重命名文件/目录。
                    - 源路径与目标路径在同一文件系统时执行原子重命名
                    - 目标路径的父目录不存在时会自动创建
                    - 可用于文件重命名：将 sourcePath 改为新名称即可`,
    inputSchema: z.object({
        sourcePath: z.string().describe('源文件或目录路径'),
        destPath: z.string().describe('目标文件或目录路径'),
    }),
    execute: async ({ sourcePath, destPath }): Promise<MoveResult> => {
        try {
            // 确保目标父目录存在
            await mkdir(dirname(destPath), { recursive: true });
            await rename(sourcePath, destPath);
            return { success: true, message: `已移动：${sourcePath} → ${destPath}` };
        } catch (error) {
            return { success: false, message: `移动失败：${(error as Error).message}` };
        }
    },
});

// ### 6. 目录列出
// - `fs_list` - 列出目录内容，返回文件名、类型、大小等信息
export const fs_list = tool({
    description: `列出指定目录下的内容。
                    - 返回每个条目的名称、类型（file/directory）和大小（字节，仅文件）
                    - 默认不递归；将 recursive 设为 true 可递归列出所有子目录内容`,
    inputSchema: z.object({
        dirPath: z.string().describe('要列出的目录路径'),
        recursive: z
            .boolean()
            .describe('是否递归列出子目录，默认 false')
            .default(false),
    }),
    execute: async ({ dirPath, recursive }): Promise<ListResult> => {
        // 内部递归辅助函数
        async function listDir(currentPath: string): Promise<Array<{ path: string; type: 'file' | 'directory'; size?: number }>> {
            const entries = await readdir(currentPath, { withFileTypes: true });
            const results: Array<{ path: string; type: 'file' | 'directory'; size?: number }> = [];

            for (const entry of entries) {
                const fullPath = join(currentPath, entry.name);
                if (entry.isDirectory()) {
                    results.push({ path: fullPath, type: 'directory' });
                    if (recursive) {
                        results.push(...await listDir(fullPath));
                    }
                } else {
                    const fileStat = await stat(fullPath);
                    results.push({ path: fullPath, type: 'file', size: fileStat.size });
                }
            }
            return results;
        }

        try {
            const entries = await listDir(dirPath);
            return { success: true, entries };
        } catch (error) {
            return { success: false, message: `列出目录失败：${(error as Error).message}` };
        }
    },
});

// ### 7. 搜索
// - `fs_search` - 搜索文件名（glob 风格）或文件内容（grep 风格）
export const fs_search = tool({
    description: `在指定目录中搜索文件名或文件内容。
                    - searchType 为 'name' 时：在目录树中匹配包含 pattern 的文件名（不区分大小写）
                    - searchType 为 'content' 时：在目录树中搜索包含 pattern 文本的文件并返回匹配行
                    - 仅搜索文本文件（跳过二进制文件）`,
    inputSchema: z.object({
        rootDir: z.string().describe('搜索的根目录路径'),
        pattern: z.string().describe('搜索关键词或正则表达式字符串'),
        searchType: z
            .enum(['name', 'content'])
            .describe('搜索类型：name 搜索文件名，content 搜索文件内容')
            .default('name'),
        useRegex: z
            .boolean()
            .describe('pattern 是否作为正则表达式处理，默认 false（普通字符串匹配）')
            .default(false),
    }),
    execute: async ({ rootDir, pattern, searchType, useRegex }): Promise<SearchResult> => {
        const regex = useRegex ? new RegExp(pattern, 'i') : new RegExp(pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');

        // 递归收集目录树中所有文件路径
        async function collectFiles(dir: string): Promise<string[]> {
            const entries = await readdir(dir, { withFileTypes: true });
            const files: string[] = [];
            for (const entry of entries) {
                const fullPath = join(dir, entry.name);
                if (entry.isDirectory()) {
                    files.push(...await collectFiles(fullPath));
                } else {
                    files.push(fullPath);
                }
            }
            return files;
        }

        try {
            const allFiles = await collectFiles(rootDir);

            if (searchType === 'name') {
                // 按文件名匹配
                const matched = allFiles.filter(f => regex.test(basename(f)));
                return { success: true, matches: matched };
            }

            // 按内容匹配（grep 风格）
            const results: Array<{ file: string; line: number; text: string }> = [];
            for (const file of allFiles) {
                let text: string;
                try {
                    text = await readFile(file, { encoding: 'utf8' });
                } catch {
                    // 跳过无法以 UTF-8 读取的文件（可能是二进制文件）
                    continue;
                }
                const lines = text.split('\n');
                for (let i = 0; i < lines.length; i++) {
                    const line = lines[i] ?? '';
                    if (regex.test(line)) {
                        results.push({ file, line: i + 1, text: line });
                    }
                }
            }
            return { success: true, matches: results };
        } catch (error) {
            return { success: false, message: `搜索失败：${(error as Error).message}` };
        }
    },
});

// ### 8. 查找替换
// - `fs_replace` - 在文件中查找并替换内容
export const fs_replace = tool({
    description: `在指定文件中查找并替换文本内容。
                    - 默认替换文件中所有匹配项（全局替换）
                    - 支持普通字符串匹配和正则表达式匹配
                    - 替换后直接覆盖原文件；建议提前备份重要文件`,
    inputSchema: z.object({
        filePath: z.string().describe('要操作的文件路径'),
        search: z.string().describe('要查找的字符串或正则表达式'),
        replace: z.string().describe('替换后的字符串'),
        useRegex: z
            .boolean()
            .describe('search 是否作为正则表达式处理，默认 false')
            .default(false),
        replaceAll: z
            .boolean()
            .describe('是否替换所有匹配项，默认 true；为 false 时仅替换第一个匹配项')
            .default(true),
    }),
    execute: async ({ filePath, search, replace, useRegex, replaceAll }): Promise<ReplaceResult> => {
        try {
            const original = await readFile(filePath, { encoding: 'utf8' });

            let pattern: RegExp;
            if (useRegex) {
                pattern = new RegExp(search, replaceAll ? 'g' : '');
            } else {
                // 转义普通字符串中的正则特殊字符
                const escaped = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                pattern = new RegExp(escaped, replaceAll ? 'g' : '');
            }

            const updated = original.replace(pattern, replace);
            const count = (original.match(pattern) ?? []).length;

            if (count === 0) {
                return { success: true, message: `未找到匹配内容，文件未修改`, replacements: 0 };
            }

            await writeFile(filePath, updated, { encoding: 'utf8' });
            return {
                success: true,
                message: `替换完成：${filePath}`,
                replacements: replaceAll ? count : 1,
            };
        } catch (error) {
            return { success: false, message: `替换失败：${(error as Error).message}` };
        }
    },
});


// ### 9. 文件/目录信息获取
// - `fs_stat` - 获取文件或目录的详细信息
export const fs_stat = tool({
    description: `获取文件或目录的详细信息。
                    - 返回文件大小、创建时间、修改时间等元数据
                    - 对于文本文件，额外返回行数、字数、字符数统计
                    - 用于文档管理、进度追踪、版本控制等场景`,
    inputSchema: z.object({
        targetPath: z.string().describe('要查询的文件或目录路径'),
        analyzeText: z
            .boolean()
            .describe('是否分析文本内容（统计行数、字数），默认 true')
            .default(true),
    }),
    execute: async ({ targetPath, analyzeText }): Promise<StatResult> => {
        try {
            const stats = await stat(targetPath);
            const isFile = stats.isFile();

            const result: StatResult = {
                success: true,
                path: targetPath,
                type: isFile ? 'file' : 'directory',
                size: stats.size,
                created: stats.birthtime,
                modified: stats.mtime,
                accessed: stats.atime,
            };

            // 如果是文本文件且需要分析内容
            if (isFile && analyzeText) {
                try {
                    const content = await readFile(targetPath, { encoding: 'utf8' });
                    const lines = content.split('\n');
                    const words = content.split(/\s+/).filter(w => w.length > 0);
                    
                    result.lines = lines.length;
                    result.words = words.length;
                    result.characters = content.length;
                } catch {
                    // 如果不是文本文件或读取失败，跳过文本分析
                }
            }

            return result;
        } catch (error) {
            return { success: false, message: `获取信息失败：${(error as Error).message}` };
        }
    },
});

// ### 10. 文件/目录复制
// - `fs_copy` - 复制文件或目录
export const fs_copy = tool({
    description: `复制文件或目录到新位置。
                    - 支持单文件复制和目录递归复制
                    - 自动创建目标路径的父目录
                    - 用于备份、版本管理、模板复制等场景`,
    inputSchema: z.object({
        sourcePath: z.string().describe('源文件或目录路径'),
        destPath: z.string().describe('目标文件或目录路径'),
        overwrite: z
            .boolean()
            .describe('是否覆盖已存在的目标文件，默认 false')
            .default(false),
    }),
    execute: async ({ sourcePath, destPath, overwrite }): Promise<CopyResult> => {
        try {
            const stats = await stat(sourcePath);
            
            // 确保目标父目录存在
            const destDir = stats.isFile() ? dirname(destPath) : destPath;
            await mkdir(destDir, { recursive: true });

            if (stats.isFile()) {
                // 复制单个文件
                await copyFile(sourcePath, destPath, overwrite ? 0 : 1);
                return { success: true, message: `文件已复制：${sourcePath} → ${destPath}` };
            } else {
                // 递归复制目录
                await cp(sourcePath, destPath, { 
                    recursive: true, 
                    force: overwrite 
                });
                return { success: true, message: `目录已复制：${sourcePath} → ${destPath}` };
            }
        } catch (error) {
            return { success: false, message: `复制失败：${(error as Error).message}` };
        }
    },
});

// ### 11. 批量读取文件
// - `fs_batch_read` - 一次读取多个文件
export const fs_batch_read = tool({
    description: `批量读取多个文件的内容。
                    - 一次性读取多个文件，提高效率
                    - 单个文件读取失败不影响其他文件
                    - 用于分析整个项目、生成文档、内容聚合等场景`,
    inputSchema: z.object({
        filePaths: z.array(z.string()).describe('要读取的文件路径数组'),
        encoding: z
            .enum(['utf8', 'base64', 'hex'])
            .describe('文件编码，默认为 utf8')
            .default('utf8'),
        continueOnError: z
            .boolean()
            .describe('单个文件失败时是否继续读取其他文件，默认 true')
            .default(true),
    }),
    execute: async ({ filePaths, encoding, continueOnError }): Promise<BatchReadResult> => {
        try {
            const results: Array<{ path: string; content: string; error?: string }> = [];

            for (const filePath of filePaths) {
                try {
                    const content = await readFile(filePath, { encoding });
                    results.push({ path: filePath, content });
                } catch (error) {
                    if (continueOnError) {
                        results.push({ 
                            path: filePath, 
                            content: '', 
                            error: (error as Error).message 
                        });
                    } else {
                        return { 
                            success: false, 
                            message: `读取文件 ${filePath} 失败：${(error as Error).message}` 
                        };
                    }
                }
            }

            return { success: true, files: results };
        } catch (error) {
            return { success: false, message: `批量读取失败：${(error as Error).message}` };
        }
    },
});

// ### 12. Glob 模式匹配
// - `fs_glob` - 使用 glob 模式匹配文件
export const fs_glob = tool({
    description: `使用 glob 模式匹配文件。
                    - 支持通配符：* 匹配任意字符，** 递归匹配目录
                    - 示例：*.md 匹配所有 Markdown 文件，chapters/**/*.md 匹配 chapters 下所有 Markdown
                    - 用于批量操作、文件筛选、项目分析等场景`,
    inputSchema: z.object({
        rootDir: z.string().describe('搜索的根目录路径'),
        pattern: z.string().describe('glob 模式，如 *.md, **/*.json, chapters/chapter-*.md'),
        includeDirectories: z
            .boolean()
            .describe('是否包含目录，默认 false（仅返回文件）')
            .default(false),
    }),
    execute: async ({ rootDir, pattern, includeDirectories }): Promise<GlobResult> => {
        try {
            // 简单的 glob 实现（支持 * 和 **）
            const matches: string[] = [];
            
            // 将 glob 模式转换为正则表达式
            const regexPattern = pattern
                .replace(/\*\*/g, '§§') // 临时替换 **
                .replace(/\*/g, '[^/]*') // * 匹配除 / 外的任意字符
                .replace(/§§/g, '.*'); // ** 匹配任意字符包括 /
            
            const regex = new RegExp(`^${regexPattern}$`);

            // 递归搜索文件
            async function searchFiles(dir: string): Promise<void> {
                const entries = await readdir(dir, { withFileTypes: true });
                
                for (const entry of entries) {
                    const fullPath = join(dir, entry.name);
                    const relativePath = relative(rootDir, fullPath);
                    
                    if (entry.isDirectory()) {
                        if (includeDirectories && regex.test(relativePath)) {
                            matches.push(fullPath);
                        }
                        await searchFiles(fullPath);
                    } else if (entry.isFile()) {
                        if (regex.test(relativePath)) {
                            matches.push(fullPath);
                        }
                    }
                }
            }

            await searchFiles(rootDir);

            return { 
                success: true, 
                matches,
                count: matches.length 
            };
        } catch (error) {
            return { success: false, message: `Glob 匹配失败：${(error as Error).message}` };
        }
    },
});

// ### 13. 目录树生成
// - `fs_tree` - 生成目录树结构
export const fs_tree = tool({
    description: `生成目录树结构的可视化表示。
                    - 返回树形字符串和结构化数据
                    - 可限制深度避免过大的目录树
                    - 用于项目文档、README 生成、结构分析等场景`,
    inputSchema: z.object({
        rootDir: z.string().describe('根目录路径'),
        maxDepth: z
            .number()
            .describe('最大递归深度，0 表示无限制，默认 0')
            .default(0),
        showSize: z
            .boolean()
            .describe('是否显示文件大小，默认 false')
            .default(false),
        excludePatterns: z
            .array(z.string())
            .describe('要排除的目录/文件名模式，如 ["node_modules", ".git"]')
            .default([]),
    }),
    execute: async ({ rootDir, maxDepth, showSize, excludePatterns }): Promise<TreeResult> => {
        try {
            // 构建树形结构
            async function buildTree(dir: string, depth: number): Promise<TreeNode> {
                const stats = await stat(dir);
                const name = basename(dir);
                
                const node: TreeNode = {
                    name,
                    type: stats.isDirectory() ? 'directory' : 'file',
                    path: dir,
                };

                if (stats.isFile()) {
                    node.size = stats.size;
                    return node;
                }

                // 如果是目录且未达到最大深度
                if (maxDepth === 0 || depth < maxDepth) {
                    const entries = await readdir(dir, { withFileTypes: true });
                    node.children = [];

                    for (const entry of entries) {
                        // 跳过排除的模式
                        if (excludePatterns.some(pattern => entry.name.includes(pattern))) {
                            continue;
                        }

                        const childPath = join(dir, entry.name);
                        const childNode = await buildTree(childPath, depth + 1);
                        node.children.push(childNode);
                    }
                }

                return node;
            }

            // 生成树形字符串
            function treeToString(node: TreeNode, prefix: string = '', isLast: boolean = true): string {
                const connector = isLast ? '└── ' : '├── ';
                const sizeStr = showSize && node.size ? ` (${formatSize(node.size)})` : '';
                let result = prefix + connector + node.name + sizeStr + '\n';

                if (node.children && node.children.length > 0) {
                    const childPrefix = prefix + (isLast ? '    ' : '│   ');
                    node.children.forEach((child, index) => {
                        const isLastChild = index === node.children!.length - 1;
                        result += treeToString(child, childPrefix, isLastChild);
                    });
                }

                return result;
            }

            function formatSize(bytes: number): string {
                if (bytes < 1024) return `${bytes}B`;
                if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
                return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
            }

            const structure = await buildTree(rootDir, 0);
            const tree = basename(rootDir) + '/\n' + 
                        (structure.children || [])
                            .map((child, index) => 
                                treeToString(child, '', index === structure.children!.length - 1)
                            )
                            .join('');

            return {
                success: true,
                tree,
                structure,
            };
        } catch (error) {
            return { success: false, message: `生成目录树失败：${(error as Error).message}` };
        }
    },
});
