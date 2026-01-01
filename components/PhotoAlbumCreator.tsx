import React, { useState } from 'react';
import { Feature, ImageFile, AspectRatio, ImageResolution, DEFAULT_IMAGE_RESOLUTION } from '../types';
import { useLanguage } from '../contexts/LanguageContext';
import { useImageGallery } from '../contexts/ImageGalleryContext';
import { useApi } from '../contexts/ApiProviderContext';
import { editImage } from '../services/imageEditingService';
import ImageUploader from './ImageUploader';
import Spinner, { ErrorDisplay, ProgressBar } from './Spinner';
import HoverableImage from './HoverableImage';
import { getErrorMessage } from '../utils/imageUtils';
// FIX: Added ReloadIcon to the import from './Icons'
import { GalleryIcon, ReloadIcon } from './Icons';
import ImageOptionsPanel from './ImageOptionsPanel';

type GenerationMode = 'fullModel' | 'faceAndOutfit';

interface GeneratedAlbumImage extends ImageFile {
    pose: string;
}

export const PhotoAlbumCreator: React.FC = () => {
    const { t } = useLanguage();
    const { addImage } = useImageGallery();
    const { getModelsForFeature, aivideoautoAccessToken, aivideoautoImageModels } = useApi();
    const { imageEditModel } = getModelsForFeature(Feature.PhotoAlbum);
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

    const [mode, setMode] = useState<GenerationMode>('fullModel');
    const [originalPhoto, setOriginalPhoto] = useState<ImageFile | null>(null);
    const [faceImage, setFaceImage] = useState<ImageFile | null>(null);
    const [outfitImage, setOutfitImage] = useState<ImageFile | null>(null);
    
    const [aspectRatio, setAspectRatio] = useState<AspectRatio>('9:16');
    const [resolution, setResolution] = useState<ImageResolution>(DEFAULT_IMAGE_RESOLUTION);
    const [cameraView, setCameraView] = useState<string>('fullBody');
    const [frame, setFrame] = useState('none');
    const [background, setBackground] = useState('none');
    const [selectedPoses, setSelectedPoses] = useState<string[]>([]);
    const [additionalNotes, setAdditionalNotes] = useState('');
    const [hairStyle, setHairStyle] = useState('long_straight_black');
    const [skinTone, setSkinTone] = useState('fair_smooth');

    const [generatedImages, setGeneratedImages] = useState<GeneratedAlbumImage[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [generationStatus, setGenerationStatus] = useState('');
    const [generationProgress, setGenerationProgress] = useState({ progress: 0, total: 0 });

    const POSES: string[] = t('photoAlbum.poses', { returnObjects: true });
    const FRAMES = t('photoAlbum.frames', { returnObjects: true });
    const BACKGROUND_LABELS = t('photoAlbum.backgroundLabels', { returnObjects: true });
    const BACKGROUND_PROMPTS = t('photoAlbum.backgroundPrompts', { returnObjects: true });
    const HAIR_STYLES = t('photoAlbum.hairStyles', { returnObjects: true });
    const SKIN_TONES = t('photoAlbum.skinTones', { returnObjects: true });

    const handleStartOver = () => {
        setGeneratedImages([]);
        setError(null);
        setIsLoading(false);
    };

    const handleGenerate = async () => {
        if (mode === 'fullModel' && !originalPhoto) {
            setError(t('photoAlbum.error.noPhoto'));
            return;
        }
        if (mode === 'faceAndOutfit' && (!faceImage || !outfitImage)) {
            setError(t('photoAlbum.error.noFaceOrOutfit'));
            return;
        }
        if (selectedPoses.length === 0) {
            setError(t('photoAlbum.error.noPose'));
            return;
        }
        if (!requireAivideoautoConfig()) {
            return;
        }

        setIsLoading(true);
        setError(null);
        setGeneratedImages([]);

        const posesToGenerate = POSES.filter(p => selectedPoses.includes(p));
        const total = posesToGenerate.length;
        setGenerationProgress({ progress: 0, total });

        const newImages: GeneratedAlbumImage[] = [];

        for (const [index, pose] of posesToGenerate.entries()) {
            setGenerationStatus(t('photoAlbum.generatingStatus', { progress: index + 1, total }));
            setGenerationProgress({ progress: index + 1, total });

            const imagesForApi: ImageFile[] = [];
            let imageRolesPrompt = '';
            if (mode === 'fullModel' && originalPhoto) {
                imagesForApi.push(originalPhoto);
                imageRolesPrompt = "**Image Role**: The provided image ('Source Image') contains the model, their outfit, and potentially a background. Your task is to extract the model and their clothing, then place them in a new scene.";
            } else if (mode === 'faceAndOutfit' && faceImage && outfitImage) {
                imagesForApi.push(faceImage, outfitImage);
                imageRolesPrompt = "**Image Roles**:\n- **Image 1 ('Face Reference')**: Provides the model's face, hair, and skin tone. This is the source of truth for identity.\n- **Image 2 ('Outfit Image')**: Provides the clothing to be worn by the model.";
            }

            const framingInstruction = cameraView !== 'default'
                ? t(`framingInstructions.${cameraView}`)
                : "Use default framing provided by the model.";

            const prompt = `
# INSTRUCTION: CREATE PHOTO ALBUM IMAGE

## 1. IMAGE ROLES
${imageRolesPrompt}

## 2. CRITICAL RULES (MUST FOLLOW)
- **Identity Preservation**: Flawlessly preserve the person’s facial features, hairstyle, and skin tone from the reference image. The resemblance must be perfect.
- **Outfit Application**:
    - If using 'Face Reference' and 'Outfit Image', dress the model in the complete outfit from the 'Outfit Image'. Preserve the outfit's design, color, texture, and fit with 100% accuracy.
    - If using a single 'Source Image', use the outfit the model is already wearing.
- **New Pose**: The model's new pose MUST be: "${pose}".
- **Model Details**:
    - **Hair Style**: ${HAIR_STYLES[hairStyle]}
    - **Skin Tone**: ${SKIN_TONES[skinTone]}
    - **Footwear**: ${t('photoAlbum.footwearInstructions')}

## 3. SCENE COMPOSITION
- **Background**: ${background !== 'none' ? `Place the model in the following environment: "${BACKGROUND_PROMPTS[background]}"` : "Keep the original background from the source image if possible, or create a simple, neutral studio background if one is not present."}
- **Camera & Framing**: The shot must adhere to this framing: "${framingInstruction}".
- **Frame/Border**: ${frame !== 'none' ? `Apply a '${FRAMES[frame]}' style frame or border around the final image.` : "Do not add any frame or border."}

## 4. ADDITIONAL NOTES
${additionalNotes ? `- Also incorporate this instruction: "${additionalNotes}"` : "- No additional notes."}

## 5. FINAL OUTPUT
Generate a single, hyper-realistic, 2K resolution, professional-grade fashion photograph that perfectly combines all the above elements.
            `.trim();

            try {
                const [result] = await editImage({ images: imagesForApi, prompt, numberOfImages: 1, aspectRatio }, imageEditModel, buildImageServiceConfig(setGenerationStatus));
                newImages.push({ ...result, pose });
                setGeneratedImages([...newImages]);
                addImage(result);
            } catch (err) {
                setError(t('photoAlbum.error.generationFailed', { pose, error: getErrorMessage(err, t) }));
                setIsLoading(false);
                return;
            }
        }

        setIsLoading(false);
    };

    if (generatedImages.length > 0 && !isLoading) {
        return (
            <div className="animate-fade-in">
                <div className="flex justify-between items-center mb-6">
                    <h2 className="text-2xl font-bold">{t('photoAlbum.outputTitle')}</h2>
                    <button onClick={handleStartOver} className="flex items-center gap-2 text-sm bg-zinc-700/80 text-zinc-200 font-semibold py-2 px-4 rounded-lg hover:bg-zinc-700 transition-colors duration-200">
                        <ReloadIcon className="w-4 h-4" />
                        <span>{t('photoAlbum.startOver')}</span>
                    </button>
                </div>
                {error && <div className="mb-4"><ErrorDisplay title={t('common.generationFailed')} message={error} onClear={() => setError(null)} /></div>}
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                    {generatedImages.map((image, index) => (
                        <div key={index}>
                            <HoverableImage image={image} altText={image.pose} />
                            <p className="text-xs text-zinc-400 mt-2 text-center truncate" title={image.pose}>{image.pose}</p>
                        </div>
                    ))}
                </div>
            </div>
        );
    }
    
    return (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
            {/* Left Column: Inputs */}
            <div className="flex flex-col gap-6">
                <div className="text-center">
                    <h2 className="text-2xl font-bold mb-1">{t('photoAlbum.title')}</h2>
                    <p className="text-zinc-400">{t('photoAlbum.description')}</p>
                </div>

                <div className="p-4 bg-zinc-900/50 rounded-lg border border-zinc-800">
                    <div className="flex justify-center gap-2 bg-zinc-800/50 p-1.5 rounded-lg mb-4">
                        <button onClick={() => setMode('fullModel')} className={`flex-1 px-4 py-1.5 text-sm font-semibold rounded-md transition-colors duration-200 ${mode === 'fullModel' ? 'bg-amber-600 text-white' : 'text-zinc-300 hover:bg-zinc-700/50'}`}>{t('photoAlbum.mode.fullModel')}</button>
                        <button onClick={() => setMode('faceAndOutfit')} className={`flex-1 px-4 py-1.5 text-sm font-semibold rounded-md transition-colors duration-200 ${mode === 'faceAndOutfit' ? 'bg-amber-600 text-white' : 'text-zinc-300 hover:bg-zinc-700/50'}`}>{t('photoAlbum.mode.faceAndOutfit')}</button>
                    </div>

                    {mode === 'fullModel' ? (
                        <ImageUploader image={originalPhoto} onImageUpload={(f) => {setOriginalPhoto(f); if(f) addImage(f);}} title={t('photoAlbum.originalPhoto')} id="pa-original"/>
                    ) : (
                        <div className="grid grid-cols-2 gap-4">
                            <ImageUploader image={faceImage} onImageUpload={(f) => {setFaceImage(f); if(f) addImage(f);}} title={t('photoAlbum.faceImage')} id="pa-face"/>
                            <ImageUploader image={outfitImage} onImageUpload={(f) => {setOutfitImage(f); if(f) addImage(f);}} title={t('photoAlbum.outfitImage')} id="pa-outfit"/>
                        </div>
                    )}
                </div>
                
                <div className="p-4 bg-zinc-900/50 rounded-lg border border-zinc-800 space-y-4">
                    <h3 className="text-lg font-semibold text-center text-amber-400">{t('photoAlbum.addons')}</h3>
                    
                    <ImageOptionsPanel
                      aspectRatio={aspectRatio} setAspectRatio={setAspectRatio}
                      resolution={resolution} setResolution={setResolution}
                      model={imageEditModel}
                    />
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-zinc-300 mb-2">{t('photoAlbum.chooseHair')}</label>
                            <select value={hairStyle} onChange={e => setHairStyle(e.target.value)} className="w-full bg-zinc-800 border border-zinc-700 rounded-lg p-2 text-sm">
                                {/* FIX: Cast value to string to resolve ReactNode type error. */}
                                {Object.entries(HAIR_STYLES).map(([key, value]) => <option key={key} value={key}>{String(value)}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-zinc-300 mb-2">Skin Tone</label>
                            <select value={skinTone} onChange={e => setSkinTone(e.target.value)} className="w-full bg-zinc-800 border border-zinc-700 rounded-lg p-2 text-sm">
                                {/* FIX: Cast value to string to resolve ReactNode type error. */}
                                {Object.entries(SKIN_TONES).map(([key, value]) => <option key={key} value={key}>{String(value)}</option>)}
                            </select>
                        </div>
                         <div>
                            <label className="block text-sm font-medium text-zinc-300 mb-2">{t('photoAlbum.chooseFrame')}</label>
                            <select value={frame} onChange={e => setFrame(e.target.value)} className="w-full bg-zinc-800 border border-zinc-700 rounded-lg p-2 text-sm">
                                {/* FIX: Cast value to string to resolve ReactNode type error. */}
                                {Object.entries(FRAMES).map(([key, value]) => <option key={key} value={key}>{String(value)}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-zinc-300 mb-2">{t('photoAlbum.chooseBackground')}</label>
                            <select value={background} onChange={e => setBackground(e.target.value)} className="w-full bg-zinc-800 border border-zinc-700 rounded-lg p-2 text-sm">
                                {/* FIX: Cast value to string to resolve ReactNode type error. */}
                                {Object.entries(BACKGROUND_LABELS).map(([key, value]) => <option key={key} value={key}>{String(value)}</option>)}
                            </select>
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-zinc-300 mb-2">{t('photoAlbum.additionalNotes')}</label>
                        <input type="text" value={additionalNotes} onChange={e => setAdditionalNotes(e.target.value)} placeholder={t('photoAlbum.additionalNotesPlaceholder')} className="w-full bg-zinc-800 border border-zinc-700 rounded-lg p-2 text-sm"/>
                    </div>
                </div>

                <div className="p-4 bg-zinc-900/50 rounded-lg border border-zinc-800">
                    <label className="block text-sm font-medium text-zinc-300 mb-2">{t('photoAlbum.choosePoses')}</label>
                    <div className="flex justify-between items-center mb-2">
                        <button onClick={() => setSelectedPoses(POSES)} className="text-xs text-amber-400 hover:underline">{t('photoAlbum.selectAll')}</button>
                        <button onClick={() => setSelectedPoses([])} className="text-xs text-zinc-400 hover:underline">{t('photoAlbum.clearSelection')}</button>
                    </div>
                    <div className="max-h-48 overflow-y-auto space-y-2 p-3 bg-zinc-800/50 rounded-lg border border-zinc-700">
                        {POSES.map(pose => (
                            <label key={pose} className="flex items-center gap-3 cursor-pointer">
                                <input type="checkbox" checked={selectedPoses.includes(pose)} onChange={() => setSelectedPoses(prev => prev.includes(pose) ? prev.filter(p => p !== pose) : [...prev, pose])} className="w-4 h-4 rounded text-amber-500 bg-zinc-700 border-zinc-600 focus:ring-amber-500"/>
                                <span className="text-sm text-zinc-300">{pose}</span>
                            </label>
                        ))}
                    </div>
                    <p className="text-xs text-zinc-400 mt-2">{selectedPoses.length} selected</p>
                </div>
                
                <div className="text-center">
                    <button onClick={handleGenerate} disabled={isLoading} className="bg-gradient-to-r from-amber-500 to-orange-600 text-white font-bold py-3 px-8 rounded-full hover:opacity-90 disabled:from-zinc-600 disabled:to-zinc-700 disabled:opacity-70 disabled:cursor-not-allowed shadow-lg shadow-amber-500/30 transition-all transform hover:scale-105">
                        {isLoading ? <Spinner /> : t('photoAlbum.generateButton', {count: selectedPoses.length})}
                    </button>
                </div>
            </div>
            {/* Right Column: Output */}
            <div className="sticky top-8">
                 <div className="relative w-full bg-zinc-900/50 rounded-2xl border border-zinc-800 flex items-center justify-center p-4 min-h-[50vh] lg:min-h-0 lg:aspect-[4/5]">
                    {isLoading ? (
                        <div className="flex flex-col items-center justify-center gap-4 text-center">
                            <Spinner />
                            <p className="text-zinc-400">{generationStatus}</p>
                            <ProgressBar progress={generationProgress.progress} total={generationProgress.total} />
                        </div>
                    ) : error ? (
                        <div className="p-4 w-full">
                            <ErrorDisplay title={t('common.generationFailed')} message={error} onClear={() => setError(null)} />
                        </div>
                    ) : (
                         <div className="text-center text-zinc-500 pointer-events-none">
                            <GalleryIcon className="mx-auto h-16 w-16" />
                            <h3 className="mt-4 text-lg font-semibold text-zinc-400">{t('common.outputPanelTitle')}</h3>
                        </div>
                    )}
                 </div>
            </div>
        </div>
    );
};
