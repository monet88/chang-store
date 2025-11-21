
import { ImageFile } from "../types";

// Add after imports
interface NanoBananaGenerateOptions {
  type?: "TEXTTOIAMGE" | "IMAGETOIAMGE" | "IMAGETOVIDEO";
  imageUrls?: string[];
  callBackUrl?: string;
  image_size?: string;
  numImages?: number;
  enable_safety_checker?: boolean;
}

interface NanoBananaTaskStatus {
  successFlag: 0 | 1 | 2 | 3; // 0: processing, 1: success, 2: failure, 3: timeout
  response?: {
    resultImageUrl?: string;
    resultVideoUrl?: string;
  };
  errorMessage?: string;
}

interface NanoBananaApiResponse {
  code: number;
  msg: string;
  data: {
    taskId: string;
  };
}

interface NanoBananaStatusResponse {
  code: number;
  msg: string;
  data: NanoBananaTaskStatus;
}


export class NanoBananaClient {
  private apiKey: string;
  private baseUrl = "https://api.nanobananaapi.ai/api/v1/nanobanana";
  private debug: boolean;

  private static readonly MAX_POLL_ATTEMPTS = 60; // 5 minutes at 5s intervals
  private static readonly POLL_INTERVAL_MS = 5000; // API docs suggest 5-10s (changed from 3s)
  private static readonly MAX_RETRY_ATTEMPTS = 3;
  private static readonly INITIAL_RETRY_DELAY_MS = 1000;

  constructor(apiKey: string, debug: boolean = false) {
    if (!apiKey) {
      throw new Error("NanoBanana API key is required.");
    }
    this.apiKey = apiKey;
    this.debug = debug || (typeof process !== 'undefined' && process.env.NODE_ENV === 'development');
  }

  private log(message: string, data?: any): void {
    if (this.debug) {
      console.log(`[NanoBanana] ${message}`, data || '');
    }
  }

  private logError(message: string, error?: any): void {
    console.error(`[NanoBanana] ${message}`, error || '');
  }

  private handleApiError(result: NanoBananaApiResponse | NanoBananaStatusResponse, context: string = 'API call') {
    if (result.code === 200) return;

    let message: string;
    const errorContext = `[${context}]`;
    
    // Map error codes to translation keys
    switch (result.code) {
        case 401: 
          message = `nb:error.api.nb.unauthorized`;
          this.logError(`${errorContext} Unauthorized - check API key`);
          break;
        case 402: 
          message = `nb:error.api.nb.insufficientCredits`;
          this.logError(`${errorContext} Insufficient credits`);
          break;
        case 404: 
          message = `nb:error.api.nb.notFound`;
          this.logError(`${errorContext} Endpoint not found`);
          break;
        case 422: 
          message = `nb:error.api.nb.invalidParams`;
          this.logError(`${errorContext} Invalid parameters`, result.msg);
          break;
        case 429: 
          message = `nb:error.api.nb.rateLimit`;
          this.logError(`${errorContext} Rate limit exceeded`);
          break;
        case 455: 
          message = `nb:error.api.nb.unavailable`;
          this.logError(`${errorContext} Service unavailable`);
          break;
        case 500: 
          message = `nb:error.api.nb.serverError`;
          this.logError(`${errorContext} Server error`, result.msg);
          break;
        case 505: 
          message = `nb:error.api.nb.featureDisabled`;
          this.logError(`${errorContext} Feature disabled`);
          break;
        default:
            const reason = result.msg || 'Unknown error';
            this.logError(`${errorContext} Unexpected error code ${result.code}:`, reason);
            message = `nb:error.api.nanobananaFailed:${reason}`;
            break;
    }
    throw new Error(message);
  }

  private async executeWithRetries<T>(apiCall: () => Promise<T>): Promise<T> {
    const retries = NanoBananaClient.MAX_RETRY_ATTEMPTS;
    let lastError: Error | undefined;

    for (let i = 0; i < retries; i++) {
        try {
            return await apiCall();
        } catch (error) {
            lastError = error as Error;
            
            const errorMessage = lastError.message || '';
            const isRetryable = 
                errorMessage.includes("Server exception") || 
                errorMessage.includes("Server error") ||
                errorMessage.includes("Failed to fetch");

            if (isRetryable && i < retries - 1) {
                this.log(`API call failed. Retrying (${i + 1}/${retries - 1})...`, { error: errorMessage });
                await new Promise(res => setTimeout(res, NanoBananaClient.INITIAL_RETRY_DELAY_MS * Math.pow(2, i)));
                continue;
            }
            this.logError('API call failed after all retries.', lastError);
            throw lastError;
        }
    }
    throw lastError;
  }

