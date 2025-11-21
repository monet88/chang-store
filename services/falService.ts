import { ImageFile, AspectRatio } from '../types';
import { getImageDimensions, blobToBase64 } from '../utils/imageUtils';

interface FalEditImageParams {
  images: ImageFile[];
  prompt: string;
  aspectRatio?: AspectRatio;
  negativePrompt?: string;
  numberOfImages?: number;
}

export interface FalApiConfig {
  falApiKey: string | null;
  onStatusUpdate: (message: string) => void;
}

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const getFalImageSize = async (images: ImageFile[], aspectRatio: AspectRatio | undefined): Promise<{ width: number, height: number }> => {
    const firstImage = images[0];
    const { width: originalWidth, height: originalHeight } = await getImageDimensions(firstImage.base64, firstImage.mimeType);

    if (aspectRatio && aspectRatio !== 'Default') {
        const [w, h] = aspectRatio.split(':').map(Number);
        const originalArea = originalWidth * originalHeight;
        const newWidth = Math.round(Math.sqrt(originalArea * (w / h)));
        const newHeight = Math.round(newWidth * (h / w));
        return { width: newWidth, height: newHeight };
    }
    return { width: originalWidth, height: originalHeight };
}

const getFalTextToImageSize = (aspectRatio: AspectRatio): { width: number, height: number } => {
    const baseSize = 1024;
    switch(aspectRatio) {
        case '9:16': return { width: 768, height: 1365 };
        case '16:9': return { width: 1365, height: 768 };
        case '4:3': return { width: 1152, height: 864 };
        case '3:4': return { width: 864, height: 1152 };
        case '1:1':
        case 'Default':
        default:
            return { width: baseSize, height: baseSize };
    }
};

const pollForResult = async (requestId: string, falApiKey: string, onStatusUpdate: (message: string) => void, pollInterval: number = 2000): Promise<any> => {
    const statusUrl = `https://fal.run/requests/${requestId}`;
    while (true) {
        const statusCheckResponse = await fetch(statusUrl, {
            headers: { 'Authorization': `Key ${falApiKey}` }
        });

        if (!statusCheckResponse.ok) {
            const errorBody = await statusCheckResponse.text();
            throw new Error(`FAL status check error (${statusCheckResponse.status}): ${errorBody}`);
        }

        const resultData = await statusCheckResponse.json();
        
        if (resultData.status === 'COMPLETED') {
            return resultData;
        } else if (resultData.status === 'FAILED' || resultData.status === 'ERROR') {
            throw new Error(`FAL job failed: ${JSON.stringify(resultData.error || 'Unknown error')}`);
        } else if (resultData.status === 'QUEUED') {
            onStatusUpdate('error.api.falQueued');
        } else if (resultData.status === 'IN_PROGRESS') {
            onStatusUpdate('error.api.falInProgress');
        }

        await sleep(pollInterval);
    }
};

const processImageResults = async (resultData: any): Promise<ImageFile[]> => {
    const resultImageUrls = resultData?.images?.map((img: any) => img.url) || [];
    if (resultImageUrls.length === 0) {
        throw new Error("FAL API did not return any image URLs.");
    }
    
    const imagePromises = resultImageUrls.map(async (url: string) => {
        const imageResponse = await fetch(url);
        if (!imageResponse.ok) {
            throw new Error(`Failed to fetch the generated image from URL: ${url}`);
        }
        const blob = await imageResponse.blob();
        const base64 = await blobToBase64(blob);
        return { base64, mimeType: blob.type };
    });
    
    return Promise.all(imagePromises);
};


