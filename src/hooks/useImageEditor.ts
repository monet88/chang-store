import { useCallback, type Dispatch, type SetStateAction } from 'react';
import { ImageFile } from '../types';
import { editImage, generateImage } from '../services/imageEditingService';
import { getErrorMessage } from '../utils/imageUtils';

interface CanvasMetrics {
  dx: number;
  dy: number;
  scale: number;
  iw: number;
  ih: number;
}

interface UseImageEditorServiceActionsParams {
  isLoading: boolean;
  currentImage: ImageFile | null;
  selectionPath: Path2D | null;
  getCanvasAndImageMetrics: () => CanvasMetrics | null;
  imageEditModel: string;
  imageGenerateModel: string;
  t: (key: string, params?: Record<string, unknown>) => string;
  setIsLoading: (isLoading: boolean) => void;
  setError: (error: string | null) => void;
  setLoadingMessage: (message: string) => void;
  addToHistory: (image: ImageFile) => void;
  handleDeselect: () => void;
  loadNewImage: (image: ImageFile) => void;
  setView: Dispatch<SetStateAction<'launcher' | 'editor'>>;
}

const buildImageServiceConfig = (onStatusUpdate: (message: string) => void) => ({
  onStatusUpdate,
});

export const useImageEditorServiceActions = ({
  isLoading,
  currentImage,
  selectionPath,
  getCanvasAndImageMetrics,
  imageEditModel,
  imageGenerateModel,
  t,
  setIsLoading,
  setError,
  setLoadingMessage,
  addToHistory,
  handleDeselect,
  loadNewImage,
  setView,
}: UseImageEditorServiceActionsParams) => {
  const performApiAction = useCallback(
    async (actionKey: string, params: Record<string, string | number> = {}) => {
      if (isLoading || !currentImage) return;

      setIsLoading(true);
      setError(null);
      setLoadingMessage(`Performing: ${actionKey}...`);

      let finalImages: ImageFile[] = [currentImage];
      let finalActionKey = actionKey;

      if (selectionPath) {
        const potentialMaskedKey = `${actionKey}Masked`;
        const maskedTemplate = t(`imageEditor.modal.apiPrompts.${potentialMaskedKey}`);

        if (maskedTemplate && maskedTemplate !== `imageEditor.modal.apiPrompts.${potentialMaskedKey}`) {
          finalActionKey = potentialMaskedKey;

          const maskCanvas = document.createElement('canvas');
          const metrics = getCanvasAndImageMetrics();
          if (metrics) {
            maskCanvas.width = metrics.iw;
            maskCanvas.height = metrics.ih;
            const maskCtx = maskCanvas.getContext('2d');
            if (maskCtx) {
              maskCtx.fillStyle = 'black';
              maskCtx.fillRect(0, 0, metrics.iw, metrics.ih);

              const transform = new DOMMatrix().translate(-metrics.dx, -metrics.dy).scale(1 / metrics.scale);
              const imageSpacePath = new Path2D();
              imageSpacePath.addPath(selectionPath, transform);

              maskCtx.fillStyle = 'white';
              maskCtx.fill(imageSpacePath);
              const maskBase64 = maskCanvas.toDataURL('image/png').split(',')[1];
              finalImages.push({ base64: maskBase64, mimeType: 'image/png' });
            }
          }
        }
      }

      const taskPromptTemplate = t(`imageEditor.modal.apiPrompts.${finalActionKey}`);
      const taskPrompt = Object.entries(params).reduce(
        (prompt, [key, value]) => prompt.replace(new RegExp(`{{${key}}}`, 'g'), String(value)),
        taskPromptTemplate,
      );

      try {
        const [result] = await editImage(
          { images: finalImages, prompt: taskPrompt, numberOfImages: 1 },
          imageEditModel,
          buildImageServiceConfig(setLoadingMessage),
        );
        addToHistory(result);
        handleDeselect();
      } catch (err) {
        setError(getErrorMessage(err, t));
      } finally {
        setIsLoading(false);
      }
    },
    [
      addToHistory,
      currentImage,
      getCanvasAndImageMetrics,
      handleDeselect,
      imageEditModel,
      isLoading,
      selectionPath,
      setError,
      setIsLoading,
      setLoadingMessage,
      t,
    ],
  );

  const handleGenerateAIEdit = useCallback(
    async (prompt: string) => {
      if (!prompt.trim()) return;

      if (!currentImage) {
        setIsLoading(true);
        setError(null);
        setLoadingMessage('Generating new image...');
        try {
          const [result] = await generateImage(
            prompt,
            '1:1',
            1,
            imageGenerateModel,
            buildImageServiceConfig(setLoadingMessage),
          );
          loadNewImage(result);
          setView('editor');
        } catch (err) {
          setError(getErrorMessage(err, t));
        } finally {
          setIsLoading(false);
        }

        return;
      }

      const actionKey = selectionPath ? 'aiEditMasked' : 'aiEditFull';
      await performApiAction(actionKey, { prompt });
    },
    [
      currentImage,
      imageGenerateModel,
      loadNewImage,
      performApiAction,
      selectionPath,
      setError,
      setIsLoading,
      setLoadingMessage,
      setView,
      t,
    ],
  );

  const handleApplyAccessory = useCallback(
    async (type: string, accessoryImageFile: ImageFile) => {
      if (!currentImage || isLoading) return;

      const accessoryName = t(`imageEditor.modal.rightPanel.accessories.${type}`);
      const placementInstruction = t(`imageEditor.modal.rightPanel.accessoryPrompts.${type}`);

      let prompt = `Take the accessory ('${accessoryName}') from the second image and place it photorealistically onto the person in the first image. The accessory ${placementInstruction}. The final image must be high-resolution and seamlessly edited.`;
      const finalImages: ImageFile[] = [currentImage, accessoryImageFile];

      if (selectionPath) {
        const metrics = getCanvasAndImageMetrics();
        if (metrics) {
          const maskCanvas = document.createElement('canvas');
          maskCanvas.width = metrics.iw;
          maskCanvas.height = metrics.ih;
          const maskCtx = maskCanvas.getContext('2d');
          if (maskCtx) {
            maskCtx.fillStyle = 'black';
            maskCtx.fillRect(0, 0, metrics.iw, metrics.ih);
            const transform = new DOMMatrix().translate(-metrics.dx, -metrics.dy).scale(1 / metrics.scale);
            const imageSpacePath = new Path2D();
            imageSpacePath.addPath(selectionPath, transform);
            maskCtx.fillStyle = 'white';
            maskCtx.fill(imageSpacePath);
            const maskBase64 = maskCanvas.toDataURL('image/png').split(',')[1];
            finalImages.push({ base64: maskBase64, mimeType: 'image/png' });

            prompt = `# INSTRUCTION: MASKED ACCESSORY PLACEMENT\n\n## IMAGE ROLES:\n- Image 1 (Source): The original image.\n- Image 2 (Accessory): The accessory to be placed.\n- Image 3 (Mask): A black and white mask. The **white area** specifies the *only* region where the accessory can be placed.\n\n## REQUEST:\nTake the accessory from Image 2 and place it photorealistically onto the person in Image 1, strictly within the white area of the mask (Image 3). The accessory is a '${accessoryName}' and it should be ${placementInstruction}. The final image must be high-resolution and seamlessly edited.`;
          }
        }
      }

      setIsLoading(true);
      setError(null);
      setLoadingMessage(t('imageEditor.modal.rightPanel.applyingAccessory'));

      try {
        const [result] = await editImage(
          { images: finalImages, prompt, numberOfImages: 1 },
          imageEditModel,
          buildImageServiceConfig(setLoadingMessage),
        );
        addToHistory(result);
        handleDeselect();
      } catch (err) {
        setError(getErrorMessage(err, t));
      } finally {
        setIsLoading(false);
      }
    },
    [
      addToHistory,
      currentImage,
      getCanvasAndImageMetrics,
      handleDeselect,
      imageEditModel,
      isLoading,
      selectionPath,
      setError,
      setIsLoading,
      setLoadingMessage,
      t,
    ],
  );

  return {
    performApiAction,
    handleGenerateAIEdit,
    handleApplyAccessory,
  };
};
