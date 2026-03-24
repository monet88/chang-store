import {
  LOCAL_TEXT_MODELS as LOCAL_TEXT_MODELS_DATA,
  LOCAL_IMAGE_MODELS as LOCAL_IMAGE_MODELS_DATA,
} from './localModels.data.js';

export type LocalModelOption = {
  id: string;
  name: string;
};

export const withLocalPrefix = (id: string): string => `local--${id}`;

export const LOCAL_TEXT_MODELS: LocalModelOption[] = LOCAL_TEXT_MODELS_DATA;
export const LOCAL_IMAGE_MODELS: LocalModelOption[] = LOCAL_IMAGE_MODELS_DATA;

export const LOCAL_TEXT_MODELS_WITH_PREFIX: LocalModelOption[] = LOCAL_TEXT_MODELS_DATA.map(model => ({
  ...model,
  id: withLocalPrefix(model.id),
}));

export const LOCAL_IMAGE_MODELS_WITH_PREFIX: LocalModelOption[] = LOCAL_IMAGE_MODELS_DATA.map(model => ({
  ...model,
  id: withLocalPrefix(model.id),
}));
