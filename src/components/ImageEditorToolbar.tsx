/**
 * ImageEditorToolbar Component
 *
 * Left vertical toolbar for ImageEditor with editing tools.
 * Provides tool selection and immediate action buttons (rotate, flip).
 *
 * Tools:
 * - Crop: Rectangular crop with aspect ratio
 * - Perspective Crop: 4-point perspective correction
 * - Rotate: Rotate image 90° clockwise (immediate action)
 * - Flip Horizontal: Mirror horizontally (immediate action)
 * - Flip Vertical: Mirror vertically (immediate action)
 * - Lasso: Freeform selection
 * - Marquee: Rectangular selection
 * - Ellipse: Elliptical selection
 * - Brush: Paint on image
 * - Eraser: Erase painted areas
 * - Color Picker: Pick color from image
 *
 * Extracted from ImageEditor.tsx to separate toolbar UI from orchestration.
 * Wrapped with React.memo to prevent unnecessary re-renders.
 */

import React, { useRef } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import {
  CropIcon,
  PerspectiveCropIcon,
  RotateIcon,
  FlipHorizontalIcon,
  FlipVerticalIcon,
  SelectionIcon,
  MarqueeIcon,
  EllipseIcon,
  BrushIcon,
  EraserIcon,
  ColorPickerIcon,
} from './Icons';

/**
 * Tool type definition (must match parent)
 */
export type Tool =
  | 'crop'
  | 'perspectiveCrop'
  | 'rotate'
  | 'flip-horizontal'
  | 'flip-vertical'
  | 'lasso'
  | 'marquee'
  | 'ellipse'
  | 'pen'
  | 'brush'
  | 'eraser'
  | 'color-picker';

/**
 * Props for ImageEditorToolbar
 */
export interface ImageEditorToolbarProps {
  /** Currently active tool */
  activeTool: Tool | null;

  /** Handler to set active tool */
  setActiveTool: (tool: Tool | null) => void;

  /** Handler for immediate actions (rotate, flip) */
  onImmediateAction: (action: 'rotate' | 'flip-horizontal' | 'flip-vertical') => void;

  /** Current brush color */
  brushColor: string;

  /** Handler to set brush color */
  setBrushColor: (color: string) => void;
}

/**
 * Individual Tool Button Component
 */
const ToolButton: React.FC<{
  label: string;
  icon: React.ReactNode;
  isActive: boolean;
  onClick: () => void;
}> = ({ label, icon, isActive, onClick }) => (
  <button
    onClick={onClick}
    className={`w-12 h-12 flex items-center justify-center rounded-lg transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-900 ${
      isActive ? 'bg-amber-600 text-white' : 'text-zinc-400 hover:bg-zinc-700/50'
    }`}
    aria-label={label}
    aria-pressed={isActive}
    title={label}
  >
    {icon}
  </button>
);

/**
 * ImageEditorToolbar Component
 *
 * Renders left vertical toolbar with editing tools and color swatch.
 *
 * @param props - Toolbar props
 */
const ImageEditorToolbarComponent: React.FC<ImageEditorToolbarProps> = ({
  activeTool,
  setActiveTool,
  onImmediateAction,
  brushColor,
  setBrushColor,
}) => {
  const { t } = useLanguage();
  const colorInputRef = useRef<HTMLInputElement>(null);

  /**
   * Tool configuration
   * Each tool has:
   * - id: tool identifier
   * - label: i18n label
   * - icon: React icon component
   * - isAction: true for immediate actions (rotate, flip)
   * - action: handler for immediate actions
   */
  const tools = [
    {
      id: 'crop',
      label: t('imageEditor.modal.tools.crop'),
      icon: <CropIcon className="w-6 h-6" />,
    },
    {
      id: 'perspectiveCrop',
      label: t('imageEditor.modal.tools.perspectiveCrop'),
      icon: <PerspectiveCropIcon className="w-6 h-6" />,
    },
    {
      id: 'rotate',
      label: t('imageEditor.modal.tools.rotate'),
      icon: <RotateIcon className="w-6 h-6" />,
      isAction: true,
      action: () => onImmediateAction('rotate'),
    },
    {
      id: 'flip-horizontal',
      label: t('imageEditor.modal.tools.flipHorizontal'),
      icon: <FlipHorizontalIcon className="w-6 h-6" />,
      isAction: true,
      action: () => onImmediateAction('flip-horizontal'),
    },
    {
      id: 'flip-vertical',
      label: t('imageEditor.modal.tools.flipVertical'),
      icon: <FlipVerticalIcon className="w-6 h-6" />,
      isAction: true,
      action: () => onImmediateAction('flip-vertical'),
    },
    {
      id: 'lasso',
      label: t('imageEditor.modal.tools.lasso'),
      icon: <SelectionIcon className="w-6 h-6" />,
    },
    {
      id: 'marquee',
      label: t('imageEditor.modal.tools.marquee'),
      icon: <MarqueeIcon className="w-6 h-6" />,
    },
    {
      id: 'ellipse',
      label: t('imageEditor.modal.tools.ellipse'),
      icon: <EllipseIcon className="w-6 h-6" />,
    },
    {
      id: 'brush',
      label: t('imageEditor.modal.tools.brush'),
      icon: <BrushIcon className="w-6 h-6" />,
    },
    {
      id: 'eraser',
      label: t('imageEditor.modal.tools.eraser'),
      icon: <EraserIcon className="w-6 h-6" />,
    },
    {
      id: 'color-picker',
      label: t('imageEditor.modal.tools.colorPicker'),
      icon: <ColorPickerIcon className="w-6 h-6" />,
    },
  ];

  return (
    <div className="w-16 flex-shrink-0 bg-zinc-900/50 rounded-lg border border-zinc-700 p-2 flex flex-col items-center gap-2">
      {/* Tool buttons */}
      <div className="flex flex-col gap-1">
        {tools.map(tool => (
          <ToolButton
            key={tool.id}
            label={tool.label}
            icon={tool.icon}
            isActive={activeTool === tool.id}
            onClick={() => (tool.isAction && tool.action ? tool.action() : setActiveTool(tool.id as Tool))}
          />
        ))}
      </div>

      {/* Color swatch (for brush tool) */}
      <div className="mt-auto w-full flex flex-col items-center gap-2 pt-2 border-t border-zinc-700">
        <label htmlFor="color-swatch" className="text-xs text-zinc-400">
          {t('imageEditor.modal.tools.colorSwatch')}
        </label>
        <div
          className="w-10 h-10 rounded-full border-2 border-zinc-600 cursor-pointer"
          style={{ backgroundColor: brushColor }}
          onClick={() => colorInputRef.current?.click()}
          title={t('imageEditor.modal.tools.colorSwatch')}
        />
        <input
          ref={colorInputRef}
          id="color-swatch"
          type="color"
          value={brushColor}
          onChange={e => setBrushColor(e.target.value)}
          className="w-0 h-0 opacity-0 absolute"
        />
      </div>
    </div>
  );
};

/**
 * Memoized ImageEditorToolbar
 *
 * Prevents unnecessary re-renders when parent updates.
 * Only re-renders when props change.
 */
export const ImageEditorToolbar = React.memo(ImageEditorToolbarComponent);
ImageEditorToolbar.displayName = 'ImageEditorToolbar';
