import { useMemo } from 'react';
import { Feature, SelectableModel } from '../types';
import { resolveModelSelectionScope } from '../config/modelSelectionRules';
import { getModelsBySelectionType } from '../config/modelRegistry';
import { useApi } from '../contexts/ApiProviderContext';
import { useServedModels } from './useServedModels';

interface ModelSetterMap {
  imageEdit: (modelId: string) => void;
  imageGenerate: (modelId: string) => void;
  textGenerate: (modelId: string) => void;
}

interface UseModelSelectionParams {
  activeFeature: Feature;
  imageEditModel: string;
  imageGenerateModel: string;
  textGenerateModel: string;
  setImageEditModel: (modelId: string) => void;
  setImageGenerateModel: (modelId: string) => void;
  setTextGenerateModel: (modelId: string) => void;
}

const toSelectableModels = (
  models: ReturnType<typeof getModelsBySelectionType>,
): SelectableModel[] => models.map(({ modelId, label }) => ({ modelId, label }));

export const useModelSelection = ({
  activeFeature,
  imageEditModel,
  imageGenerateModel,
  textGenerateModel,
  setImageEditModel,
  setImageGenerateModel,
  setTextGenerateModel,
}: UseModelSelectionParams) => {
  const { geminiProfile, servedModelsVersion } = useApi();
  // Gemini features see the Gemini lane's served models only (lane-scoped picker).
  const geminiServed = useServedModels(geminiProfile.baseUrl, geminiProfile.apiKey, servedModelsVersion);

  const selectedModelBySelectionType = useMemo(
    () => ({
      imageEdit: imageEditModel,
      imageGenerate: imageGenerateModel,
      textGenerate: textGenerateModel,
    }),
    [imageEditModel, imageGenerateModel, textGenerateModel],
  );

  const modelSetterBySelectionType: ModelSetterMap = useMemo(
    () => ({
      imageEdit: setImageEditModel,
      imageGenerate: setImageGenerateModel,
      textGenerate: setTextGenerateModel,
    }),
    [setImageEditModel, setImageGenerateModel, setTextGenerateModel],
  );

  const activeModelSelectionScope = useMemo(
    () => resolveModelSelectionScope(activeFeature, geminiServed),
    [activeFeature, geminiServed],
  );

  const textGenerationOptions = useMemo(
    () => toSelectableModels(getModelsBySelectionType('textGenerate')),
    [],
  );

  const getSelectedModelBySelectionType = (
    selectionType: 'imageEdit' | 'imageGenerate' | 'textGenerate',
  ): string => selectedModelBySelectionType[selectionType];

  const getModelSetterBySelectionType = (
    selectionType: 'imageEdit' | 'imageGenerate' | 'textGenerate',
  ): (modelId: string) => void => modelSetterBySelectionType[selectionType];

  return {
    activeModelSelectionScope,
    textGenerationOptions,
    getSelectedModelBySelectionType,
    getModelSetterBySelectionType,
  };
};
