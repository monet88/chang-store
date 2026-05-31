import React from 'react';
import { ImageFile, VIRTUAL_TRY_ON_SOURCE_ITEM_TYPES, VirtualTryOnSourceItemType } from '../../../types';
import { useLanguage } from '../../../contexts/LanguageContext';
import { MAX_SOURCE_PROMPT_LENGTH } from '../../../hooks/useProviderStudioFields';
import ImageUploader from '../../ImageUploader';
import { DeleteIcon } from '../../Icons';
import { fieldClass } from './provider-studio-styles';

interface ProviderSourceItemCardProps {
  index: number;
  idPrefix: string;
  image: ImageFile;
  onReplaceImage: (image: ImageFile) => void;
  onRemove: () => void;
  showType: boolean;
  type: VirtualTryOnSourceItemType;
  onTypeChange: (type: VirtualTryOnSourceItemType) => void;
  showNote: boolean;
  note: string;
  onNoteChange: (note: string) => void;
}

/**
 * Gemini-style per-source-item card: own image uploader + type select + note,
 * with a remove control. Purely presentational — index alignment is owned by
 * `useProviderStudioFields` helpers in the studio hook.
 */
const ProviderSourceItemCard: React.FC<ProviderSourceItemCardProps> = ({
  index,
  idPrefix,
  image,
  onReplaceImage,
  onRemove,
  showType,
  type,
  onTypeChange,
  showNote,
  note,
  onNoteChange,
}) => {
  const { t } = useLanguage();
  const itemNumber = index + 1;

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-white/10 bg-zinc-900/40 p-4">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-zinc-300">
          {t('studio.workflows.sourceItems.itemLabel', { index: itemNumber })}
        </p>
        <button
          type="button"
          onClick={onRemove}
          aria-label={t('studio.workflows.sourceItems.removeItem', { index: itemNumber })}
          className="rounded-full border border-white/10 p-1.5 text-zinc-300 transition-colors hover:border-red-500/50 hover:bg-red-500/10 hover:text-red-300"
        >
          <DeleteIcon className="h-4 w-4" />
        </button>
      </div>

      <ImageUploader
        image={image}
        onImageUpload={(file) => file && onReplaceImage(file)}
        title={t('studio.workflows.sourceItems.itemImageLabel', { index: itemNumber })}
        id={`${idPrefix}-source-item-${index}`}
      />

      <div className="flex flex-col gap-2 sm:flex-row">
        {showType && (
          <select
            aria-label={t('studio.workflows.sourceItems.typeLabel', { index: itemNumber })}
            value={type}
            onChange={(e) => onTypeChange(e.target.value as VirtualTryOnSourceItemType)}
            className={`${fieldClass} sm:w-36`}
          >
            {VIRTUAL_TRY_ON_SOURCE_ITEM_TYPES.map((t0) => (
              <option key={t0} value={t0}>
                {t(`studio.workflows.sourceItems.types.${t0}`)}
              </option>
            ))}
          </select>
        )}
        {showNote && (
          <input
            type="text"
            maxLength={MAX_SOURCE_PROMPT_LENGTH}
            aria-label={t('studio.workflows.sourceItems.noteLabel', { index: itemNumber })}
            value={note}
            onChange={(e) => onNoteChange(e.target.value)}
            placeholder={t('studio.workflows.sourceItems.notePlaceholder')}
            className={`${fieldClass} flex-1`}
          />
        )}
      </div>
    </div>
  );
};

export default ProviderSourceItemCard;
