import { tool } from "ai";
import { z } from "zod";

/**
 * 计算工具：执行基本的数学运算
 */
export const calculate = tool({
    description: 'Perform basic arithmetic calculations (add + , subtract - , multiply * , divide /)',
    inputSchema: z.object({
        a: z.number().describe('The first number'),
        b: z.number().describe('The second number'),
        operation: z.enum(['add', 'subtract', 'multiply', 'divide']).describe('The operation to perform')
    }),
    execute: async ({ a, b, operation }) => {
        let result: number;
        
        switch (operation) {
            case 'add':
                result = a + b;
                break;
            case 'subtract':
                result = a - b;
                break;
            case 'multiply':
                result = a * b;
                break;
            case 'divide':
                if (b === 0) {
                    throw new Error('Cannot divide by zero');
                }
                result = a / b;
                break;
        }
        
        return {
            a,
            b,
            operation,
            result
        };
    }
});