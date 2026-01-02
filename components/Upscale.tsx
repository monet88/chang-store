

import React, { useState } from 'react';
import ImageUploader from './ImageUploader';
import Spinner, { ErrorDisplay } from './Spinner';
import ImageComparator from './ImageComparator';
import { upscaleImage } from '../services/imageEditingService';
import { Feature, ImageFile } from '../types';
import { useLanguage } from '../contexts/LanguageContext';
import { useApi } from '../contexts/ApiProviderContext';
import { getErrorMessage } from '../utils/imageUtils';

const ImageIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...props}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
  </svg>
);

const Upscale: React.FC = () => {
  const [uploadedImage, setUploadedImage] = useState<ImageFile | null>(null);
  const [generatedImage, setGeneratedImage] = useState<ImageFile | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('');
  const [error, setError] = useState<string | null>(null);

  const { t } = useLanguage();
  const { getModelsForFeature, aivideoautoAccessToken, aivideoautoImageModels } = useApi();
  const { imageEditModel } = getModelsForFeature(Feature.Upscale);
  const isAivideoautoModel = imageEditModel.startsWith('aivideoauto--');
  const requireAivideoautoConfig = () => {
    if (isAivideoautoModel && !aivideoautoAccessToken) {
      setError(t('error.api.aivideoautoAuth'));
      return false;
    }
    return true;
  };
  const buildImageServiceConfig = (onStatusUpdate: (message: string) => void) => ({
    onStatusUpdate,
    aivideoautoAccessToken,
    aivideoautoImageModels,
  });

  const handleGenerate = async () => {
    if (!uploadedImage) {
      setError(t('upscale.inputError'));
      return;
    }
    if (!requireAivideoautoConfig()) {
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
        buildImageServiceConfig(setLoadingMessage)
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
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6 lg:gap-8 items-start overflow-x-hidden pb-12">
      <div className="flex flex-col gap-8">
        <div className="text-center">
          <h2 className="text-xl md:text-2xl font-bold mb-1">{t('upscale.title')}</h2>
          <p className="text-zinc-400">{t('upscale.description')}</p>
        </div>

        <div className="w-full max-w-sm mx-auto">
          <ImageUploader
            image={uploadedImage}
            id="upscale-upload"
            title={t('upscale.uploadTitle')}
            onImageUpload={setUploadedImage}
          />
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

      <div className="lg:sticky lg:top-8">
        <div className="relative w-full min-h-[400px] lg:min-h-0 lg:aspect-[4/5] bg-zinc-900/50 rounded-2xl border border-zinc-800 flex items-center justify-center p-2 sm:p-4">
          {isLoading ? (
            <div className="text-center"><Spinner /><p className="mt-4 text-zinc-400">{loadingMessage}</p></div>
          ) : error ? (
            <div className="p-4">
              <ErrorDisplay title={t('common.generationFailed')} message={error} onClear={() => setError(null)} />
            </div>
          ) : generatedImage && uploadedImage ? (
            <div className="w-full h-full flex flex-col gap-4">
              <h3 className="text-xl font-semibold text-center text-transparent bg-clip-text bg-gradient-to-r from-amber-400 to-orange-500">{t('upscale.comparisonTitle')}</h3>
              <div className="flex-grow relative">
                <ImageComparator before={uploadedImage} after={generatedImage} />
              </div>
            </div>
          ) : (
            <div className="text-center text-zinc-500 pointer-events-none"><ImageIcon className="mx-auto h-16 w-16" /><h3 className="mt-4 text-base md:text-lg font-semibold text-zinc-400">{t('common.outputPanelTitle')}</h3><p className="mt-1 text-sm">{t('upscale.outputPanelDescription')}</p></div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Upscale;
