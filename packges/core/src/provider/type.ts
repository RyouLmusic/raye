import { z } from "zod"

export const openAiProvider = z.object({
    name: z.string(),
    apiKey: z.string(),
    baseurl: z.string(),
    model: z.string()
});

export type OpenAiProvider = z.infer<typeof openAiProvider>; 