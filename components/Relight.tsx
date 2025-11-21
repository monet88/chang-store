



import React, { useState } from 'react';
import { Feature, ImageFile, AspectRatio } from '../types';
import { useLanguage } from '../contexts/LanguageContext';
import { useImageGallery } from '../contexts/ImageGalleryContext';
import { useApi } from '../contexts/ApiProviderContext';
import { editImage } from '../services/imageEditingService';
import { getErrorMessage } from '../utils/imageUtils';

import Spinner, { ErrorDisplay } from './Spinner';
import HoverableImage from './HoverableImage';
import ImageUploader from './ImageUploader';
import { GalleryIcon } from './Icons';
import AspectRatioSelector from './AspectRatioSelector';


// --- Main Component ---
type BacklightDirection = 'Left' | 'Center' | 'Right';
type LightType = 'Natural' | '1 Light' | '2 Lights' | '3 Lights';
type Quality = 'Standard' | '2K' | '4K';
type LightColor = 'natural' | 'red' | 'green' | 'blue' | 'purple';

const COLORS: { name: LightColor; hex: string }[] = [
    { name: 'natural', hex: '#FFF5E1' },
    { name: 'red', hex: '#EF4444' },
    { name: 'green', hex: '#22C55E' },
    { name: 'blue', hex: '#3B82F6' },
    { name: 'purple', hex: '#A855F7' },
];

const getLightColorDescription = (color: LightColor): string => {
    let colorDesc = '';
    switch (color) {
        case 'natural':
            colorDesc = "an extremely soft, warm, golden glow of a late afternoon sunset.";
            break;
        case 'red':
            colorDesc = "a vibrant, saturated red glow, as if from a professional LED panel with a red gel.";
            break;
        case 'green':
            colorDesc = "a vibrant, saturated green glow, as if from a professional LED panel with a green gel.";
            break;
        case 'blue':
            colorDesc = "a cool, saturated blue glow, as if from a professional LED panel with a blue gel.";
            break;
        case 'purple':
            colorDesc = "a rich, saturated purple glow, as if from a professional LED panel with a purple gel.";
            break;
    }
    return `${colorDesc}\n**CRITICAL LIGHTING STANDARD (Applies to this light):**\nThis light source MUST be powerful enough to create a clean, distinct, and photographically accurate **rim light** on the subject. The rim light's purpose is to trace the subject's outline, separating them from the background. This effect is the primary, mandatory objective. The light must be simulated as a large, professionally diffused source (like a softbox), resulting in a soft, flattering quality of light with smooth falloff.`;
};

const generateRelightPrompt = (
    direction: BacklightDirection,
    type: LightType,
    quality: Quality,
    customPrompt: string,
    light1Color: LightColor,
    light2Color: LightColor,
    light3Color: LightColor
): string => {
    let prompt = `
# INSTRUCTION: PROFESSIONAL IMAGE RELIGHTING

## 1. CORE TASK
Your primary task is to relight the provided source image according to the specified lighting setup. You must preserve the subject, clothing, pose, and background with 100% accuracy. Only the lighting and shadows should change.

## 2. IMAGE QUALITY
- **Output Quality**: The final image must be rendered in ${quality} quality, with photorealistic textures, high detail, and no digital artifacts.

## 3. LIGHTING SETUP
`;

    if (type === 'Natural') {
        prompt += `
- **Light Type**: Natural Lighting.
- **Description**: Simulate soft, diffused natural light (like on an overcast day or from a large window) coming from the **${direction}**. The light should wrap gently around the subject, creating soft, natural-looking shadows. The mood should be clean and airy.
`;
    } else {
        const lightCount = type === '1 Light' ? 1 : type === '2 Lights' ? 2 : 3;
        prompt += `- **Light Type**: Studio Lighting (${lightCount} Light Setup).\n`;
        
        const lightPositions = {
            Left: ['the left', 'the right', 'above'],
            Center: ['directly in front', 'the left', 'the right'],
            Right: ['the right', 'the left', 'above']
        };
        const positions = lightPositions[direction];

        prompt += `
- **Light 1 (Key Light)**:
  - **Position**: Placed from **${positions[0]}** of the subject.
  - **Color & Quality**: This light should cast ${getLightColorDescription(light1Color)}
`;
        
        if (lightCount > 1) {
            prompt += `
- **Light 2 (Fill/Rim Light)**:
  - **Position**: Placed from **${positions[1]}** of the subject.
  - **Color & Quality**: This light should cast ${getLightColorDescription(light2Color)}
`;
        }
        
        if (lightCount > 2) {
             prompt += `
- **Light 3 (Accent/Hair Light)**:
  - **Position**: Placed from **${positions[2]}**, slightly behind the subject.
  - **Color & Quality**: This light should cast ${getLightColorDescription(light3Color)}
`;
        }
    }

    if (customPrompt.trim()) {
        prompt += `
## 4. ADDITIONAL INSTRUCTIONS
- Apply the following user-defined instruction: "${customPrompt.trim()}". This instruction should modify or enhance the lighting setup described above.
`;
    }

    prompt += `
## 5. STRICT NEGATIVE CONSTRAINTS
- DO NOT change the subject's face, body, pose, or clothing.
- DO NOT change the background or any environmental elements.
- DO NOT add or remove any objects.
- The only change should be the lighting and the resulting shadows and highlights.
`;
    return prompt.trim();
};

