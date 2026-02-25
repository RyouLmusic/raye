// ============ 文件工具返回类型 ============

/**
 * 基础成功/失败返回类型
 */
export type BaseResult = {
    success: boolean;
    message: string;
};

/**
 * fs_create - 创建文件或目录的返回类型
 */
export type CreateResult = BaseResult;

/**
 * fs_read - 读取文件的返回类型
 */
export type ReadResult =
    | { success: true; content: string }
    | { success: false; message: string };

/**
 * fs_write - 写入文件的返回类型
 */
export type WriteResult = BaseResult;

/**
 * fs_delete - 删除文件或目录的返回类型
 */
export type DeleteResult = BaseResult;

/**
 * fs_move - 移动/重命名文件的返回类型
 */
export type MoveResult = BaseResult;

/**
 * fs_list - 列出目录内容的返回类型
 */
export type ListResult =
    | {
          success: true;
          entries: Array<{
              path: string;
              type: 'file' | 'directory';
              size?: number;
          }>;
      }
    | { success: false; message: string };

/**
 * fs_search - 搜索文件名或内容的返回类型
 */
export type SearchResult =
    | {
          success: true;
          matches:
              | string[] // 按文件名搜索时返回文件路径数组
              | Array<{ file: string; line: number; text: string }>; // 按内容搜索时返回匹配详情
      }
    | { success: false; message: string };

/**
 * fs_replace - 查找替换的返回类型
 */
export type ReplaceResult =
    | { success: true; message: string; replacements: number }
    | { success: false; message: string };

/**
 * fs_stat - 获取文件/目录信息的返回类型
 */
export type StatResult =
    | {
          success: true;
          path: string;
          type: 'file' | 'directory';
          size: number; // 字节
          created: Date;
          modified: Date;
          accessed: Date;
          // 仅文本文件有以下字段
          lines?: number;
          words?: number;
          characters?: number;
      }
    | { success: false; message: string };

/**
 * fs_copy - 复制文件或目录的返回类型
 */
export type CopyResult = BaseResult;

/**
 * fs_batch_read - 批量读取文件的返回类型
 */
export type BatchReadResult =
    | {
          success: true;
          files: Array<{
              path: string;
              content: string;
              error?: string; // 单个文件读取失败时的错误信息
          }>;
      }
    | { success: false; message: string };

/**
 * fs_glob - 使用 glob 模式匹配文件的返回类型
 */
export type GlobResult =
    | {
          success: true;
          matches: string[]; // 匹配的文件路径数组
          count: number;
      }
    | { success: false; message: string };

/**
 * fs_tree - 生成目录树的返回类型
 */
export type TreeResult =
    | {
          success: true;
          tree: string; // 树形结构的字符串表示
          structure: TreeNode; // 结构化数据
      }
    | { success: false; message: string };

/**
 * 目录树节点结构
 */
export type TreeNode = {
    name: string;
    type: 'file' | 'directory';
    path: string;
    size?: number;
    children?: TreeNode[];
};
