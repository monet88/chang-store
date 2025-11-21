
import { NanoBananaClient } from "./nanoBananaClient";
import { ImageFile, AspectRatio } from '../types';
import { blobToBase64 } from "../utils/imageUtils";

function base64ToBlob(base64: string, mimeType: string): Blob {
    const byteCharacters = atob(base64);
    const byteNumbers = new Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    const byteArray = new Uint8Array(byteNumbers);
    return new Blob([byteArray], { type: mimeType });
}

async function uploadImageToHost(base64: string, mimeType: string): Promise<string> {
    const formData = new FormData();
    const blob = base64ToBlob(base64, mimeType);
    formData.append('image', blob);
    
    const response = await fetch('https://api.imgbb.com/1/upload?key=50ef5c99fef751406fc092c188e31310', {
        method: 'POST',
        body: formData
    });
    
    const data = await response.json();
    if (!response.ok || !data.success) {
        throw new Error(`Failed to upload image to host: ${data?.error?.message || 'Unknown error'}`);
    }
    return data.data.url;
}

// Add after imports
class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

class NanoBananaValidator {
  static readonly PROMPT_MAX_LENGTH = 4096;
  static readonly MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // ~10MB
  static readonly MAX_INPUT_IMAGES = 5;
  static readonly MAX_OUTPUT_IMAGES = 4;

  static validatePrompt(prompt: string): void {
    if (!prompt || prompt.trim().length === 0) {
      throw new ValidationError('Prompt cannot be empty');
    }
    if (prompt.length > this.PROMPT_MAX_LENGTH) {
      throw new ValidationError(`Prompt exceeds maximum length of ${this.PROMPT_MAX_LENGTH} characters`);
    }
  }

  static validateImages(images: ImageFile[], maxCount: number, purpose: string): void {
    if (images.length > maxCount) {
      throw new ValidationError(`Cannot use more than ${maxCount} ${purpose} images`);
    }
    
    for (const img of images) {
      const estimatedSize = img.base64.length * 0.75; // Base64 is ~4/3 the size of original
      if (estimatedSize > this.MAX_FILE_SIZE_BYTES) {
        throw new ValidationError(`An input image exceeds the maximum size of ~10MB`);
      }
    }
  }

  static validateOutputCount(count: number | undefined): void {
    if (count && count > this.MAX_OUTPUT_IMAGES) {
      throw new ValidationError(`Cannot generate more than ${this.MAX_OUTPUT_IMAGES} images at a time`);
    }
    if (count && count < 1) {
      throw new ValidationError('Number of images must be at least 1');
    }
  }
}

interface EditImageParams {
  images: ImageFile[];
  prompt: string;
  negativePrompt?: string;
  numberOfImages?: number;
  aspectRatio?: AspectRatio;
}
interface ApiConfig {
    falApiKey: string | null;
    nanobananaApiKey: string | null;
    onStatusUpdate: (message: string) => void;
}