const Relight: React.FC = () => {
    const { t } = useLanguage();
    const { addImage } = useImageGallery();
    const { getModelsForFeature, falApiKey, nanobananaApiKey } = useApi();
    const { imageEditModel } = getModelsForFeature(Feature.Relight);

    const [image, setImage] = useState<ImageFile | null>(null);
    const [backlightDirection, setBacklightDirection] = useState<BacklightDirection>('Left');
    const [lightType, setLightType] = useState<LightType>('Natural');
    const [quality, setQuality] = useState<Quality>('2K');
    const [customPrompt, setCustomPrompt] = useState('');
    const [light1Color, setLight1Color] = useState<LightColor>('natural');
    const [light2Color, setLight2Color] = useState<LightColor>('natural');
    const [light3Color, setLight3Color] = useState<LightColor>('natural');
    const [aspectRatio, setAspectRatio] = useState<AspectRatio>('Default');

    const [generatedImage, setGeneratedImage] = useState<ImageFile | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [loadingMessage, setLoadingMessage] = useState('');
    const [error, setError] = useState<string | null>(null);

    const handleRelight = async () => {
        if (!image) {
            setError(t('relight.inputError'));
            return;
        }
        if (imageEditModel.startsWith('fal-ai/') && !falApiKey) {
            setError(t('error.api.falAuth'));
            return;
        }
        if (imageEditModel.startsWith('nanobanana/') && !nanobananaApiKey) {
            setError(t('error.api.nanobananaAuth'));
            return;
        }

        setIsLoading(true);
        setLoadingMessage(t('relight.generatingStatus'));
        setError(null);

        const prompt = generateRelightPrompt(backlightDirection, lightType, quality, customPrompt, light1Color, light2Color, light3Color);
        
        try {
            const [result] = await editImage({ images: [image], prompt, numberOfImages: 1, aspectRatio }, imageEditModel, { falApiKey, nanobananaApiKey, onStatusUpdate: setLoadingMessage });
            setGeneratedImage(result);
            addImage(result);
        } catch (err) {
            setError(getErrorMessage(err, t));
        } finally {
            setIsLoading(false);
        }
    };
    
    const lightCount = lightType === '1 Light' ? 1 : lightType === '2 Lights' ? 2 : lightType === '3 Lights' ? 3 : 0;
    
    const lightTypeTranslations = {
        'Natural': t('relight.natural'),
        '1 Light': t('relight.oneLight'),
        '2 Lights': t('relight.twoLights'),
        '3 Lights': t('relight.threeLights'),
    };

    return (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
            <div className="flex flex-col gap-6">
                <div className="text-center">
                    <h2 className="text-2xl font-bold mb-1">{t('relight.title')}</h2>
                    <p className="text-zinc-400">{t('relight.description')}</p>
                </div>
                
                <div className="w-full max-w-sm mx-auto">
                    <ImageUploader image={image} onImageUpload={(file) => { setImage(file); if(file) addImage(file); }} title={t('relight.uploadTitle')} id="relight-upload" />
                </div>

                <div className="space-y-6 bg-zinc-900/50 p-4 rounded-lg border border-zinc-800">
                    <div>
                        <label className="block text-sm font-medium text-zinc-300 text-center mb-2">{t('relight.lightType')}</label>
                        <div className="flex justify-center gap-2 bg-zinc-800/50 p-1.5 rounded-lg">
                            {(['Natural', '1 Light', '2 Lights', '3 Lights'] as LightType[]).map(lt => (
                                <button key={lt} onClick={() => setLightType(lt)} className={`px-3 py-1.5 text-xs font-semibold rounded-md ${lightType === lt ? 'bg-amber-600 text-white' : 'bg-zinc-700 hover:bg-zinc-600/80 text-zinc-300'}`}>{lightTypeTranslations[lt]}</button>
                            ))}
                        </div>
                    </div>
                    {lightType !== 'Natural' &&
                    <div className="animate-fade-in space-y-4">
                         <div>
                            <label className="block text-sm font-medium text-zinc-300 text-center mb-2">{t('relight.backlightDirection')}</label>
                            <div className="flex justify-center gap-2 bg-zinc-800/50 p-1.5 rounded-lg">
                                {(['Left', 'Center', 'Right'] as BacklightDirection[]).map(dir => (
                                    <button key={dir} onClick={() => setBacklightDirection(dir)} className={`px-4 py-1.5 text-sm font-semibold rounded-md ${backlightDirection === dir ? 'bg-amber-600 text-white' : 'bg-zinc-700 hover:bg-zinc-600/80 text-zinc-300'}`}>{t(`relight.${dir.toLowerCase()}`)}</button>
                                ))}
                            </div>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                            {lightCount >= 1 && <div><label className="block text-xs text-zinc-400 mb-1">Light 1</label><div className="flex gap-1">{COLORS.map(c => <button key={c.name} onClick={() => setLight1Color(c.name)} className={`w-6 h-6 rounded-full border-2 ${light1Color === c.name ? 'border-white' : 'border-transparent'}`} style={{backgroundColor: c.hex}} />)}</div></div>}
                            {lightCount >= 2 && <div><label className="block text-xs text-zinc-400 mb-1">Light 2</label><div className="flex gap-1">{COLORS.map(c => <button key={c.name} onClick={() => setLight2Color(c.name)} className={`w-6 h-6 rounded-full border-2 ${light2Color === c.name ? 'border-white' : 'border-transparent'}`} style={{backgroundColor: c.hex}} />)}</div></div>}
                            {lightCount >= 3 && <div><label className="block text-xs text-zinc-400 mb-1">Light 3</label><div className="flex gap-1">{COLORS.map(c => <button key={c.name} onClick={() => setLight3Color(c.name)} className={`w-6 h-6 rounded-full border-2 ${light3Color === c.name ? 'border-white' : 'border-transparent'}`} style={{backgroundColor: c.hex}} />)}</div></div>}
                        </div>
                    </div>
                    }
                    <div>
                        <label className="block text-sm font-medium text-zinc-300 text-center mb-2">{t('relight.quality')}</label>
                        <div className="flex justify-center gap-2 bg-zinc-800/50 p-1.5 rounded-lg">
                            {(['Standard', '2K', '4K'] as Quality[]).map(q => (
                                <button key={q} onClick={() => setQuality(q)} className={`px-4 py-1.5 text-sm font-semibold rounded-md ${quality === q ? 'bg-amber-600 text-white' : 'bg-zinc-700 hover:bg-zinc-600/80 text-zinc-300'}`}>{t(`relight.${q.toLowerCase()}`)}</button>
                            ))}
                        </div>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-zinc-300 mb-2">{t('relight.additionalPrompt')}</label>
                        <input type="text" value={customPrompt} onChange={e => setCustomPrompt(e.target.value)} placeholder={t('relight.additionalPromptPlaceholder')} className="w-full bg-zinc-800/50 border border-zinc-700 rounded-lg p-2 text-zinc-200" />
                    </div>
                     <AspectRatioSelector aspectRatio={aspectRatio} setAspectRatio={setAspectRatio} />
                </div>

                <div className="text-center">
                    <button onClick={handleRelight} disabled={isLoading || !image} className="bg-gradient-to-r from-amber-500 to-orange-600 text-white font-bold py-3 px-8 rounded-full hover:opacity-90 disabled:from-zinc-600 disabled:to-zinc-700 disabled:opacity-70 disabled:cursor-not-allowed shadow-lg shadow-amber-500/30 transition-all transform hover:scale-105">
                        {isLoading ? <Spinner /> : t('relight.relightButton')}
                    </button>
                </div>
            </div>
            
            <div className="sticky top-8">
                 <div className="relative w-full bg-zinc-900/50 rounded-2xl border border-zinc-800 flex items-center justify-center p-4 min-h-[50vh] lg:min-h-0 lg:aspect-[4/5]">
                    {isLoading ? (
                        <div className="text-center"><Spinner /><p className="mt-4 text-zinc-400">{loadingMessage}</p></div>
                    ) : error ? (
                        <div className="p-4 w-full"><ErrorDisplay title={t('common.generationFailed')} message={error} onClear={() => setError(null)} /></div>
                    ) : generatedImage ? (
                        <HoverableImage image={generatedImage} altText="Relit image" onRegenerate={handleRelight} isGenerating={isLoading} />
                    ) : (
                        <div className="text-center text-zinc-500 pointer-events-none p-4">
                            <GalleryIcon className="mx-auto h-16 w-16" />
                            <h3 className="mt-4 text-lg font-semibold text-zinc-400">{t('common.outputPanelTitle')}</h3>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default Relight;