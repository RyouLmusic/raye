/**
 * 网页搜索工具
 * 提供网页搜索功能，支持多种搜索引擎
 */
import { tool } from "ai";
import { z } from "zod";

/**
 * 搜索结果接口
 */
interface SearchResult {
    title: string;
    url: string;
    snippet: string;
    publishedDate?: string;
}

/**
 * 搜索响应接口
 */
interface SearchResponse {
    query: string;
    results: SearchResult[];
    totalResults: number;
}

/**
 * 使用 Tavily API 进行搜索
 */
async function searchWithTavily(query: string, maxResults: number = 5): Promise<SearchResponse> {
    const apiKey = process.env.TAVILY_API_KEY;
    
    if (!apiKey) {
        throw new Error("TAVILY_API_KEY environment variable is not set");
    }

    const response = await fetch("https://api.tavily.com/search", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            api_key: apiKey,
            query,
            max_results: maxResults,
            search_depth: "basic",
            include_answer: false,
            include_images: false,
        }),
    });

    if (!response.ok) {
        throw new Error(`Tavily API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json() as {
        results: Array<{
            title: string;
            url: string;
            content: string;
            published_date?: string;
        }>;
    };

    return {
        query,
        results: data.results.map((result) => ({
            title: result.title,
            url: result.url,
            snippet: result.content,
            publishedDate: result.published_date,
        })),
        totalResults: data.results.length,
    };
}

/**
 * 使用 DuckDuckGo 进行搜索（备用方案，无需 API key）
 */
async function searchWithDuckDuckGo(query: string, maxResults: number = 5): Promise<SearchResponse> {
    const encodedQuery = encodeURIComponent(query);
    const response = await fetch(
        `https://api.duckduckgo.com/?q=${encodedQuery}&format=json&no_html=1&skip_disambig=1`
    );

    if (!response.ok) {
        throw new Error(`DuckDuckGo API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json() as {
        RelatedTopics?: Array<{
            FirstURL?: string;
            Text?: string;
        }>;
        Abstract?: string;
        AbstractURL?: string;
        Heading?: string;
    };
    const results: SearchResult[] = [];

    // 处理 RelatedTopics
    if (data.RelatedTopics && Array.isArray(data.RelatedTopics)) {
        for (const topic of data.RelatedTopics.slice(0, maxResults)) {
            if (topic.FirstURL && topic.Text) {
                results.push({
                    title: topic.Text.split(" - ")[0] || topic.Text.substring(0, 50),
                    url: topic.FirstURL,
                    snippet: topic.Text,
                });
            }
        }
    }

    // 如果没有结果，尝试使用 Abstract
    if (results.length === 0 && data.Abstract) {
        results.push({
            title: data.Heading || query,
            url: data.AbstractURL || `https://duckduckgo.com/?q=${encodedQuery}`,
            snippet: data.Abstract,
        });
    }

    return {
        query,
        results,
        totalResults: results.length,
    };
}

/**
 * 网页搜索工具
 * 支持多种搜索引擎，优先使用 Tavily，失败时回退到 DuckDuckGo
 */
export const web_search = tool({
    description: `Search the web for information. Returns a list of relevant web pages with titles, URLs, and snippets.
Use this tool when you need to find current information, documentation, or answers to questions that require web search.`,
    inputSchema: z.object({
        query: z.string().describe("The search query string"),
        maxResults: z
            .number()
            .optional()
            .default(5)
            .describe("Maximum number of results to return (default: 5, max: 10)"),
    }),
    execute: async ({ query, maxResults = 5 }: { query: string; maxResults?: number }) => {
        try {
            // 限制最大结果数
            const limitedMaxResults = Math.min(maxResults, 10);

            console.log(`🔍 Searching for: "${query}" (max results: ${limitedMaxResults})`);

            let searchResponse: SearchResponse;

            // 优先尝试使用 Tavily
            try {
                searchResponse = await searchWithTavily(query, limitedMaxResults);
                console.log(`✓ Search completed using Tavily: ${searchResponse.totalResults} results`);
            } catch (tavilyError) {
                console.warn(`Tavily search failed, falling back to DuckDuckGo:`, tavilyError);
                // 回退到 DuckDuckGo
                searchResponse = await searchWithDuckDuckGo(query, limitedMaxResults);
                console.log(`✓ Search completed using DuckDuckGo: ${searchResponse.totalResults} results`);
            }

            // 格式化返回结果
            if (searchResponse.results.length === 0) {
                return {
                    success: false,
                    message: `No results found for query: "${query}"`,
                    query,
                    results: [],
                };
            }

            return {
                success: true,
                message: `Found ${searchResponse.totalResults} results for: "${query}"`,
                query: searchResponse.query,
                results: searchResponse.results,
            };
        } catch (error) {
            console.error("Search error:", error);
            return {
                success: false,
                message: `Search failed: ${error instanceof Error ? error.message : String(error)}`,
                query,
                results: [],
            };
        }
    },
});