  async generate(prompt: string, options: NanoBananaGenerateOptions): Promise<string> {
    return this.executeWithRetries(async () => {
        this.log('Generating image/video', { prompt: prompt.substring(0, 50) + '...', options });
        const response = await fetch(`${this.baseUrl}/generate`, {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${this.apiKey}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                prompt,
                type: options.type || "TEXTTOIAMGE",
                imageUrls: options.imageUrls,
                numImages: options.numImages || 1,
                callBackUrl: options.callBackUrl || "https://dummy-callback.url/nanobanana-webhook",
                image_size: options.image_size,
                enable_safety_checker: options.enable_safety_checker,
            }),
        });

        if (!response.ok) {
            if (response.status >= 500) {
                throw new Error(`Server error: ${response.status}`);
            }
            const errorBody = await response.text();
            throw new Error(`NanoBanana API error (${response.status}): ${errorBody}`);
        }

        const result: NanoBananaApiResponse = await response.json();
        this.log('Generate response received', result);
        this.handleApiError(result, 'generate');
        this.log('Task created successfully', { taskId: result.data.taskId });
        return result.data.taskId;
    });
  }

  async getTaskStatus(taskId: string): Promise<NanoBananaTaskStatus> {
    return this.executeWithRetries(async () => {
        this.log('Getting task status', { taskId });
        const res = await fetch(`${this.baseUrl}/record-info?taskId=${taskId}`, {
          headers: { "Authorization": `Bearer ${this.apiKey}` },
        });

        if (!res.ok) {
            if (res.status >= 500) {
                throw new Error(`Server error: ${res.status}`);
            }
            const errorBody = await res.text();
            throw new Error(`NanoBanana status check error (${res.status}): ${errorBody}`);
        }

        const result: NanoBananaStatusResponse = await res.json();
        this.log('Task status response received', result);
        this.handleApiError(result, 'getTaskStatus');
        return result.data;
    });
  }

  async waitForResult(taskId: string, onStatusUpdate: (message: string) => void, resultType: 'image' | 'video' = 'image'): Promise<string> {
    let attempt = 0;
    const maxAttempts = NanoBananaClient.MAX_POLL_ATTEMPTS;
    const pollInterval = NanoBananaClient.POLL_INTERVAL_MS;
    const loadingMessages = [
        "Warming up the AI artists...",
        "Preparing the digital canvas...",
        "Composing your masterpiece...",
        "Mixing the digital paints...",
        "Adding the final touches...",
        "Almost ready, polishing the pixels...",
    ];

    while (attempt < maxAttempts) {
      const status = await this.getTaskStatus(taskId);
      const urlKey = resultType === 'video' ? 'resultVideoUrl' : 'resultImageUrl';
      const resourceType = resultType === 'video' ? 'video' : 'image';

      // successFlag: 0 for processing, 1 for success, 2 for failure, 3 for timeout
      if (status.successFlag === 1) {
          this.log(`Task complete. Retrieving ${resourceType}...`, { taskId, response: status.response });
          onStatusUpdate(`Task complete. Retrieving ${resourceType}...`);
          const url = status.response?.[urlKey];
          if (!url) {
              this.logError(`Task succeeded but did not return a ${resourceType} URL.`, { taskId, status });
              throw new Error(`NanoBanana task succeeded but did not return a ${resourceType} URL.`);
          }
          return url;
      }
      if (status.successFlag === 2 || status.successFlag === 3) {
        this.logError(`Task failed or timed out.`, { taskId, status });
        throw new Error(status.errorMessage || `NanoBanana ${resourceType} generation failed or timed out`);
      }
      onStatusUpdate(loadingMessages[attempt % loadingMessages.length]);
      await new Promise(r => setTimeout(r, pollInterval));
      attempt++;
    }
    this.logError('Timeout waiting for NanoBanana result', { taskId });
    throw new Error("Timeout waiting for NanoBanana image result");
  }
}
