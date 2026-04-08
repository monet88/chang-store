
import React, { useState } from 'react';
import { AnalyzedItem, AspectRatio, DEFAULT_IMAGE_RESOLUTION, Feature, ImageFile, ImageResolution } from '../types';
import { critiqueAndRedesignOutfit, extractOutfitItem } from '../services/imageEditingService';
import { analyzeOutfit } from '../services/textService';
import type { RedesignPreset } from '../services/gemini/image';
import { useLanguage } from '../contexts/LanguageContext';
import { useApi } from '../contexts/ApiProviderContext';
import ImageUploader from './ImageUploader';
import Spinner from './Spinner';
import HoverableImage from './HoverableImage';
import { getErrorMessage } from '../utils/imageUtils';
import { BackIcon, CloseIcon, LayoutIcon, ReloadIcon, VisibleIcon } from './Icons';
import ImageOptionsPanel from './ImageOptionsPanel';

interface RedesignResult {
    preset: RedesignPreset;
    critique: string;
    images: ImageFile[];
}

const OutfitAnalysis: React.FC = () => {
    const { t } = useLanguage();
    const { imageEditModel, textGenerateModel } = useApi();
    const buildImageServiceConfig = (onStatusUpdate: (message: string) => void) => ({
        onStatusUpdate,
    });

    const [step, setStep] = useState(0); // 0: upload, 1: analysis, 2: redesign results
    const [uploadedImage, setUploadedImage] = useState<ImageFile | null>(null);
    const [analysisResults, setAnalysisResults] = useState<AnalyzedItem[]>([]);
    const [redesignResults, setRedesignResults] = useState<RedesignResult[]>([]);

    const [selectedPresets, setSelectedPresets] = useState<RedesignPreset[]>([]);
    const [generationCount, setGenerationCount] = useState(1);
    const [aspectRatio, setAspectRatio] = useState<AspectRatio>('Default');
    const [resolution, setResolution] = useState<ImageResolution>(DEFAULT_IMAGE_RESOLUTION);

    const [isLoading, setIsLoading] = useState(false);
    const [loadingMessage, setLoadingMessage] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [extractionStatus, setExtractionStatus] = useState<Record<string, 'loading' | 'done'>>({});

    const PRESETS: { key: RedesignPreset; label: string }[] = [
        { key: 'casual', label: t('outfitAnalysis.presets.casual') },
        { key: 'smart-casual', label: t('outfitAnalysis.presets.smartCasual') },
        { key: 'luxury', label: t('outfitAnalysis.presets.luxury') },
        { key: 'asian-style', label: t('outfitAnalysis.presets.asianStyle') },
    ];

    const handleStartOver = () => {
        setStep(0);
        setUploadedImage(null);
        setAnalysisResults([]);
        setRedesignResults([]);
        setSelectedPresets([]);
        setGenerationCount(1);
        setIsLoading(false);
        setLoadingMessage('');
        setError(null);
        setExtractionStatus({});
    };

    const handleBack = () => {
        setStep(prev => Math.max(0, prev - 1));
        setError(null);
    };

    const handleUpload = async (file: ImageFile | null) => {
        if (!file) {
            setUploadedImage(null);
            return;
        }
        setUploadedImage(file);

        setIsLoading(true);
        setLoadingMessage(t('outfitAnalysis.statusAnalyzing'));
        setError(null);
        try {
            const results = await analyzeOutfit(file, textGenerateModel);
            setAnalysisResults(results);
            setStep(1);
        } catch (err) {
            setError(getErrorMessage(err, t));
        } finally {
            setIsLoading(false);
        }
    };

    const handleGenerateRedesigns = async () => {
        if (!uploadedImage) return;
        if (selectedPresets.length === 0) {
            setError(t('outfitAnalysis.styleSelectionError'));
            return;
        }

        setIsLoading(true);
        setLoadingMessage(t('outfitAnalysis.generatingRedesigns'));
        setError(null);
        setRedesignResults([]);

        const allPresets: RedesignPreset[] = PRESETS.map(p => p.key);

        // Scenario 1: Single style selected -> generate 'generationCount' variations of it.
        if (selectedPresets.length === 1) {
            const preset = selectedPresets[0];
            const presetLabel = PRESETS.find(p => p.key === preset)?.label || preset;
            setLoadingMessage(t('outfitAnalysis.statusGeneratingStyle', { style: presetLabel, progress: 1, total: 1 }));

            try {
                const { critique, redesignedImages } = await critiqueAndRedesignOutfit(
                    uploadedImage,
                    preset,
                    generationCount,
                    imageEditModel,
                    buildImageServiceConfig((msg) => {
                        const baseMsg = t('outfitAnalysis.statusGeneratingStyle', { style: presetLabel, progress: 1, total: 1 });
                        setLoadingMessage(`${baseMsg} - ${msg}`);
                    }),
                    aspectRatio,
                    resolution
                );
                setRedesignResults([{ preset, critique, images: redesignedImages }]);
                setStep(2);
            } catch (err) {
                setError(getErrorMessage(err, t));
            } finally {
                setIsLoading(false);
            }
            return;
        }

        // Scenario 2: Multiple styles selected -> apply smart generation logic.
        let generationTasks: RedesignPreset[] = [];
        if (generationCount > selectedPresets.length) {
            generationTasks = [...selectedPresets];
            const remainingSlots = generationCount - selectedPresets.length;
            for (let i = 0; i < remainingSlots; i++) {
                const randomPreset = allPresets[Math.floor(Math.random() * allPresets.length)];
                generationTasks.push(randomPreset);
            }
        } else {
            generationTasks = selectedPresets.slice(0, generationCount);
        }

        const taskCounts = generationTasks.reduce((acc, preset) => {
            acc[preset] = (acc[preset] || 0) + 1;
            return acc;
        }, {} as Record<RedesignPreset, number>);

        const tasksToRun = Object.entries(taskCounts) as [RedesignPreset, number][];
        const allResults: RedesignResult[] = [];
        let completedTasks = 0;

        for (const [preset, count] of tasksToRun) {
            const presetLabel = PRESETS.find(p => p.key === preset)?.label || preset;
            completedTasks++;
            setLoadingMessage(t('outfitAnalysis.statusGeneratingStyle', {
                style: presetLabel,
                progress: completedTasks,
                total: tasksToRun.length,
            }));

            try {
                const { critique, redesignedImages } = await critiqueAndRedesignOutfit(
                    uploadedImage,
                    preset,
                    count,
                    imageEditModel,
                    buildImageServiceConfig((msg) => {
                        const baseMsg = t('outfitAnalysis.statusGeneratingStyle', { style: presetLabel, progress: completedTasks, total: tasksToRun.length });
                        setLoadingMessage(`${baseMsg} - ${msg}`);
                    }),
                    aspectRatio,
                    resolution
                );
                allResults.push({ preset, critique, images: redesignedImages });
            } catch (err) {
                setError(getErrorMessage(err, t));
                setIsLoading(false);
                return;
            }
        }

        setRedesignResults(allResults);
        setStep(2);
        setIsLoading(false);
    };

    const handleExtractItem = async (item: AnalyzedItem) => {
        if (!uploadedImage) return;

        const key = item.item;
        setExtractionStatus(prev => ({ ...prev, [key]: 'loading' }));
        setError(null);
        try {
            const itemToExtract = `${item.item} - ${item.description}`;
            const extractedImage = await extractOutfitItem(
                uploadedImage,
                itemToExtract,
                imageEditModel,
                buildImageServiceConfig(() => { })
            );
            setExtractionStatus(prev => ({ ...prev, [key]: 'done' }));
        } catch (err) {
            setError(getErrorMessage(err, t));
            setExtractionStatus(prev => {
                const newStatus = { ...prev };
                delete newStatus[key];
                return newStatus;
            });
        }
    }

    const handleTogglePreset = (preset: RedesignPreset) => {
        setSelectedPresets(prev =>
            prev.includes(preset)
                ? prev.filter(p => p !== preset)
                : [...prev, preset]
        );
    };

    // --- RENDER LOGIC ---
    const renderNavigation = () => (
        <div className="mt-8 flex justify-between items-center">
            <button onClick={handleBack} className="flex items-center gap-2 text-sm text-zinc-400 hover:text-white transition-colors">
                <BackIcon className="w-4 h-4" />
                <span>{t('outfitAnalysis.prevStep')}</span>
            </button>
            <button onClick={handleStartOver} className="flex items-center gap-2 text-sm text-zinc-400 hover:text-white transition-colors">
                <ReloadIcon className="w-4 h-4" />
                <span>{t('outfitAnalysis.startOver')}</span>
            </button>
        </div>
    );

    if (step === 0) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[50vh] animate-fade-in">
                <h2 className="text-xl md:text-2xl font-bold text-center mb-2">{t('outfitAnalysis.uploadTitle')}</h2>
                <p className="text-zinc-400 text-center mb-8 max-w-lg">{t('outfitAnalysis.uploadDescription')}</p>
                {isLoading ? (
                    <div className="text-center"><Spinner /><p className="mt-4 text-zinc-400">{loadingMessage}</p></div>
                ) : error ? (
                    <div className="text-center text-red-400 p-4 w-full">
                        <h3 className="font-bold mb-2">{t('common.generationFailed')}</h3>
                        <p className="text-sm">{error}</p>
                        <button onClick={handleStartOver} className="mt-4 bg-amber-600 text-white font-semibold py-2 px-4 rounded-lg">{t('outfitAnalysis.tryAgain')}</button>
                    </div>
                ) : (
                    <div className="w-full max-w-sm">
                        <ImageUploader image={uploadedImage} onImageUpload={handleUpload} title={t('outfitAnalysis.uploadCardTitle')} id="outfit-upload" />
                    </div>
                )}
            </div>
        );
    }

    if (step === 1) {
        return (
            <div className="animate-fade-in">
                <h2 className="text-xl md:text-2xl font-bold text-center mb-8">{t('outfitAnalysis.analysisTitle')}</h2>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6 lg:gap-8 items-start overflow-x-hidden pb-12">
                    <div className="lg:sticky lg:top-8">
                        {uploadedImage && <HoverableImage image={uploadedImage} altText={t('outfitAnalysis.uploadedAlt')} downloadPrefix={Feature.OutfitAnalysis} />}
                    </div>
                    <div className="flex flex-col gap-6">
                        <div className="overflow-x-auto bg-zinc-900/50 rounded-lg border border-zinc-800">
                            <table className="w-full text-sm text-left text-zinc-300">
                                <thead className="text-xs text-amber-400 uppercase bg-zinc-800/60">
                                    <tr>
                                        <th scope="col" className="px-6 py-3">{t('outfitAnalysis.item')}</th>
                                        <th scope="col" className="px-6 py-3">{t('outfitAnalysis.description')}</th>
                                        <th scope="col" className="px-6 py-3">{t('outfitAnalysis.brands')}</th>
                                        <th scope="col" className="px-6 py-3">{t('outfitAnalysis.action')}</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {analysisResults.map((item, index) => {
                                        const status = extractionStatus[item.item];
                                        return (
                                            <tr key={index} className="border-b border-zinc-700">
                                                <th scope="row" className="px-6 py-4 font-medium text-white whitespace-nowrap">{item.item}</th>
                                                <td className="px-6 py-4 max-w-xs">{item.description}</td>
                                                <td className="px-6 py-4">{item.possibleBrands.join(', ')}</td>
                                                <td className="px-6 py-4">
                                                    {status === 'loading' ? (
                                                        <div className="flex items-center justify-center"><Spinner /></div>
                                                    ) : status === 'done' ? (
                                                        <span className="text-green-400 font-semibold">{t('outfitAnalysis.extracted')}</span>
                                                    ) : (
                                                        <button onClick={() => handleExtractItem(item)} className="flex items-center gap-2 text-sm text-cyan-400 hover:text-cyan-300 transition-colors disabled:text-zinc-500 disabled:cursor-not-allowed">
                                                            <LayoutIcon className="w-4 h-4" />
                                                            <span>{t('outfitAnalysis.extract')}</span>
                                                        </button>
                                                    )}
                                                </td>
                                            </tr>
                                        )
                                    })}
                                </tbody>
                            </table>
                        </div>
                        {error && <div className="text-center text-red-400 p-2 text-sm">{error}</div>}

                        <div className="p-4 bg-zinc-900/50 rounded-lg border border-zinc-800 space-y-6">
                            <h3 className="text-base md:text-lg font-semibold text-center text-amber-400">{t('outfitAnalysis.redesignTitle')}</h3>

                            <div>
                                <label className="block text-sm font-medium text-zinc-300 mb-2 text-center">{t('outfitAnalysis.selectStyles')}</label>
                                <div className="grid grid-cols-2 gap-3">
                                    {PRESETS.map(({ key, label }) => {
                                        const isSelected = selectedPresets.includes(key);
                                        return (
                                            <button key={key} onClick={() => handleTogglePreset(key)} className={`py-2.5 px-3 text-sm font-semibold rounded-lg transition-all duration-200 flex items-center justify-center gap-2 ring-2 ring-transparent focus:outline-none focus:ring-amber-500 ${isSelected ? 'bg-gradient-to-r from-amber-500 to-orange-600 text-white shadow-md' : 'bg-zinc-700 hover:bg-zinc-600/80 text-zinc-200'}`}>
                                                {label}
                                                {isSelected && <VisibleIcon className="w-5 h-5 text-white" />}
                                            </button>
                                        )
                                    })}
                                </div>
                            </div>

                            {selectedPresets.length > 0 && (
                                <div className="animate-fade-in">
                                    <label className="block text-xs font-medium text-zinc-400 mb-2">{t('outfitAnalysis.selectedStyles')}</label>
                                    <div className="flex flex-wrap gap-2 p-2 bg-zinc-800/50 rounded-lg border border-zinc-700/50">
                                        {selectedPresets.map(preset => (
                                            <div key={preset} className="bg-zinc-700 text-zinc-200 text-xs font-semibold pl-3 pr-2 py-1.5 rounded-full flex items-center gap-2">
                                                <span>{PRESETS.find(p => p.key === preset)?.label}</span>
                                                <button onClick={() => handleTogglePreset(preset)} className="text-zinc-400 hover:text-white bg-zinc-600/50 hover:bg-zinc-500/50 rounded-full p-0.5" aria-label={t('outfitAnalysis.removeStyleAria', { style: PRESETS.find(p => p.key === preset)?.label })}>
                                                    <CloseIcon className="w-3 h-3" />
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            <div>
                                <label htmlFor="generation-count-slider" className="block text-sm font-medium text-zinc-300 mb-3 text-center">{t('outfitAnalysis.imageCountLabel')}</label>
                                <div className="flex items-center gap-4">
                                    <input
                                        id="generation-count-slider"
                                        type="range"
                                        min="1"
                                        max="6"
                                        step="1"
                                        value={generationCount}
                                        onChange={(e) => setGenerationCount(Number(e.target.value))}
                                        className="w-full h-2 bg-zinc-700 rounded-lg appearance-none cursor-pointer range-thumb:bg-amber-500"
                                    />
                                    <span className="bg-amber-600 text-white text-sm font-bold rounded-full h-8 w-8 flex-shrink-0 flex items-center justify-center">
                                        {generationCount}
                                    </span>
                                </div>
                            </div>

                            <ImageOptionsPanel
                                aspectRatio={aspectRatio} setAspectRatio={setAspectRatio}
                                resolution={resolution} setResolution={setResolution}
                                model={imageEditModel}
                            />

                            <div className="pt-4 border-t border-zinc-700/50">
                                <button onClick={handleGenerateRedesigns} disabled={isLoading || selectedPresets.length === 0} className="w-full bg-gradient-to-r from-amber-500 to-orange-600 text-white font-bold py-3 px-6 rounded-full hover:opacity-90 disabled:from-zinc-600 disabled:to-zinc-700 disabled:opacity-70 disabled:cursor-not-allowed shadow-lg shadow-amber-500/30 transition-all transform hover:scale-105 flex items-center justify-center">
                                    {isLoading ? <Spinner /> : <span>{t('outfitAnalysis.generateRedesigns')}</span>}
                                </button>
                                {isLoading && <p className="mt-2 text-center text-zinc-400 text-sm">{loadingMessage}</p>}
                            </div>
                        </div>
                    </div>
                </div>
                {renderNavigation()}
            </div>
        )
    }

    if (step === 2) {
        return (
            <div className="animate-fade-in">
                <h2 className="text-xl md:text-2xl font-bold text-center mb-8">{t('outfitAnalysis.redesignTitle')}</h2>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6 lg:gap-8 items-start overflow-x-hidden pb-12">
                    <div>
                        <div className="lg:sticky lg:top-8">
                            <h3 className="text-base md:text-lg font-semibold text-center mb-2 text-zinc-400">{t('outfitAnalysis.originalOutfit')}</h3>
                            {uploadedImage && <HoverableImage image={uploadedImage} altText={t('outfitAnalysis.uploadedAlt')} downloadPrefix={Feature.OutfitAnalysis} />}
                        </div>
                    </div>
                    <div className="space-y-8">
                        {redesignResults.map(result => (
                            <div key={result.preset}>
                                <h3 className="text-xl font-semibold text-center mb-4 text-transparent bg-clip-text bg-gradient-to-r from-amber-400 to-orange-400">
                                    {t('outfitAnalysis.redesignSuggestionPreset', { preset: PRESETS.find(p => p.key === result.preset)?.label || '' })}
                                </h3>
                                <div className={`grid gap-4 ${result.images.length > 1 ? 'grid-cols-2' : 'grid-cols-1'}`}>
                                    {result.images.map((image, index) => {
                                        const presetLabel = PRESETS.find(p => p.key === result.preset)?.label || result.preset;
                                        const altText = t('outfitAnalysis.redesignedAlt', { style: presetLabel });
                                        return (
                                            <div key={index} className="flex flex-col bg-zinc-800 rounded-lg overflow-hidden border border-zinc-700 shadow-md">
                                                <HoverableImage
                                                    image={image}
                                                    altText={altText}
                                                    downloadPrefix={Feature.OutfitAnalysis}
                                                    containerClassName="relative group aspect-square w-full bg-zinc-900"
                                                />
                                                <div className="p-3 bg-zinc-900 text-center border-t border-zinc-700/50">
                                                    <p className="font-semibold text-amber-300 text-sm truncate" title={presetLabel}>{presetLabel}</p>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                                <div className="mt-6 bg-zinc-900/50 rounded-lg border border-zinc-800 p-4">
                                    <h4 className="text-base md:text-lg font-semibold mb-2 text-amber-400">{t('outfitAnalysis.critiqueTitle')}</h4>
                                    <p className="text-zinc-300 text-sm whitespace-pre-wrap leading-relaxed">{result.critique}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
                {renderNavigation()}
            </div>
        )
    }

    return null;
};

export default OutfitAnalysis;
