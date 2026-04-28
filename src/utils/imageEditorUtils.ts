import { ImageFile } from '../types';
import { AdjustmentState, HSLState } from '../types';

export const basicAdjustmentsToPrompt = (adjusts: AdjustmentState): string => {
    const parts: string[] = [];
    if (adjusts.exposure !== 0) parts.push(`exposure by ${adjusts.exposure}`);
    if (adjusts.contrast !== 0) parts.push(`contrast by ${adjusts.contrast}`);
    if (adjusts.temperature !== 0) parts.push(`color temperature by ${adjusts.temperature}`);
    if (adjusts.tint !== 0) parts.push(`tint by ${adjusts.tint}`);
    if (adjusts.vibrance !== 0) parts.push(`vibrance by ${adjusts.vibrance}`);
    if (adjusts.saturation !== 0) parts.push(`saturation by ${adjusts.saturation}`);
    if (parts.length === 0) return '';
    return `Apply image adjustments: ${parts.join(', ')}.`;
};

export const colorAdjustmentsToPrompt = (hslState: HSLState): string => {
    const parts: string[] = [];
    for (const [color, values] of Object.entries(hslState)) {
        if (values.hue !== 0 || values.saturation !== 0 || values.luminance !== 0) {
            const colorParts: string[] = [];
            if (values.hue !== 0) colorParts.push(`hue by ${values.hue}`);
            if (values.saturation !== 0) colorParts.push(`saturation by ${values.saturation}`);
            if (values.luminance !== 0) colorParts.push(`luminance by ${values.luminance}`);
            parts.push(`for ${color} tones, adjust ${colorParts.join(', ')}`);
        }
    }
    if (parts.length === 0) return '';
    return `Apply HSL color adjustments: ${parts.join(', ')}.`;
};

export const effectsAdjustmentsToPrompt = (adjusts: AdjustmentState): string => {
    const parts: string[] = [];
    if (adjusts.grain > 0) parts.push(`add ${adjusts.grain}% film grain`);
    if (adjusts.clarity > 0) parts.push(`increase clarity by ${adjusts.clarity}%`);
    if (adjusts.dehaze > 0) parts.push(`dehaze by ${adjusts.dehaze}%`);
    if (adjusts.blur > 0) parts.push(`apply a blur effect of ${adjusts.blur / 10}%`);
    if (parts.length === 0) return '';
    return `Apply effects: ${parts.join(', ')}.`;
};

export const createBlankImage = (width: number, height: number, color: string = 'white'): ImageFile => {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (ctx) {
        ctx.fillStyle = color;
        ctx.fillRect(0, 0, width, height);
    }
    const dataUrl = canvas.toDataURL('image/png');
    const base64 = dataUrl.split(',')[1];
    return { base64, mimeType: 'image/png' };
};

export const getFilterString = (adjusts: AdjustmentState): string => {
    const filters = [];
    if (adjusts.exposure !== 0) filters.push(`brightness(${1 + adjusts.exposure / 100})`);
    if (adjusts.contrast !== 0) filters.push(`contrast(${1 + adjusts.contrast / 100})`);
    if (adjusts.saturation !== 0) filters.push(`saturate(${1 + adjusts.saturation / 100})`);
    if (adjusts.blur > 0) filters.push(`blur(${adjusts.blur / 20}px)`);
    return filters.join(' ');
};

export type Point = { x: number; y: number };
export type Rect = { x: number; y: number; width: number; height: number };
export type CropHandle = 'tl' | 'tr' | 'bl' | 'br' | 't' | 'b' | 'l' | 'r';
export type CropInteractionType = 'move' | `resize-${CropHandle}` | 'drawing';

export const getHandleForPoint = (point: Point, rect: Rect): CropInteractionType | null => {
    const handleRadius = 10;
    const { x, y, width, height } = rect;

    const onTopEdge = Math.abs(point.y - y) < handleRadius;
    const onBottomEdge = Math.abs(point.y - (y + height)) < handleRadius;
    const onLeftEdge = Math.abs(point.x - x) < handleRadius;
    const onRightEdge = Math.abs(point.x - (x + width)) < handleRadius;
    
    const onHorizontalMid = point.x > x + handleRadius && point.x < x + width - handleRadius;
    const onVerticalMid = point.y > y + handleRadius && point.y < y + height - handleRadius;

    if (onTopEdge && onLeftEdge) return 'resize-tl';
    if (onTopEdge && onRightEdge) return 'resize-tr';
    if (onBottomEdge && onLeftEdge) return 'resize-bl';
    if (onBottomEdge && onRightEdge) return 'resize-br';

    if (onTopEdge && onHorizontalMid) return 'resize-t';
    if (onBottomEdge && onHorizontalMid) return 'resize-b';
    if (onLeftEdge && onVerticalMid) return 'resize-l';
    if (onRightEdge && onVerticalMid) return 'resize-r';

    if (point.x > x && point.x < x + width && point.y > y && point.y < y + height) return 'move';
    return null;
};
