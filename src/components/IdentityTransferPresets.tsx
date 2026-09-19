import React, { useState } from 'react';
import { useLanguage } from '../contexts/LanguageContext';

export interface PresetItem {
  id: string;
  icon: string;
  label: { en: string; vi: string };
  prompt: string;
}

export interface PresetCategory {
  id: string;
  icon: string;
  title: { en: string; vi: string };
  items: PresetItem[];
}

export const IDENTITY_TRANSFER_PRESETS: PresetCategory[] = [
  {
    id: 'body',
    icon: '⏳',
    title: { vi: 'Vóc dáng', en: 'Body' },
    items: [
      {
        id: 'slim-hourglass',
        icon: '⏳',
        label: {
          vi: 'Đồng hồ cát thon gọn (Ngực nở, eo nhỏ, mông cong, dáng slim)',
          en: 'Slim Hourglass (Busty, tiny waist, curvy hips, slim figure)',
        },
        prompt:
          'Noticeably fuller bust and cleavage, slim tiny waist, shapely curvy hips, but keep the overall figure slender, toned, and slim without looking heavy.',
      },
      {
        id: 'full-bust',
        icon: '✨',
        label: {
          vi: 'Vòng 1 nảy nở & Khe ngực tự nhiên',
          en: 'Fuller Bust & Natural Cleavage',
        },
        prompt:
          'Enlarge and enhance the bust size to be noticeably fuller, larger, and voluptuous with natural cleavage, fitting snugly against the top.',
      },
      {
        id: 'tiny-waist',
        icon: '🪡',
        label: {
          vi: 'Eo con kiến & Thon gọn',
          en: 'Tiny Waist & Lean Silhouette',
        },
        prompt:
          'Dramatically slim the waistline into a defined tiny waist while keeping the body slender, elegant, and lean.',
      },
      {
        id: 'curvy-hips',
        icon: '🍑',
        label: {
          vi: 'Hông quả đào & Chân thon',
          en: 'Curvy Hips & Toned Legs',
        },
        prompt:
          'Visibly fuller, rounder, and curvier hips and glutes, creating an attractive feminine lower-body curve while keeping legs toned.',
      },
    ],
  },
  {
    id: 'hair',
    icon: '💇‍♀️',
    title: { vi: 'Kiểu tóc', en: 'Hair' },
    items: [
      {
        id: 'wavy-hair',
        icon: '🌊',
        label: {
          vi: 'Tóc xoăn sóng bồng bềnh',
          en: 'Voluminous Wavy Hair',
        },
        prompt:
          'Voluminous long wavy hair with soft cascading curls and natural bounce, framing the face beautifully.',
      },
      {
        id: 'straight-hair',
        icon: '✨',
        label: {
          vi: 'Tóc suôn thẳng mượt mà',
          en: 'Sleek Straight Hair',
        },
        prompt:
          'Sleek, straight, silky long hair falling smoothly over shoulders with a healthy glossy shine.',
      },
      {
        id: 'high-bun',
        icon: '🎀',
        label: {
          vi: 'Tóc búi cao sang chảnh',
          en: 'Elegant High Bun Updo',
        },
        prompt:
          'Elegant polished high bun hairstyle with delicate soft face-framing wisps and tendrils.',
      },
      {
        id: 'bob-hair',
        icon: '✂️',
        label: {
          vi: 'Tóc ngắn bob cá tính',
          en: 'Chic Textured Bob',
        },
        prompt:
          'Chic chin-length modern bob hairstyle with soft natural volume and airy texture.',
      },
    ],
  },
  {
    id: 'makeup',
    icon: '💄',
    title: { vi: 'Makeup', en: 'Makeup' },
    items: [
      {
        id: 'douyin-makeup',
        icon: '💄',
        label: {
          vi: 'Makeup Douyin trong trẻo (Glass skin)',
          en: 'Douyin Dewy Glow Makeup',
        },
        prompt:
          'Douyin style makeup with dewy glass skin, soft pink gradient glossy lips, delicate aegyo-sal, and fluttery lash extensions.',
      },
      {
        id: 'glam-makeup',
        icon: '💋',
        label: {
          vi: 'Makeup Tây sắc sảo (Matte Glam)',
          en: 'Western Matte Glam',
        },
        prompt:
          'Western glam makeup with matte velvet base, sharp winged eyeliner, defined contour, and warm nude lips.',
      },
      {
        id: 'classic-red',
        icon: '🌹',
        label: {
          vi: 'Son đỏ cổ điển quý phái',
          en: 'Classic Velvet Red Lip',
        },
        prompt:
          'Classic French glamour makeup with bold velvet red lips, clean luminous complexion, and subtle defined eyeliner.',
      },
      {
        id: 'peach-makeup',
        icon: '🍑',
        label: {
          vi: 'Tone cam đào tự nhiên',
          en: 'Peach Natural Glow',
        },
        prompt:
          'Fresh peach-toned natural makeup with coral-peach blush, soft tinted lip balm, and clean glowing skin.',
      },
    ],
  },
  {
    id: 'accessories',
    icon: '👓',
    title: { vi: 'Kính & Phụ kiện', en: 'Accessories' },
    items: [
      {
        id: 'wire-glasses',
        icon: '👓',
        label: {
          vi: 'Kính gọng kim loại thanh mảnh',
          en: 'Minimalist Wire-frame Glasses',
        },
        prompt:
          'Wearing stylish minimalist thin gold/silver wire-frame oval glasses resting naturally on the face.',
      },
      {
        id: 'sunglasses',
        icon: '🕶️',
        label: {
          vi: 'Kính râm thời thượng',
          en: 'Chic Dark Sunglasses',
        },
        prompt:
          'Wearing chic luxury designer dark tinted sunglasses resting fashionable on the face.',
      },
      {
        id: 'pearl-earrings',
        icon: '🦪',
        label: {
          vi: 'Khuyên tai ngọc trai sang trọng',
          en: 'Pearl Drop Earrings',
        },
        prompt:
          'Wearing delicate luxury pearl drop earrings complementing the outfit.',
      },
    ],
  },
];

