import axios, { AxiosError } from 'axios';
import { AIVideoAutoModel, ImageFile } from '../types';

const API_BASE = 'https://api.gommo.net/ai';
const DOMAIN = 'aivideoauto.com';

// Helper function to convert JSON to URL-encoded format
const jsonToFormUrlEncoded = (data: any): string => {
  const params = new URLSearchParams();
  
  const appendToParams = (key: string, value: any) => {
    if (value === null || value === undefined) return;
    
    if (typeof value === 'object' && !Array.isArray(value)) {
      params.append(key, JSON.stringify(value));
    } else if (Array.isArray(value)) {
      params.append(key, JSON.stringify(value));
    } else {
      params.append(key, String(value));
    }
  };
  
  Object.entries(data).forEach(([key, value]) => {
    appendToParams(key, value);
  });
  
  return params.toString();
};

// Create an Axios instance
const api = axios.create({
  baseURL: API_BASE,
  headers: {
    'Content-Type': 'application/x-www-form-urlencoded',
  },
});

// Transform request data to form-urlencoded
api.interceptors.request.use((config) => {
  if (config.data && config.headers['Content-Type'] === 'application/x-www-form-urlencoded') {
    config.data = jsonToFormUrlEncoded(config.data);
  }
  return config;
});

// Add a response interceptor for unified error handling
api.interceptors.response.use(
  (response) => {
    // If response is successful, check for application-level errors in the data
    const data = response.data;
    
    // Log response for debugging
    console.log('[AIVideoAuto API] Response:', {
      url: response.config.url,
      status: response.status,
      data: data
    });
    
    if (data.error && data.message) {
      if (data.message.includes("Model không hợp lệ")) {
        throw new Error("Model không hợp lệ. Vui lòng kiểm tra lại model được chọn trong cài đặt.");
      }
      throw new Error(data.message);
    }
    return response;
  },
  (error: AxiosError) => {
    console.error('[AIVideoAuto API] Error:', {
      url: error.config?.url,
      status: error.response?.status,
      data: error.response?.data
    });
    
    if (error.response) {
      const errorData = error.response.data as any;
      const errorMessage = errorData?.message || errorData?.error?.message || 'Lỗi không xác định từ máy chủ.';
      
      if (errorMessage.includes("Model không hợp lệ")) {
        throw new Error("Model không hợp lệ. Vui lòng kiểm tra lại model được chọn trong cài đặt.");
      }
      
      throw new Error(errorMessage);
    } else if (error.request) {
      throw new Error('Không nhận được phản hồi từ máy chủ. Vui lòng kiểm tra kết nối mạng của bạn.');
    } else {
      throw new Error(`Lỗi yêu cầu: ${error.message}`);
    }
  }
);

// 1. Get Model List
export const listModels = async (accessToken: string, type: 'image' | 'video'): Promise<AIVideoAutoModel[]> => {
  try {
    const response = await api.post('/models', { access_token: accessToken, domain: DOMAIN, type });
    
    console.log('[AIVideoAuto] listModels response:', {
      type,
      fullResponse: response.data,
    });
    
    const rawModels = response.data.data;
    
    if (!Array.isArray(rawModels)) {
        console.error('[AIVideoAuto] Expected array for models data, got:', typeof rawModels);
        return [];
    }

    const models: AIVideoAutoModel[] = rawModels.map((m: any) => {
        // Create a clean object to avoid prototype issues or mutations
        const model = { ...m };
        
        // Polyfill id_base if missing
        if (!model.id_base) {
            const fallbackId = model.id || model._id || model.model;
            if (fallbackId) {
               model.id_base = String(fallbackId);
            } else {
               // Last resort: generate a random ID
               model.id_base = `generated-${Math.random().toString(36).substr(2, 9)}`;
            }
        }
        return model;
    });
    
    // Sanity check
    const invalidModels = models.filter(m => !m.id_base);
    if (invalidModels.length > 0) {
      console.error('[AIVideoAuto] Found models without id_base even after polyfill:', JSON.stringify(invalidModels));
    }
    
    return models;
  } catch (error) {
    console.error('[AIVideoAuto] listModels failed:', error);
    throw error;
  }
};

