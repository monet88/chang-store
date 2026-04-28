import React from 'react';
import { Feature } from '../types';
import Spinner, { ErrorDisplay } from './Spinner';
import HoverableImage from './HoverableImage';
import ImageUploader from './ImageUploader';
import ResultPlaceholder from './shared/ResultPlaceholder';
import ImageOptionsPanel from './ImageOptionsPanel';
import { useRelight } from '../hooks/useRelight';

const COLORS = [
  { name: 'natural', hex: '#FFF5E1' },
  { name: 'red', hex: '#EF4444' },
  { name: 'green', hex: '#22C55E' },
  { name: 'blue', hex: '#3B82F6' },
  { name: 'purple', hex: '#A855F7' },
] as const;

const Relight: React.FC = () => {
  const {
    t,
    imageEditModel,
    image,
    setImage,
    backlightDirection,
    setBacklightDirection,
    lightType,
    setLightType,
    quality,
    setQuality,
    customPrompt,
    setCustomPrompt,
    light1Color,
    setLight1Color,
    light2Color,
    setLight2Color,
    light3Color,
    setLight3Color,
    aspectRatio,
    setAspectRatio,
    resolution,
    setResolution,
    generatedImage,
    isLoading,
    loadingMessage,
    error,
    lightCount,
    lightTypeTranslations,
    handleRelight,
    clearError,
  } = useRelight();

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6 lg:gap-8 items-start overflow-x-hidden pb-12">
      <div className="flex flex-col gap-6">
        <div className="text-center">
          <h2 className="text-xl md:text-2xl font-bold mb-1">{t('relight.title')}</h2>
          <p className="text-zinc-400">{t('relight.description')}</p>
        </div>

        <div className="w-full max-w-sm mx-auto">
          <ImageUploader image={image} onImageUpload={setImage} title={t('relight.uploadTitle')} id="relight-upload" />
        </div>

        <div className="space-y-6 bg-zinc-900/50 p-4 rounded-lg border border-zinc-800">
          <div>
            <label className="block text-sm font-medium text-zinc-300 text-center mb-2">{t('relight.lightType')}</label>
            <div className="flex justify-center gap-2 bg-zinc-800/50 p-1.5 rounded-lg">
              {(['Natural', '1 Light', '2 Lights', '3 Lights'] as const).map((lt) => (
                <button key={lt} onClick={() => setLightType(lt)} className={`px-3 py-1.5 text-xs font-semibold rounded-md border transition-colors ${lightType === lt ? 'border-white/60 bg-zinc-100 text-zinc-950' : 'border-transparent bg-zinc-700/60 hover:bg-white/5 text-zinc-300 hover:text-zinc-100'}`}>{lightTypeTranslations[lt]}</button>
              ))}
            </div>
          </div>
          {lightType !== 'Natural' &&
            <div className="animate-fade-in space-y-4">
              <div>
                <label className="block text-sm font-medium text-zinc-300 text-center mb-2">{t('relight.backlightDirection')}</label>
                <div className="flex justify-center gap-2 bg-zinc-800/50 p-1.5 rounded-lg">
                  {(['Left', 'Center', 'Right'] as const).map((dir) => (
                    <button key={dir} onClick={() => setBacklightDirection(dir)} className={`px-4 py-1.5 text-sm font-semibold rounded-md border transition-colors ${backlightDirection === dir ? 'border-white/60 bg-zinc-100 text-zinc-950' : 'border-transparent bg-zinc-700/60 hover:bg-white/5 text-zinc-300 hover:text-zinc-100'}`}>{t(`relight.${dir.toLowerCase()}`)}</button>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {lightCount >= 1 && <div><label className="block text-xs text-zinc-400 mb-1">Light 1</label><div className="flex gap-1">{COLORS.map(c => <button key={c.name} onClick={() => setLight1Color(c.name)} className={`w-6 h-6 rounded-full border-2 ${light1Color === c.name ? 'border-white' : 'border-transparent'}`} style={{ backgroundColor: c.hex }} />)}</div></div>}
                {lightCount >= 2 && <div><label className="block text-xs text-zinc-400 mb-1">Light 2</label><div className="flex gap-1">{COLORS.map(c => <button key={c.name} onClick={() => setLight2Color(c.name)} className={`w-6 h-6 rounded-full border-2 ${light2Color === c.name ? 'border-white' : 'border-transparent'}`} style={{ backgroundColor: c.hex }} />)}</div></div>}
                {lightCount >= 3 && <div><label className="block text-xs text-zinc-400 mb-1">Light 3</label><div className="flex gap-1">{COLORS.map(c => <button key={c.name} onClick={() => setLight3Color(c.name)} className={`w-6 h-6 rounded-full border-2 ${light3Color === c.name ? 'border-white' : 'border-transparent'}`} style={{ backgroundColor: c.hex }} />)}</div></div>}
              </div>
            </div>
          }
          <div>
            <label className="block text-sm font-medium text-zinc-300 text-center mb-2">{t('relight.quality')}</label>
            <div className="flex justify-center gap-2 bg-zinc-800/50 p-1.5 rounded-lg">
              {(['Standard', '2K', '4K'] as const).map((q) => (
                <button key={q} onClick={() => setQuality(q)} className={`px-4 py-1.5 text-sm font-semibold rounded-md border transition-colors ${quality === q ? 'border-white/60 bg-zinc-100 text-zinc-950' : 'border-transparent bg-zinc-700/60 hover:bg-white/5 text-zinc-300 hover:text-zinc-100'}`}>{t(`relight.${q.toLowerCase()}`)}</button>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-zinc-300 mb-2">{t('relight.additionalPrompt')}</label>
            <input type="text" value={customPrompt} onChange={e => setCustomPrompt(e.target.value)} placeholder={t('relight.additionalPromptPlaceholder')} className="workspace-input p-2" />
          </div>
          <ImageOptionsPanel
            aspectRatio={aspectRatio} setAspectRatio={setAspectRatio}
            resolution={resolution} setResolution={setResolution}
            model={imageEditModel}
          />
        </div>

        <div className="text-center">
          <button onClick={handleRelight} disabled={isLoading || !image} className="workspace-button workspace-button-primary px-8 py-3 text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed">
            {isLoading ? <Spinner /> : t('relight.relightButton')}
          </button>
        </div>
      </div>

      <div className="lg:sticky lg:top-8">
        <div className="relative w-full min-h-[400px] lg:min-h-0 lg:aspect-[4/5] bg-zinc-900/50 rounded-2xl border border-zinc-800 flex items-center justify-center p-2 sm:p-4">
          {isLoading ? (
            <div className="text-center"><Spinner /><p className="mt-4 text-zinc-400">{loadingMessage}</p></div>
          ) : error ? (
            <div className="p-4 w-full"><ErrorDisplay title={t('common.generationFailed')} message={error} onClear={clearError} /></div>
          ) : generatedImage ? (
            <HoverableImage image={generatedImage} altText="Relit image" downloadPrefix={Feature.Relight} onRegenerate={handleRelight} isGenerating={isLoading} />
          ) : (
            <ResultPlaceholder description={t('relight.outputPanelDescription')} />
          )}
        </div>
      </div>
    </div>
  );
};

export default Relight;
