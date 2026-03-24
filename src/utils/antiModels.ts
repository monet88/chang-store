import {
  ANTI_TEXT_MODELS as ANTI_TEXT_MODELS_DATA,
  ANTI_IMAGE_MODELS as ANTI_IMAGE_MODELS_DATA,
} from './antiModels.data.js';

export type AntiModelOption = {
  id: string;
  name: string;
};

export const withAntiPrefix = (id: string): string => `anti--${id}`;

export const ANTI_TEXT_MODELS: AntiModelOption[] = ANTI_TEXT_MODELS_DATA;
export const ANTI_IMAGE_MODELS: AntiModelOption[] = ANTI_IMAGE_MODELS_DATA;

export const ANTI_TEXT_MODELS_WITH_PREFIX: AntiModelOption[] = ANTI_TEXT_MODELS_DATA.map(model => ({
  ...model,
  id: withAntiPrefix(model.id),
}));

export const ANTI_IMAGE_MODELS_WITH_PREFIX: AntiModelOption[] = ANTI_IMAGE_MODELS_DATA.map(model => ({
  ...model,
  id: withAntiPrefix(model.id),
}));
