import { useState } from 'react';
import { AnalyzedItem, AspectRatio, DEFAULT_IMAGE_RESOLUTION, ImageFile, ImageResolution, RedesignPreset } from '../types';
import { useLanguage } from '../contexts/LanguageContext';
import { useApi } from '../contexts/ApiProviderContext';
import { critiqueAndRedesignOutfit, extractOutfitItem } from '../services/imageEditingService';
import { analyzeOutfit } from '../services/textService';
import { getErrorMessage } from '../utils/imageUtils';

interface RedesignResult {
  preset: RedesignPreset;
  critique: string;
  images: ImageFile[];
}

const buildImageServiceConfig = (onStatusUpdate: (message: string) => void) => ({
  onStatusUpdate,
});

export const useOutfitAnalysis = () => {
  const { t } = useLanguage();
  const { imageEditModel, textGenerateModel } = useApi();

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
    setStep((prev) => Math.max(0, prev - 1));
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

    const allPresets: RedesignPreset[] = PRESETS.map((preset) => preset.key);

    // Scenario 1: Single style selected -> generate 'generationCount' variations of it.
    if (selectedPresets.length === 1) {
      const preset = selectedPresets[0];
      const presetLabel = PRESETS.find((presetItem) => presetItem.key === preset)?.label || preset;
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
          resolution,
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
      const presetLabel = PRESETS.find((presetItem) => presetItem.key === preset)?.label || preset;
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
          resolution,
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
    setExtractionStatus((prev) => ({ ...prev, [key]: 'loading' }));
    setError(null);
    try {
      const itemToExtract = `${item.item} - ${item.description}`;
      await extractOutfitItem(
        uploadedImage,
        itemToExtract,
        imageEditModel,
        buildImageServiceConfig(() => {}),
      );
      setExtractionStatus((prev) => ({ ...prev, [key]: 'done' }));
    } catch (err) {
      setError(getErrorMessage(err, t));
      setExtractionStatus((prev) => {
        const newStatus = { ...prev };
        delete newStatus[key];
        return newStatus;
      });
    }
  };

  const handleTogglePreset = (preset: RedesignPreset) => {
    setSelectedPresets((prev) => (
      prev.includes(preset)
        ? prev.filter((selectedPreset) => selectedPreset !== preset)
        : [...prev, preset]
    ));
  };

  return {
    t,
    imageEditModel,

    step,
    uploadedImage,
    analysisResults,
    redesignResults,
    selectedPresets,
    generationCount,
    aspectRatio,
    resolution,
    isLoading,
    loadingMessage,
    error,
    extractionStatus,
    PRESETS,

    setGenerationCount,
    setAspectRatio,
    setResolution,

    handleStartOver,
    handleBack,
    handleUpload,
    handleGenerateRedesigns,
    handleExtractItem,
    handleTogglePreset,
  };
};