interface IdentityTransferPresetsProps {
  value: string;
  onChange: (newValue: string) => void;
}

export const IdentityTransferPresets: React.FC<IdentityTransferPresetsProps> = ({
  value,
  onChange,
}) => {
  const { language } = useLanguage();
  const [activeCategory, setActiveCategory] = useState<string>('body');

  const currentCategory =
    IDENTITY_TRANSFER_PRESETS.find((cat) => cat.id === activeCategory) ||
    IDENTITY_TRANSFER_PRESETS[0];


  const handleToggle = (promptText: string) => {
    const trimmed = value.trim();
    if (!trimmed) {
      onChange(promptText);
      return;
    }

    if (trimmed.includes(promptText)) {
      // Remove cleanly
      const items = trimmed
        .split(/(?:,\s*|\n+)/)
        .map((item) => item.trim())
        .filter((item) => item && item !== promptText && !promptText.includes(item));
      onChange(items.join(', '));
    } else {
      onChange(`${trimmed}, ${promptText}`);
    }
  };

  return (
    <div className="space-y-2 rounded-xl border border-white/6 bg-white/[0.02] p-2.5">
      {/* Category selector */}
      <div className="flex flex-wrap gap-1 border-b border-white/6 pb-2">
        {IDENTITY_TRANSFER_PRESETS.map((cat) => {
          const isCategoryActive = cat.id === activeCategory;
          const activeItemCount = cat.items.filter((item) => value.includes(item.prompt)).length;
          return (
            <button
              key={cat.id}
              type="button"
              onClick={() => setActiveCategory(cat.id)}
              className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs transition-all ${
                isCategoryActive
                  ? 'bg-white/10 font-medium text-white shadow-sm'
                  : 'text-zinc-400 hover:bg-white/[0.04] hover:text-zinc-200'
              }`}
            >
              <span>{cat.icon}</span>
              <span>{language === 'vi' ? cat.title.vi : cat.title.en}</span>
              {activeItemCount > 0 && (
                <span className="flex h-4 w-4 items-center justify-center rounded-full bg-[var(--workspace-accent)] text-[10px] font-bold text-[var(--workspace-accent-text)]">
                  {activeItemCount}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Preset pills for selected category */}
      <div className="flex flex-wrap gap-1.5 pt-0.5">
        {currentCategory.items.map((item) => {
          const active = value.includes(item.prompt);
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => handleToggle(item.prompt)}
              className={`group flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs transition-all duration-150 active:scale-95 ${
                active
                  ? 'border border-[var(--workspace-accent)] bg-[var(--workspace-accent)]/20 font-medium text-white shadow-sm'
                  : 'border border-white/10 bg-white/[0.03] text-zinc-300 hover:border-white/20 hover:bg-white/[0.06] hover:text-white'
              }`}
              title={item.prompt}
            >
              <span className="text-[13px]">{item.icon}</span>
              <span>{language === 'vi' ? item.label.vi : item.label.en}</span>
              {active && <span className="text-[10px] text-zinc-300">✓</span>}
            </button>
          );
        })}
      </div>
    </div>
  );
};