// 4. Upload Image to the System
export const uploadImage = async (accessToken: string, image: ImageFile): Promise<{ id_base: string; url: string }> => {
    // Remove data URL prefix if present, keep only base64 data
    const base64Data = image.base64.split(',').pop() || image.base64;
    
    console.log('[AIVideoAuto] Uploading image:', {
        base64Length: base64Data.length,
        mimeType: image.mimeType
    });
    
    const response = await api.post('/image-upload', {
        access_token: accessToken,
        domain: DOMAIN,
        data: base64Data,
        project_id: 'default',
        file_name: `upload-${Date.now()}`,
    });
    
    const data = response.data;
    console.log('[AIVideoAuto] Upload response:', data);
    
    // Try to extract id_base and url from various possible response structures
    let id_base: string | undefined;
    let url: string | undefined;
    
    // Direct properties
    if (data.id_base && data.url) {
        id_base = data.id_base;
        url = data.url;
    }
    // Nested in imageInfo
    else if (data.imageInfo) {
        id_base = data.imageInfo.id_base;
        url = data.imageInfo.url;
    }
    // Nested in data
    else if (data.data) {
        id_base = data.data.id_base;
        url = data.data.url;
    }
    
    if (!id_base || !url) {
        console.error('[AIVideoAuto] Missing required fields in response:', {
            fullResponse: data,
            hasIdBase: !!id_base,
            hasUrl: !!url
        });
        throw new Error(`Tải lên ảnh thất bại, không nhận được thông tin cần thiết.\nResponse: ${JSON.stringify(data, null, 2)}`);
    }
    
    console.log('[AIVideoAuto] Successfully uploaded:', { id_base, url });
    return { id_base, url };
};

// 5. Check Image Status
const getImageStatus = async (accessToken: string, imageId: string): Promise<any> => {
    const response = await api.post('/image', { 
        access_token: accessToken, 
        domain: DOMAIN, 
        id_base: imageId 
    });
    return response.data;
};

// 6. Poll for image completion
const pollForImage = async (accessToken: string, imageId: string): Promise<string> => {
    const pollInterval = 3000; // 3 seconds
    const maxAttempts = 40; // 2 minutes max
    
    for (let i = 0; i < maxAttempts; i++) {
        try {
            const result = await getImageStatus(accessToken, imageId);
            
            console.log('[AIVideoAuto] Image status:', result.status);
            
            if (result.status === 'SUCCESS') {
                if (!result.url) {
                    throw new Error('Tạo ảnh thành công nhưng không có URL.');
                }
                return result.url;
            }
            if (result.status === 'ERROR') {
                throw new Error('Tạo ảnh thất bại.');
            }
            // Status is PENDING_ACTIVE or PENDING_PROCESSING, continue polling
            await new Promise(resolve => setTimeout(resolve, pollInterval));
        } catch (error) {
            console.error('[AIVideoAuto] Error polling image:', error);
            throw error;
        }
    }
    throw new Error('Tạo ảnh quá thời gian sau 2 phút.');
};

