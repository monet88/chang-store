import { Feature } from '../../../types';

/**
 * UI descriptor for a provider studio workflow. Provider studios reuse the five
 * supported features but drive simpler prompt + image inputs than the Gemini
 * feature components. This config tells the studio UI what to render per feature
 * without embedding business logic.
 */
export interface ProviderWorkflowConfig {
  feature: Feature;
  /** i18n key for the workflow title. */
  titleKey: string;
  /** i18n key for the workflow description. */
  descriptionKey: string;
  /** i18n key for the image uploader label. */
  uploadLabelKey: string;
  /** Whether this workflow accepts source images (edit) or is prompt-only (generate). */
  acceptsImages: boolean;
  /** Whether images are required to submit. */
  requiresImages: boolean;
  /** i18n key for the prompt textarea placeholder. */
  promptPlaceholderKey: string;
}

export const PROVIDER_WORKFLOWS: Record<Feature, ProviderWorkflowConfig> = {
  [Feature.AIEditor]: {
    feature: Feature.AIEditor,
    titleKey: 'studio.workflows.aiEditor.title',
    descriptionKey: 'studio.workflows.aiEditor.description',
    uploadLabelKey: 'studio.workflows.aiEditor.upload',
    acceptsImages: true,
    requiresImages: true,
    promptPlaceholderKey: 'studio.workflows.aiEditor.promptPlaceholder',
  },
  [Feature.TryOn]: {
    feature: Feature.TryOn,
    titleKey: 'studio.workflows.tryOn.title',
    descriptionKey: 'studio.workflows.tryOn.description',
    uploadLabelKey: 'studio.workflows.tryOn.upload',
    acceptsImages: true,
    requiresImages: true,
    promptPlaceholderKey: 'studio.workflows.tryOn.promptPlaceholder',
  },
  [Feature.Lookbook]: {
    feature: Feature.Lookbook,
    titleKey: 'studio.workflows.lookbook.title',
    descriptionKey: 'studio.workflows.lookbook.description',
    uploadLabelKey: 'studio.workflows.lookbook.upload',
    acceptsImages: true,
    requiresImages: true,
    promptPlaceholderKey: 'studio.workflows.lookbook.promptPlaceholder',
  },
  [Feature.ClothingTransfer]: {
    feature: Feature.ClothingTransfer,
    titleKey: 'studio.workflows.clothingTransfer.title',
    descriptionKey: 'studio.workflows.clothingTransfer.description',
    uploadLabelKey: 'studio.workflows.clothingTransfer.upload',
    acceptsImages: true,
    requiresImages: true,
    promptPlaceholderKey: 'studio.workflows.clothingTransfer.promptPlaceholder',
  },
  [Feature.PatternGenerator]: {
    feature: Feature.PatternGenerator,
    titleKey: 'studio.workflows.patternGenerator.title',
    descriptionKey: 'studio.workflows.patternGenerator.description',
    uploadLabelKey: 'studio.workflows.patternGenerator.upload',
    acceptsImages: true,
    requiresImages: false,
    promptPlaceholderKey: 'studio.workflows.patternGenerator.promptPlaceholder',
  },
  // Gemini-only features are not used in provider studios; provide safe fallbacks.
  [Feature.Background]: {
    feature: Feature.Background,
    titleKey: 'studio.workflows.aiEditor.title',
    descriptionKey: 'studio.workflows.aiEditor.description',
    uploadLabelKey: 'studio.workflows.aiEditor.upload',
    acceptsImages: true,
    requiresImages: true,
    promptPlaceholderKey: 'studio.workflows.aiEditor.promptPlaceholder',
  },
  [Feature.Pose]: {
    feature: Feature.Pose,
    titleKey: 'studio.workflows.aiEditor.title',
    descriptionKey: 'studio.workflows.aiEditor.description',
    uploadLabelKey: 'studio.workflows.aiEditor.upload',
    acceptsImages: true,
    requiresImages: true,
    promptPlaceholderKey: 'studio.workflows.aiEditor.promptPlaceholder',
  },
  [Feature.WatermarkRemover]: {
    feature: Feature.WatermarkRemover,
    titleKey: 'studio.workflows.aiEditor.title',
    descriptionKey: 'studio.workflows.aiEditor.description',
    uploadLabelKey: 'studio.workflows.aiEditor.upload',
    acceptsImages: true,
    requiresImages: true,
    promptPlaceholderKey: 'studio.workflows.aiEditor.promptPlaceholder',
  },
  [Feature.PhotoAlbum]: {
    feature: Feature.PhotoAlbum,
    titleKey: 'studio.workflows.patternGenerator.title',
    descriptionKey: 'studio.workflows.patternGenerator.description',
    uploadLabelKey: 'studio.workflows.patternGenerator.upload',
    acceptsImages: false,
    requiresImages: false,
    promptPlaceholderKey: 'studio.workflows.patternGenerator.promptPlaceholder',
  },
};

export function getProviderWorkflow(feature: Feature): ProviderWorkflowConfig {
  return PROVIDER_WORKFLOWS[feature] ?? PROVIDER_WORKFLOWS[Feature.AIEditor];
}