export const falEditImage = async (
  params: FalEditImageParams,
  modelId: string,
  { falApiKey, onStatusUpdate }: FalApiConfig
): Promise<ImageFile[]> => {
    if (!falApiKey) throw new Error("error.api.falAuth");

    const imageSize = await getFalImageSize(params.images, params.aspectRatio);
    const imageUrls = params.images.map(img => `data:${img.mimeType};base64,${img.base64}`);

    const payload = {
        prompt: params.prompt,
        image_urls: imageUrls,
        negative_prompt: params.negativePrompt || '',
        image_size: imageSize,
        num_images: params.numberOfImages || 1,
        enable_safety_checker: false,
    };

    try {
        const queueResponse = await fetch(`https://fal.run/${modelId}`, {
            method: 'POST',
            headers: { 'Authorization': `Key ${falApiKey}`, 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (!queueResponse.ok) {
            const errorBody = await queueResponse.text();
            throw new Error(`FAL API error (${queueResponse.status}): ${errorBody}`);
        }

        const responseData = await queueResponse.json();
        let resultData;
        
        if (responseData.images && Array.isArray(responseData.images)) {
            resultData = responseData;
        } else if (responseData.request_id) {
            resultData = await pollForResult(responseData.request_id, falApiKey, onStatusUpdate);
        } else {
            const errorDetail = JSON.stringify(responseData);
            throw new Error(`FAL API returned an unexpected response format. Response: ${errorDetail}`);
        }
        
        return await processImageResults(resultData);

    } catch (error) {
        console.error("Error in falEditImage:", error);
        const errorMessage = error instanceof Error ? error.message : "error.unknown";
        throw new Error(`error.api.falFailed:${errorMessage}`);
    }
};

export const falGenerateImage = async (
    prompt: string,
    aspectRatio: AspectRatio,
    numberOfImages: number,
    modelId: string,
    { falApiKey, onStatusUpdate }: FalApiConfig
): Promise<ImageFile[]> => {
    if (!falApiKey) throw new Error("error.api.falAuth");

    const imageSize = getFalTextToImageSize(aspectRatio);

    const payload = {
        prompt: prompt,
        negative_prompt: '', // Can be extended if needed
        image_size: imageSize,
        num_images: numberOfImages || 1,
        enable_safety_checker: false,
    };
    
    try {
        const queueResponse = await fetch(`https://fal.run/${modelId}`, {
            method: 'POST',
            headers: { 'Authorization': `Key ${falApiKey}`, 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (!queueResponse.ok) {
            const errorBody = await queueResponse.text();
            throw new Error(`FAL API error (${queueResponse.status}): ${errorBody}`);
        }

        const responseData = await queueResponse.json();
        let resultData;
        
        if (responseData.images && Array.isArray(responseData.images)) {
            resultData = responseData;
        } else if (responseData.request_id) {
            resultData = await pollForResult(responseData.request_id, falApiKey, onStatusUpdate);
        } else {
            const errorDetail = JSON.stringify(responseData);
            throw new Error(`FAL API returned an unexpected response format. Response: ${errorDetail}`);
        }
        
        return await processImageResults(resultData);
    } catch (error) {
        console.error("Error in falGenerateImage:", error);
        const errorMessage = error instanceof Error ? error.message : "error.unknown";
        throw new Error(`error.api.falFailed:${errorMessage}`);
    }
};


export const falGenerateVideo = async (
  image: ImageFile,
  modelId: string,
  { falApiKey, onStatusUpdate }: FalApiConfig
): Promise<string> => {
    if (!falApiKey) {
        throw new Error("error.api.falAuth");
    }

    onStatusUpdate('Determining video dimensions...');
    const { width, height } = await getImageDimensions(image.base64, image.mimeType);

    const payload = {
        image_urls: [`data:${image.mimeType};base64,${image.base64}`],
        width,
        height,
    };

    try {
        onStatusUpdate('Submitting video generation job...');
        const queueResponse = await fetch(`https://fal.run/${modelId}`, {
            method: 'POST',
            headers: {
                'Authorization': `Key ${falApiKey}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });

        if (!queueResponse.ok) {
            const errorBody = await queueResponse.text();
            throw new Error(`FAL API error (${queueResponse.status}): ${errorBody}`);
        }

        const responseData = await queueResponse.json();
        let resultData;

        if (responseData.videos && Array.isArray(responseData.videos)) {
            resultData = responseData;
        } else if (responseData.request_id) {
             resultData = await pollForResult(responseData.request_id, falApiKey, onStatusUpdate, 5000);
        } else {
            const errorDetail = JSON.stringify(responseData);
            throw new Error(`FAL API returned an unexpected response format. Response: ${errorDetail}`);
        }
        
        const videoUrl = resultData?.videos?.[0]?.url;
        if (!videoUrl) {
            console.error("FAL response missing video URL:", resultData);
            throw new Error("FAL API did not return a video URL.");
        }
        
        return videoUrl;

    } catch (error) {
        console.error("Error in falGenerateVideo:", error);
        const errorMessage = error instanceof Error ? error.message : "error.unknown";
        throw new Error(`error.api.falFailed:${errorMessage}`);
    }
};