export const nanoBananaGenerate = async (
  params: EditImageParams,
  model: string,
  config: ApiConfig
): Promise<ImageFile[]> => {
  if (!config.nanobananaApiKey) {
      throw new Error("error.api.nanobananaAuth");
  }

  try {
    NanoBananaValidator.validatePrompt(params.prompt);
    NanoBananaValidator.validateOutputCount(params.numberOfImages);
    NanoBananaValidator.validateImages(params.images, NanoBananaValidator.MAX_INPUT_IMAGES, 'input');
  } catch (error) {
    if (error instanceof ValidationError) {
      throw error;
    }
    throw new Error(`Validation failed: ${error}`);
  }

  try {
    const client = new NanoBananaClient(config.nanobananaApiKey, true);

    const type = params.images?.length > 0 ? "IMAGETOIAMGE" : "TEXTTOIAMGE";
    
    config.onStatusUpdate(`Uploading reference images...`);
    const imageUrls = type === 'IMAGETOIAMGE' && params.images.length > 0
        ? await Promise.all(params.images.map(img => uploadImageToHost(img.base64, img.mimeType)))
        : undefined;

    // Use string-based aspect ratio as per documentation
    const image_size = (params.aspectRatio && params.aspectRatio !== 'Default') ? params.aspectRatio : undefined;

    const numImagesToGenerate = params.numberOfImages || 1;
    config.onStatusUpdate(`Submitting ${numImagesToGenerate} job(s) to NanoBanana...`);

    // Submit all jobs in parallel
    const taskIds = await Promise.all(
      Array.from({ length: numImagesToGenerate }, async (_, i) => {
        config.onStatusUpdate(`Submitting job ${i + 1}/${numImagesToGenerate}...`);
        return await client.generate(params.prompt, {
          type,
          imageUrls,
          image_size,
          numImages: 1,
          enable_safety_checker: false,
        });
      })
    );

    // Wait for all results in parallel
    const resultUrls = await Promise.all(
      taskIds.map((taskId, i) => 
        client.waitForResult(
          taskId, 
          (msg) => config.onStatusUpdate(`[${i + 1}/${numImagesToGenerate}] ${msg}`),
          'image'
        )
      )
    );

    // Download all images in parallel
    config.onStatusUpdate('Downloading all generated images...');
    const allGeneratedImages = await Promise.all(
      resultUrls.map(async (resultImageUrl, i) => {
        const response = await fetch(resultImageUrl);
        if (!response.ok) {
          throw new Error(`Failed to download image ${i + 1}: ${response.statusText}`);
        }
        const blob = await response.blob();
        const base64 = await blobToBase64(blob);
        return {
          base64,
          mimeType: blob.type || 'image/png',
        };
      })
    );

    return allGeneratedImages;
  } catch (error) {
    console.error("Error in nanoBananaGenerate:", error);
    if (error instanceof Error) {
        if (error.message.startsWith('nb:')) {
            // This is a custom, user-friendly error from the client. Strip the prefix and re-throw.
            throw new Error(error.message.substring(3));
        }
        if (error.message === "error.api.nanobananaAuth") {
            throw error; // This is a translation key, pass it through.
        }
        // For all other errors (network, client-side issues), wrap them for context.
        throw new Error(`error.api.nanobananaFailed:${error.message}`);
    }
    // Fallback for non-Error types
    throw new Error(`error.api.nanobananaFailed:error.unknown`);
  }
};

export const nanoBananaGenerateVideo = async (
  faceImage: ImageFile,
  prompt: string,
  model: string,
  config: ApiConfig
): Promise<string> => {
  if (!config.nanobananaApiKey) {
      throw new Error("error.api.nanobananaAuth");
  }

  try {
    NanoBananaValidator.validatePrompt(prompt);
    NanoBananaValidator.validateImages([faceImage], 1, 'input');
  } catch (error) {
    if (error instanceof ValidationError) {
      throw error;
    }
    throw new Error(`Validation failed: ${error}`);
  }

  try {
    const client = new NanoBananaClient(config.nanobananaApiKey, true);

    config.onStatusUpdate(`Uploading reference image...`);
    const imageUrl = await uploadImageToHost(faceImage.base64, faceImage.mimeType);
    const imageUrls = [imageUrl];
    
    config.onStatusUpdate(`Submitting video job to NanoBanana...`);
      
    const taskId = await client.generate(prompt, {
      type: "IMAGETOVIDEO",
      imageUrls: imageUrls,
      enable_safety_checker: false,
    });
    config.onStatusUpdate(`Job submitted (ID: ${taskId}). Waiting for result...`);

    const resultVideoUrl = await client.waitForResult(taskId, config.onStatusUpdate, 'video');
    
    return resultVideoUrl;

  } catch (error) {
    console.error("Error in nanoBananaGenerateVideo:", error);
    if (error instanceof Error) {
        if (error.message.startsWith('nb:')) {
            throw new Error(error.message.substring(3));
        }
        if (error.message === "error.api.nanobananaAuth") {
            throw error;
        }
        throw new Error(`error.api.nanobananaFailed:${error.message}`);
    }
    throw new Error(`error.api.nanobananaFailed:error.unknown`);
  }
};
