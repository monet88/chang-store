import OpenAI from 'openai';

export const createOpenAiTestClient = (baseURL: string): OpenAI => new OpenAI({
  apiKey: 'test-key',
  baseURL,
  dangerouslyAllowBrowser: true,
});
