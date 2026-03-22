import React from 'react';
import { BatchImageStatus, ImageFile } from '../../types';

export interface ImageBatchSessionRailItem {
  id: string;
  image: ImageFile;
  status: BatchImageStatus;
  resultCount: number;
}

interface ImageBatchSessionRailProps {
  items: ImageBatchSessionRailItem[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  getItemLabel: (index: number, item: ImageBatchSessionRailItem) => string;
}

const STATUS_BADGE_CLASS: Record<BatchImageStatus, string> = {
  pending: 'bg-zinc-600 text-white',
  processing: 'bg-amber-500 text-black',
  completed: 'bg-emerald-500 text-black',
  error: 'bg-red-500 text-white',
};

const STATUS_BADGE_TEXT: Record<BatchImageStatus, string> = {
  pending: '•',
  processing: '…',
  completed: '✓',
  error: '!',
};

const ImageBatchSessionRail: React.FC<ImageBatchSessionRailProps> = ({
  items,
  selectedId,
  onSelect,
  getItemLabel,
}) => {
  if (items.length === 0) {
    return null;
  }

  return (
    <div className="flex items-center gap-2 overflow-x-auto py-2 px-1 scrollbar-thin scrollbar-thumb-zinc-700">
      {items.map((item, index) => {
        const isSelected = item.id === selectedId;
        const itemLabel = getItemLabel(index, item);

        return (
          <button
            key={item.id}
            type="button"
            onClick={() => onSelect(item.id)}
            className={`relative flex-shrink-0 rounded-xl border-2 p-1 transition-all duration-200 ${
              isSelected
                ? 'border-amber-500 ring-2 ring-amber-500/30'
                : 'border-zinc-700 hover:border-zinc-500'
            }`}
            aria-pressed={isSelected}
            aria-label={itemLabel}
            title={itemLabel}
          >
            <div className="relative w-16 h-16 overflow-hidden rounded-lg bg-zinc-900">
              <img
                src={`data:${item.image.mimeType};base64,${item.image.base64}`}
                alt={itemLabel}
                className="w-full h-full object-cover"
              />
              <span className="absolute bottom-1 left-1 bg-black/70 text-zinc-100 text-[10px] font-medium px-1.5 py-0.5 rounded">
                {index + 1}
              </span>
              <span
                className={`absolute top-1 right-1 min-w-5 h-5 px-1 rounded-full text-[10px] font-bold flex items-center justify-center ${STATUS_BADGE_CLASS[item.status]}`}
              >
                {item.status === 'completed' && item.resultCount > 0 ? item.resultCount : STATUS_BADGE_TEXT[item.status]}
              </span>
            </div>
          </button>
        );
      })}
    </div>
  );
};

export default ImageBatchSessionRail;
