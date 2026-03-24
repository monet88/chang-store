import { GoogleGenAI } from "@google/genai";

let geminiClientInstance: GoogleGenAI | null = null;
let customApiKey: string | null = null;

export function setGeminiApiKey(key: string | null) {
  customApiKey = key;
  geminiClientInstance = null; // Force re-initialization
}

export function getActiveApiKey(): string {
    // Priority 1: Environment variable from .env.local (always wins)
    if (process.env.API_KEY) {
      return process.env.API_KEY;
    }

    // Priority 2: Custom key from Settings UI (fallback)
    if (customApiKey) {
        return customApiKey;
    }
    
    // If neither is available, we can't proceed.
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