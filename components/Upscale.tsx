

import React, { useState } from 'react';
import ImageUploader from './ImageUploader';
import Spinner, { ErrorDisplay } from './Spinner';
import ImageComparator from './ImageComparator';
import { upscaleImage } from '../services/imageEditingService';
import { Feature, ImageFile, UpscaleQuality } from '../types';
import { useLanguage } from '../contexts/LanguageContext';
import { useApi } from '../contexts/ApiProviderContext';
import { getErrorMessage } from '../utils/imageUtils';
import ResultPlaceholder from './shared/ResultPlaceholder';

const QUALITY_OPTIONS: { value: UpscaleQuality; label: string }[] = [
  { value: '2K', label: '2K (2048px)' },
  { value: '4K', label: '4K (4096px)' },
];

const Upscale: React.FC = () => {
  const [uploadedImage, setUploadedImage] = useState<ImageFile | null>(null);
  const [generatedImage, setGeneratedImage] = useState<ImageFile | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [quality, setQuality] = useState<UpscaleQuality>('2K');

  const { t } = useLanguage();
  const { getModelsForFeature, antiApiBaseUrl, antiApiKey, localApiBaseUrl, localApiKey } = useApi();
  const { imageEditModel } = getModelsForFeature(Feature.Upscale);
  const buildImageServiceConfig = (onStatusUpdate: (message: string) => void) => ({
    onStatusUpdate,
    antiApiBaseUrl,
    antiApiKey,
    localApiBaseUrl,
    localApiKey,
  });

  const handleGenerate = async () => {
    if (!uploadedImage) {
      setError(t('upscale.inputError'));
      return;
    }

    setIsLoading(true);
    setLoadingMessage(t('upscale.generatingStatus'));
    setError(null);
    setGeneratedImage(null);

    try {
    const result = await upscaleImage(
      uploadedImage,
      imageEditModel,
      buildImageServiceConfig(setLoadingMessage),
      quality
    );
      setGeneratedImage(result);
    } catch (err) {
      setError(getErrorMessage(err, t));
    } finally {
      setIsLoading(false);
      setLoadingMessage('');
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6 lg:gap-8 items-stretch overflow-x-hidden pb-12">
      <div className="flex flex-col gap-6">
        <div className="text-center">
          <h2 className="text-xl md:text-2xl font-bold mb-1">{t('upscale.title')}</h2>
          <p className="text-zinc-400">{t('upscale.description')}</p>
        </div>

        <div className="w-full">
          <ImageUploader
            image={uploadedImage}
            id="upscale-upload"
            title={t('upscale.uploadTitle')}
            onImageUpload={setUploadedImage}
          />
        </div>

        <div className="w-full">
          <label className="block text-sm font-medium text-zinc-300 mb-2">{t('upscale.qualityLabel')}</label>
          <div className="flex gap-2">
            {QUALITY_OPTIONS.map((option) => (
              <button
                key={option.value}
                onClick={() => setQuality(option.value)}
                className={`flex-1 py-2 px-4 rounded-lg font-medium transition-all ${
                  quality === option.value
                    ? 'bg-gradient-to-r from-amber-500 to-orange-600 text-white'
                    : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        <div className="text-center">
          <button
            onClick={handleGenerate}
            disabled={isLoading || !uploadedImage}
            className="bg-gradient-to-r from-amber-500 to-orange-600 text-white font-bold py-3 px-8 rounded-full hover:opacity-90 disabled:from-zinc-600 disabled:to-zinc-700 disabled:opacity-70 disabled:cursor-not-allowed shadow-lg shadow-amber-500/30 transition-all transform hover:scale-105"
          >
            {isLoading ? <Spinner /> : (generatedImage ? t('upscale.generateAgainButton') : t('upscale.generateButton'))}
          </button>
        </div>
      </div>

      <div className="lg:sticky lg:top-8 h-full">
        <div className="relative w-full h-full min-h-[50vh] bg-zinc-900/50 rounded-2xl border border-zinc-800 grid place-items-center p-2 sm:p-4">
          {isLoading ? (
            <div className="text-center"><Spinner /><p className="mt-4 text-zinc-400">{loadingMessage}</p></div>
          ) : error ? (
            <div className="p-4">
              <ErrorDisplay title={t('common.generationFailed')} message={error} onClear={() => setError(null)} />
            </div>
          ) : generatedImage && uploadedImage ? (
            <div className="w-full h-full flex flex-col gap-4 absolute inset-0 p-4">
              <h3 className="text-xl font-semibold text-center text-transparent bg-clip-text bg-gradient-to-r from-amber-400 to-orange-500">{t('upscale.comparisonTitle')}</h3>
              <div className="flex-grow relative">
                <ImageComparator before={uploadedImage} after={generatedImage} />
              </div>
            </div>
          ) : (
            <ResultPlaceholder description={t('upscale.outputPanelDescription')} />
          )}
        </div>
      </div>
    </div>
  );
};

export default Upscale;
