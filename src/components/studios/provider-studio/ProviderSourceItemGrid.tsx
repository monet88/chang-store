import React from 'react';
import { ImageFile, VirtualTryOnSourceItemType } from '../../../types';
import { useLanguage } from '../../../contexts/LanguageContext';
import ImageUploader from '../../ImageUploader';
import ProviderSourceItemCard from './ProviderSourceItemCard';

interface ProviderSourceItemGridProps {
  idPrefix: string;
  images: ImageFile[];
  /** i18n key for the subject uploader title. */
  subjectLabelKey: string;
  maxImages: number;
  showType: boolean;
  showNote: boolean;
  sourceItemTypes: VirtualTryOnSourceItemType[];
  sourceItemNotes: string[];
  onSetSubject: (image: ImageFile | null) => void;
  onAddItem: (image: ImageFile) => void;
  onRemoveItem: (index: number) => void;
  onReplaceItem: (index: number, image: ImageFile) => void;
  onTypeChange: (index: number, type: VirtualTryOnSourceItemType) => void;
  onNoteChange: (index: number, note: string) => void;
}

/**
 * Per-item source card grid (mirrors Gemini Try-On): subject uploader on top,
 * then a card per source image, then "Add Another Item". The subject is
 * images[0]; source index i maps to images[i+1] — alignment guaranteed by the
 * `useProviderStudioFields` helpers this component calls.
 */
const ProviderSourceItemGrid: React.FC<ProviderSourceItemGridProps> = ({
  idPrefix,
  images,
  subjectLabelKey,
  maxImages,
  showType,
  showNote,
  sourceItemTypes,
  sourceItemNotes,
  onSetSubject,
  onAddItem,
  onRemoveItem,
  onReplaceItem,
  onTypeChange,
  onNoteChange,
}) => {
  const { t } = useLanguage();

  const subject = images[0] ?? null;
  const sourceImages = images.slice(1);
  // Max source items = maxImages minus the subject slot.
  const atMax = images.length >= maxImages;

  return (
    <div className="flex flex-col gap-4">
      <ImageUploader
        image={subject}
        onImageUpload={onSetSubject}
        title={t(subjectLabelKey)}
        hideTitle
        id={`${idPrefix}-subject-upload`}
      />

      {sourceImages.map((image, index) => (
        <ProviderSourceItemCard
          key={`${idPrefix}-source-card-${index}`}
          index={index}
          idPrefix={idPrefix}
          image={image}
          onReplaceImage={(img) => onReplaceItem(index, img)}
          onRemove={() => onRemoveItem(index)}
          showType={showType}
          type={sourceItemTypes[index] ?? 'clothing'}
          onTypeChange={(type) => onTypeChange(index, type)}
          showNote={showNote}
          note={sourceItemNotes[index] ?? ''}
          onNoteChange={(note) => onNoteChange(index, note)}
        />
      ))}

      {/* Add Another Item: an empty uploader slot (reuses compression / validation
          / gallery). Hidden once at max; requires a subject first. */}
      {subject && !atMax && (
        <div className="rounded-2xl border border-dashed border-white/15 bg-zinc-900/30 p-4">
          <ImageUploader
            image={null}
            onImageUpload={(file) => file && onAddItem(file)}
            title={t('studio.workflows.sourceItems.addItem')}
            id={`${idPrefix}-source-add`}
          />
        </div>
      )}
      {atMax && (
        <p className="text-xs text-zinc-500">
          {t('studio.workflows.maxReferenceHint', { max: maxImages })}
        </p>
      )}
    </div>
  );
};

export default ProviderSourceItemGrid;
