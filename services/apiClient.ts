import { GoogleGenAI } from "@google/genai";

let geminiClientInstance: GoogleGenAI | null = null;
let customApiKey: string | null = null;

export function setGeminiApiKey(key: string | null) {
  customApiKey = key;
  geminiClientInstance = null; // Force re-initialization
}

export function getActiveApiKey(): string {
    if (customApiKey) {
        return customApiKey;
    }

    // Exclusively use the environment variable
    if (process.env.API_KEY) {
      return process.env.API_KEY;
    }
    
    // If neither is available, we can't proceed.
    // However, throwing here might break the app if it checks validity early.
    // We'll throw, but the UI should handle it or it will be caught during generation.
    throw new Error("API_KEY is not configured. Please set it in the settings or environment.");
}

export function getGeminiClient(): GoogleGenAI {
  // Singleton pattern
  if (!geminiClientInstance) {
    const activeKey = getActiveApiKey();
    geminiClientInstance = new GoogleGenAI({ apiKey: activeKey });
  }
  return geminiClientInstance;
}

export function reinitializeGeminiClient(): void {
  geminiClientInstance = null;
}