import React from 'react';
import ImageUploader from './ImageUploader';
import { VIRTUAL_TRY_ON_SOURCE_ITEM_TYPES, VirtualTryOnSourceItemType } from '../types';
import type { VirtualTryOnClothingItem, ImageFile } from '../types';
import { useLanguage } from '../contexts/LanguageContext';
import { DeleteIcon, AddIcon } from './Icons';

const secondaryButtonClass = 'inline-flex min-h-[44px] items-center justify-center rounded-2xl border border-white/12 bg-white/[0.05] px-5 py-3 text-base font-medium text-zinc-100 transition-colors hover:border-white/25 hover:bg-white/[0.1] hover:text-white disabled:cursor-not-allowed disabled:opacity-50';

interface WardrobeSetCardProps {
  setIndex: number;
  items: VirtualTryOnClothingItem[];
  maxItems: number;
  disabled: boolean;
  canRemove: boolean;
  onAddItem: () => void;
  onRemoveItem: (itemId: number) => void;
  onUpdateItem: (itemId: number, updates: Partial<Pick<VirtualTryOnClothingItem, 'image' | 'sourceItemType' | 'sourcePrompt'>>) => void;
  onRemoveSet: () => void;
}

const WardrobeSetCard: React.FC<WardrobeSetCardProps> = ({
  setIndex,
  items,
  maxItems,
  disabled,
  canRemove,
  onAddItem,
  onRemoveItem,
  onUpdateItem,
  onRemoveSet,
}) => {
  const { t } = useLanguage();

  return (
    <div className="rounded-[20px] border border-white/10 bg-white/[0.02] p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h4 className="text-base font-semibold text-zinc-100">
          {t('virtualTryOn.wardrobeSetLabel', { number: setIndex + 1 })}
        </h4>
        {canRemove && (
          <button
            type="button"
            onClick={onRemoveSet}
            disabled={disabled}
            aria-label={t('virtualTryOn.removeSet')}
            className="rounded-full border border-red-500/30 bg-black/70 p-1.5 text-red-200 transition-opacity hover:opacity-80 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <DeleteIcon className="h-4 w-4" />
          </button>
        )}
      </div>

      <div className="grid gap-4 max-w-[50%]">
        {items.map((item, idx) => (
          <div key={item.id} className="relative group space-y-2">
            <ImageUploader
              image={item.image}
              id={`wardrobe-item-${item.id}`}
              title={t('virtualTryOn.clothingItemTitle', { index: idx + 1 })}
              onImageUpload={(file: ImageFile | null) => onUpdateItem(item.id, { image: file })}
            />
            <div className="space-y-2">
              <select
                value={item.sourceItemType}
                onChange={(e) => onUpdateItem(item.id, { sourceItemType: e.target.value as VirtualTryOnSourceItemType })}
                disabled={disabled}
                className="w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-2.5 text-sm text-zinc-100 focus:border-white/20 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/20"
              >
                {VIRTUAL_TRY_ON_SOURCE_ITEM_TYPES.map((type) => (
                  <option key={type} value={type} className="bg-zinc-950 text-zinc-100">
                    {t(`virtualTryOn.sourceItemTypes.${type}`)}
                  </option>
                ))}
              </select>
              <textarea
                value={item.sourcePrompt}
                onChange={(e) => onUpdateItem(item.id, { sourcePrompt: e.target.value })}
                disabled={disabled}
                rows={2}
                maxLength={180}
                placeholder={t('virtualTryOn.sourcePromptPlaceholder')}
                className="w-full resize-none rounded-2xl border border-white/10 bg-black/30 px-4 py-2.5 text-sm leading-6 text-zinc-100 placeholder:text-zinc-500 focus:border-white/20 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/20 disabled:cursor-not-allowed disabled:opacity-50"
              />
            </div>
            {items.length > 1 && (
              <button
                type="button"
                onClick={() => onRemoveItem(item.id)}
                disabled={disabled}
                aria-label={`Remove item ${idx + 1}`}
                className="absolute right-2 top-7 z-10 rounded-full border border-red-500/30 bg-black/70 p-1.5 text-red-200 opacity-0 transition-opacity group-hover:opacity-100 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <DeleteIcon className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={onAddItem}
        disabled={disabled || items.length >= maxItems}
        className={`${secondaryButtonClass} w-full gap-2 text-sm`}
      >
        <AddIcon className="h-3.5 w-3.5" />
        <span>{t('virtualTryOn.addItem')}</span>
      </button>
    </div>
  );
};

export default WardrobeSetCard;