// 7. Generate or Edit Image
export const createImage = async (accessToken: string, params: {
    model: string;
    prompt: string;
    subjects?: ImageFile[];
    ratio?: '9_16' | '16_9' | '1_1' | '4_3' | '3_4';
}): Promise<ImageFile> => {
    let subjectPayload;
    if (params.subjects && params.subjects.length > 0) {
        // Upload each subject image to get its id_base and url
        // The API requires 'data' (raw base64), 'url', and optionally 'id_base' in the subjects array
        subjectPayload = await Promise.all(
            params.subjects.map(async (imgFile) => {
                const uploaded = await uploadImage(accessToken, imgFile);
                const cleanBase64 = imgFile.base64.split(',').pop() || imgFile.base64;
                return {
                    id_base: uploaded.id_base,
                    url: uploaded.url,
                    data: cleanBase64
                };
            })
        );
    }

    const bodyParams: any = {
        access_token: accessToken,
        domain: DOMAIN,
        action_type: 'create',
        model: params.model,
        prompt: params.prompt,
        project_id: 'default',
        ratio: params.ratio,
        subjects: subjectPayload
    };

    console.log('[AIVideoAuto] Creating image with params:', bodyParams);
    
    const response = await api.post('/generateImage', bodyParams);
    const data = response.data;
    
    console.log('[AIVideoAuto] Create image response:', data);
    
    // Extract image ID from response
    const imageId = data.imageInfo?.id_base || data.id_base;
    if (!imageId) {
        throw new Error('Tạo ảnh không trả về ID hợp lệ.');
    }
    
    // Poll for image completion
    console.log('[AIVideoAuto] Polling for image completion, ID:', imageId);
    const imageUrl = await pollForImage(accessToken, imageId);
    
    console.log('[AIVideoAuto] Image ready, downloading from:', imageUrl);
    
    // Download the image
    const imageResponse = await axios.get(imageUrl, { responseType: 'blob' });
    const blob = imageResponse.data;
    const reader = new FileReader();
    return new Promise((resolve, reject) => {
        reader.onloadend = () => {
            const base64 = (reader.result as string).split(',')[1];
            resolve({ base64, mimeType: blob.type });
        };
        reader.onerror = reject;
        reader.readAsDataURL(blob);
    });
};

// 2. Create Video Generation Task
export const createVideoTask = async (accessToken: string, params: { model: string; prompt: string; images: { id_base: string; url: string }[] }): Promise<string> => {
    const response = await api.post('/create-video', {
        access_token: accessToken,
        domain: DOMAIN,
        model: params.model,
        privacy: 'PRIVATE',
        prompt: params.prompt,
        translate_to_en: 'false',
        images: params.images,
    });
    const data = response.data;
    
    if (!data.videoInfo || !data.videoInfo.id_base) {
        throw new Error('Tạo tác vụ video thất bại, không nhận được ID video.');
    }
    return data.videoInfo.id_base;
};

// 3. Check Video Render Status
const getVideoStatus = async (accessToken: string, videoId: string): Promise<any> => {
    const response = await api.post('/video', { access_token: accessToken, domain: DOMAIN, videoId });
    return response.data;
};

// Poll for video completion
export const pollForVideo = async (accessToken: string, videoId: string, onStatusUpdate: (message: string) => void): Promise<string> => {
    const pollInterval = 10000;
    const maxAttempts = 60; // 10 minutes
    
    for (let i = 0; i < maxAttempts; i++) {
        try {
            const responseData = await getVideoStatus(accessToken, videoId);
            // Un-nest the response if it's in a `videoInfo` or `data` property.
            const result = responseData.videoInfo || responseData.data || responseData;

            // Defensive check for status property
            if (typeof result?.status !== 'string') {
                console.error('Invalid status response from AIVideoAuto, status property missing or not a string:', responseData);
                throw new Error('Trạng thái video không hợp lệ nhận được từ API.');
            }

            const friendlyStatus = result.status.replace('MEDIA_GENERATION_STATUS_', '');
            onStatusUpdate(`Đang kiểm tra trạng thái: ${friendlyStatus}`);
            
            if (result.status === 'MEDIA_GENERATION_STATUS_SUCCESSFUL') {
                if (!result.download_url) {
                    throw new Error('Tạo video thành công nhưng không có URL tải xuống.');
                }
                return result.download_url;
            }
            if (result.status === 'MEDIA_GENERATION_STATUS_FAILED') {
                throw new Error('Tạo video thất bại.');
            }
            await new Promise(resolve => setTimeout(resolve, pollInterval));
        } catch (error) {
            console.error('Lỗi khi thăm dò:', error);
            throw error;
        }
    }
    throw new Error('Tạo video quá thời gian sau 10 phút.');
};