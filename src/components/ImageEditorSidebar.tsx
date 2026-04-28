import React, { useState, useRef } from 'react';
import { AspectRatio as AspectRatioType, ImageFile, Feature, AdjustmentState, HSLColor, HSLState, INITIAL_ADJUSTMENTS, INITIAL_HSL } from '../types';
import { useLanguage } from '../contexts/LanguageContext';
import { useImageGallery } from '../contexts/ImageGalleryContext';
import Spinner from './Spinner';
import { 
  MagicWandIcon, 
  CloudUploadIcon, 
  CloseIcon 
} from './Icons';

// --- Types ---
export type Tool = 
    | 'crop' | 'perspectiveCrop' | 'rotate' | 'flip-horizontal' | 'flip-vertical'
    | 'lasso' | 'marquee' | 'ellipse' | 'pen'
    | 'brush' | 'eraser' | 'color-picker';


// --- Components ---

export const PanelSection: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
    <div>
        <h3 className="text-sm font-semibold text-amber-400 mb-3 border-b border-zinc-700/50 pb-2">{title}</h3>
        <div className="space-y-4">{children}</div>
    </div>
);

export const CollapsibleSection: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => {
    const [isOpen, setIsOpen] = useState(false);

    return (
        <div>
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="w-full flex justify-between items-center text-left"
                aria-expanded={isOpen}
            >
                <h3 className="text-sm font-semibold text-amber-400">{title}</h3>
                <svg
                    className={`w-4 h-4 text-zinc-400 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
                    fill="none" viewBox="0 0 24 24" stroke="currentColor"
                >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
            </button>
            <div className="border-b border-zinc-700/50 mt-2"></div>
            {isOpen && (
                <div className="pt-3 space-y-4 animate-fade-in">
                    {children}
                </div>
            )}
        </div>
    );
};

export const Slider: React.FC<{
  label: string;
  value: number;
  onChange: (newValue: number) => void;
  onReset: () => void;
  min?: number;
  max?: number;
  step?: number;
}> = ({ label, value, onChange, onReset, min = -100, max = 100, step = 1 }) => (
    <div>
        <div className="flex justify-between items-center mb-1">
            <label className="text-xs text-zinc-400">{label}</label>
            <div className="flex items-center gap-2">
                <span className="text-xs font-mono text-cyan-400 w-10 text-right">{value.toFixed(0)}</span>
                <button onDoubleClick={onReset} className="text-zinc-500 hover:text-white text-[10px] font-semibold" title="Double-click to reset">RESET</button>
            </div>
        </div>
        <input
            type="range"
            min={min}
            max={max}
            step={step}
            value={value}
            onChange={(e) => onChange(Number(e.target.value))}
            onDoubleClick={onReset}
            className="w-full h-1.5 bg-zinc-700 rounded-lg appearance-none cursor-pointer"
        />
    </div>
);

export const SimpleImageUploader: React.FC<{
    image: ImageFile | null;
    onUpload: (file: ImageFile | null) => void;
    title: string;
}> = ({ image, onUpload, title }) => {
    const { t } = useLanguage();
    const inputRef = useRef<HTMLInputElement>(null);

    const processFile = (file: File) => {
        if (file && file.type.startsWith('image/')) {
            const reader = new FileReader();
            reader.onloadend = () => {
                const base64String = (reader.result as string).split(',')[1];
                const newImage = { base64: base64String, mimeType: file.type };
                onUpload(newImage);
            };
            reader.readAsDataURL(file);
        }
    };

    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (file) {
            processFile(file);
        }
    };

    const handleClear = (e: React.MouseEvent) => {
        e.stopPropagation();
        onUpload(null);
        if (inputRef.current) {
            inputRef.current.value = "";
        }
    };

    return (
        <div>
            <label className="block text-sm font-medium text-zinc-300 mb-2">{title}</label>
            <div 
                onClick={() => inputRef.current?.click()}
                className="relative aspect-video w-full bg-zinc-800/50 rounded-lg border-2 border-dashed border-zinc-700 hover:border-amber-500 transition-colors cursor-pointer flex items-center justify-center overflow-hidden"
            >
                <input
                    ref={inputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleFileChange}
                />
                {image ? (
                    <>
                        <img src={`data:${image.mimeType};base64,${image.base64}`} alt="Accessory preview" className="object-contain h-full w-full" />
                        <button 
                            onClick={handleClear}
                            className="absolute top-1 right-1 p-1 bg-black/50 rounded-full text-white hover:bg-red-500/80"
                        >
                            <CloseIcon className="w-4 h-4" />
                        </button>
                    </>
                ) : (
                    <div className="text-center text-zinc-400 p-2">
                        <CloudUploadIcon className="mx-auto h-8 w-8" />
                        <p className="mt-1 text-xs">{t('imageEditor.modal.rightPanel.clickToUpload')}</p>
                    </div>
                )}
            </div>
        </div>
    );
};

export interface RightPanelProps {
    activeTool: Tool | null;
    onGenerateAIEdit: (prompt: string) => Promise<void>;
    onPerformApiAction: (promptKey: string, params?: Record<string, any>) => Promise<void>;
    isLoading: boolean;
    adjustments: AdjustmentState;
    setAdjustments: React.Dispatch<React.SetStateAction<AdjustmentState>>;
    hsl: HSLState;
    setHsl: React.Dispatch<React.SetStateAction<HSLState>>;
    activeHslColor: string;
    setActiveHslColor: (color: string) => void;
    brushSize: number;
    setBrushSize: (size: number) => void;
    brushOpacity: number;
    setBrushOpacity: (opacity: number) => void;
    aspectRatio: AspectRatioType;
    setAspectRatio: (ratio: AspectRatioType) => void;
    onApplyCrop: () => void;
    onCancelCrop: () => void;
    onApplyPerspectiveCrop: () => void;
    onCancelPerspectiveCrop: () => void;
    selectionPath: Path2D | null;
    onDeselect: () => void;
    onApplyAccessory: (type: string, accessoryImageFile: ImageFile) => Promise<void>;
    onApplyBasicAdjustments: () => void;
    hasBasicAdjustments: boolean;
    onApplyColorAdjustments: () => void;
    hasColorAdjustments: boolean;
    onApplyEffectsAdjustments: () => void;
    hasEffectsAdjustments: boolean;
}

export const RightPanel: React.FC<RightPanelProps> = ({
    activeTool, onGenerateAIEdit, onPerformApiAction, isLoading, adjustments, setAdjustments, hsl, setHsl, activeHslColor, setActiveHslColor,
    brushSize, setBrushSize, brushOpacity, setBrushOpacity,
    aspectRatio, setAspectRatio, onApplyCrop, onCancelCrop,
    onApplyPerspectiveCrop, onCancelPerspectiveCrop,
    selectionPath, onDeselect,
    onApplyAccessory,
    onApplyBasicAdjustments, hasBasicAdjustments,
    onApplyColorAdjustments, hasColorAdjustments,
    onApplyEffectsAdjustments, hasEffectsAdjustments
}) => {
    const { t } = useLanguage();
    const [aiEditPrompt, setAiEditPrompt] = useState('');
    const [accessoryType, setAccessoryType] = useState('glasses');
    const [accessoryImage, setAccessoryImage] = useState<ImageFile | null>(null);

    const handleAdjustmentChange = (key: keyof AdjustmentState, value: number) => {
        setAdjustments(prev => ({ ...prev, [key]: value }));
    };

    const handleHslChange = (color: string, property: keyof HSLColor, value: number) => {
        setHsl(prev => ({ ...prev, [color]: { ...prev[color], [property]: value } }));
    };

    const resetAdjustment = (key: keyof AdjustmentState) => handleAdjustmentChange(key, 0);

    const renderToolOptions = () => {
        if (activeTool === 'crop') {
            return (
                <PanelSection title={t('imageEditor.modal.rightPanel.crop.aspectRatio')}>
                    <div className="grid grid-cols-3 gap-2">
                        {(['Default', '1:1', '4:3', '3:4', '16:9', '9:16'] as AspectRatioType[]).map(r => (
                            <button key={r} onClick={() => setAspectRatio(r)} className={`px-2 py-1 text-xs rounded-md ${aspectRatio === r ? 'bg-amber-600 text-white' : 'bg-zinc-700 text-zinc-300'}`}>{r}</button>
                        ))}
                    </div>
                    <div className="flex gap-2 mt-4">
                        <button onClick={onApplyCrop} className="flex-1 bg-amber-600 text-white font-semibold py-2 rounded-lg text-sm">{t('imageEditor.modal.rightPanel.crop.apply')}</button>
                        <button onClick={onCancelCrop} className="flex-1 bg-zinc-600 text-white font-semibold py-2 rounded-lg text-sm">{t('imageEditor.modal.rightPanel.crop.cancel')}</button>
                    </div>
                </PanelSection>
            );
        }
        if (activeTool === 'perspectiveCrop') {
            return (
                <PanelSection title={t('imageEditor.modal.tools.perspectiveCrop')}>
                     <p className="text-xs text-zinc-400">{t('imageEditor.modal.rightPanel.crop.perspectiveInstructions')}</p>
                    <div className="flex gap-2 mt-4">
                        <button onClick={onApplyPerspectiveCrop} className="flex-1 bg-amber-600 text-white font-semibold py-2 rounded-lg text-sm">{t('imageEditor.modal.rightPanel.crop.apply')}</button>
                        <button onClick={onCancelPerspectiveCrop} className="flex-1 bg-zinc-600 text-white font-semibold py-2 rounded-lg text-sm">{t('imageEditor.modal.rightPanel.crop.cancel')}</button>
                    </div>
                </PanelSection>
            )
        }
        if (['brush', 'eraser'].includes(activeTool!)) {
            return (
                <PanelSection title={t('imageEditor.modal.rightPanel.toolOptions')}>
                    <Slider label={t('imageEditor.modal.rightPanel.sliders.brushSize')} value={brushSize} onChange={setBrushSize} onReset={() => setBrushSize(20)} min={1} max={200} />
                    {activeTool === 'brush' && (
                        <Slider label={t('imageEditor.modal.rightPanel.sliders.brushOpacity')} value={brushOpacity} onChange={setBrushOpacity} onReset={() => setBrushOpacity(100)} min={0} />
                    )}
                </PanelSection>
            );
        }
        return null;
    };
    
    const renderSelectionOptions = () => {
         return (
            <PanelSection title={t('imageEditor.modal.rightPanel.selectionOptions')}>
                <button onClick={onDeselect} className="w-full bg-zinc-600 text-white font-semibold py-2 rounded-lg text-sm">{t('imageEditor.modal.rightPanel.selection.deselect')}</button>
            </PanelSection>
        );
    }
    
    return (
        <div className="w-80 flex-shrink-0 bg-zinc-900/50 rounded-lg border border-zinc-700 p-4 flex flex-col">
            
            {(activeTool || selectionPath) && (
                <div className="pb-4 mb-4 border-b border-zinc-700/50">
                    {activeTool && renderToolOptions()}
                    {selectionPath && !activeTool && renderSelectionOptions()}
                </div>
            )}
            
            <div className="space-y-6 overflow-y-auto pr-2 -mr-4 flex-grow">
                <PanelSection title={t('imageEditor.modal.rightPanel.magic')}>
                    <div className="space-y-4">
                        <button onClick={() => onPerformApiAction('removeBackground')} disabled={isLoading} className="w-full bg-zinc-700/80 text-zinc-200 font-semibold py-2.5 rounded-lg text-sm flex items-center justify-center gap-2 disabled:opacity-50">
                            <MagicWandIcon className="w-5 h-5 text-purple-400" /> {t('imageEditor.modal.rightPanel.removeBackground')}
                        </button>
                        <button onClick={() => onPerformApiAction('invertColor')} disabled={isLoading} className="w-full bg-zinc-700/80 text-zinc-200 font-semibold py-2.5 rounded-lg text-sm flex items-center justify-center gap-2 disabled:opacity-50">
                            {t('imageEditor.modal.rightPanel.invertColor')}
                        </button>
                        <div>
                            <label className="text-xs font-medium text-zinc-400">{t('imageEditor.modal.rightPanel.aiEdit')}</label>
                            <div className="flex gap-2 mt-1">
                                <input
                                    type="text"
                                    value={aiEditPrompt}
                                    onChange={e => setAiEditPrompt(e.target.value)}
                                    placeholder={selectionPath ? t('imageEditor.aiInpaintPlaceholder') : t('imageEditor.modal.rightPanel.aiEditPlaceholder')}
                                    className="flex-grow bg-zinc-800 border border-zinc-600 rounded-md p-2 text-sm text-zinc-200"
                                />
                                <button onClick={() => onGenerateAIEdit(aiEditPrompt)} disabled={isLoading || !aiEditPrompt.trim()} className="bg-amber-600 text-white px-4 rounded-md font-semibold text-sm disabled:bg-zinc-600">
                                    {isLoading ? <Spinner /> : t('imageEditor.modal.rightPanel.generate')}
                                </button>
                            </div>
                        </div>
                        <div>
                            <label className="text-xs font-medium text-zinc-400">{t('imageEditor.modal.rightPanel.accessoryTryOn')}</label>
                            <div className="mt-1 space-y-2">
                                <select value={accessoryType} onChange={e => setAccessoryType(e.target.value)} className="w-full bg-zinc-800 border border-zinc-600 rounded-md p-2 text-sm text-zinc-200 appearance-none" style={{ backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%23a1a1aa' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e")`, backgroundPosition: 'right 0.5rem center', backgroundRepeat: 'no-repeat', backgroundSize: '1.5em 1.5em' }}>
                                    {Object.keys(t('imageEditor.modal.rightPanel.accessories', { returnObjects: true })).map(key => (
                                        <option key={key} value={key}>{t(`imageEditor.modal.rightPanel.accessories.${key}`)}</option>
                                    ))}
                                </select>
                                <SimpleImageUploader image={accessoryImage} onUpload={setAccessoryImage} title={t('imageEditor.modal.rightPanel.accessoryImage')} />
                                <button onClick={() => accessoryImage && onApplyAccessory(accessoryType, accessoryImage)} disabled={!accessoryImage || isLoading} className="w-full bg-cyan-600 text-white font-semibold py-2 rounded-lg text-sm disabled:bg-zinc-600">
                                    {isLoading ? <Spinner /> : t('imageEditor.modal.rightPanel.applyAccessory')}
                                </button>
                            </div>
                        </div>
                    </div>
                </PanelSection>

                <CollapsibleSection title={t('imageEditor.modal.rightPanel.basic')}>
                    <Slider label={t('imageEditor.modal.rightPanel.sliders.exposure')} value={adjustments.exposure} onChange={v => handleAdjustmentChange('exposure', v)} onReset={() => resetAdjustment('exposure')} />
                    <Slider label={t('imageEditor.modal.rightPanel.sliders.contrast')} value={adjustments.contrast} onChange={v => handleAdjustmentChange('contrast', v)} onReset={() => resetAdjustment('contrast')} />
                    <Slider label={t('imageEditor.modal.rightPanel.sliders.temperature')} value={adjustments.temperature} onChange={v => handleAdjustmentChange('temperature', v)} onReset={() => resetAdjustment('temperature')} />
                    <Slider label={t('imageEditor.modal.rightPanel.sliders.tint')} value={adjustments.tint} onChange={v => handleAdjustmentChange('tint', v)} onReset={() => resetAdjustment('tint')} />
                    <Slider label={t('imageEditor.modal.rightPanel.sliders.vibrance')} value={adjustments.vibrance} onChange={v => handleAdjustmentChange('vibrance', v)} onReset={() => resetAdjustment('vibrance')} />
                    <Slider label={t('imageEditor.modal.rightPanel.sliders.saturation')} value={adjustments.saturation} onChange={v => handleAdjustmentChange('saturation', v)} onReset={() => resetAdjustment('saturation')} />
                    <div className="mt-4 pt-4 border-t border-zinc-700/50">
                        <button
                            onClick={onApplyBasicAdjustments}
                            disabled={!hasBasicAdjustments || isLoading}
                            className="w-full bg-amber-600 text-white font-semibold py-2 rounded-lg text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {isLoading ? <Spinner /> : (selectionPath ? t('imageEditor.modal.rightPanel.applyToSelection') : t('imageEditor.modal.rightPanel.applyAdjustments'))}
                        </button>
                    </div>
                </CollapsibleSection>
                
                <CollapsibleSection title={t('imageEditor.modal.rightPanel.color')}>
                    <div className="flex flex-wrap gap-1 mb-4">
                        {Object.keys(INITIAL_HSL).map(color => (
                            <button key={color} onClick={() => setActiveHslColor(color)} className={`w-6 h-6 rounded-full border-2 ${activeHslColor === color ? 'border-white' : 'border-transparent'}`} style={{ backgroundColor: color }} title={t(`imageEditor.modal.rightPanel.hsl.${color}`)} />
                        ))}
                    </div>
                    <Slider label={t('imageEditor.modal.rightPanel.sliders.hue')} value={hsl[activeHslColor].hue} onChange={v => handleHslChange(activeHslColor, 'hue', v)} onReset={() => handleHslChange(activeHslColor, 'hue', 0)} />
                    <Slider label={t('imageEditor.modal.rightPanel.sliders.saturation')} value={hsl[activeHslColor].saturation} onChange={v => handleHslChange(activeHslColor, 'saturation', v)} onReset={() => handleHslChange(activeHslColor, 'saturation', 0)} />
                    <Slider label={t('imageEditor.modal.rightPanel.sliders.luminance')} value={hsl[activeHslColor].luminance} onChange={v => handleHslChange(activeHslColor, 'luminance', v)} onReset={() => handleHslChange(activeHslColor, 'luminance', 0)} />
                     <div className="mt-4 pt-4 border-t border-zinc-700/50">
                        <button
                            onClick={onApplyColorAdjustments}
                            disabled={!hasColorAdjustments || isLoading}
                            className="w-full bg-amber-600 text-white font-semibold py-2 rounded-lg text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {isLoading ? <Spinner /> : (selectionPath ? t('imageEditor.modal.rightPanel.applyToSelection') : t('imageEditor.modal.rightPanel.applyAdjustments'))}
                        </button>
                    </div>
                </CollapsibleSection>
                
                <CollapsibleSection title={t('imageEditor.modal.rightPanel.effects')}>
                    <Slider label={t('imageEditor.modal.rightPanel.sliders.grain')} value={adjustments.grain} onChange={v => handleAdjustmentChange('grain', v)} onReset={() => resetAdjustment('grain')} min={0} />
                    <Slider label={t('imageEditor.modal.rightPanel.sliders.clarity')} value={adjustments.clarity} onChange={v => handleAdjustmentChange('clarity', v)} onReset={() => resetAdjustment('clarity')} min={0} />
                    <Slider label={t('imageEditor.modal.rightPanel.sliders.dehaze')} value={adjustments.dehaze} onChange={v => handleAdjustmentChange('dehaze', v)} onReset={() => resetAdjustment('dehaze')} min={0} />
                    <Slider label={t('imageEditor.modal.rightPanel.sliders.blur')} value={adjustments.blur} onChange={v => handleAdjustmentChange('blur', v)} onReset={() => resetAdjustment('blur')} min={0} />
                    <div className="mt-4 pt-4 border-t border-zinc-700/50">
                        <button
                            onClick={onApplyEffectsAdjustments}
                            disabled={!hasEffectsAdjustments || isLoading}
                            className="w-full bg-amber-600 text-white font-semibold py-2 rounded-lg text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {isLoading ? <Spinner /> : (selectionPath ? t('imageEditor.modal.rightPanel.applyToSelection') : t('imageEditor.modal.rightPanel.applyAdjustments'))}
                        </button>
                    </div>
                </CollapsibleSection>
            </div>
        </div>
    );
};
