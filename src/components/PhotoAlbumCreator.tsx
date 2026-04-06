import React, { useState, useEffect } from 'react';
import { ImageFile, AspectRatio, ImageResolution, DEFAULT_IMAGE_RESOLUTION } from '../types';
import { useLanguage } from '../contexts/LanguageContext';
import { useApi } from '../contexts/ApiProviderContext';
import { editImage } from '../services/imageEditingService';
import ImageUploader from './ImageUploader';
import Spinner, { ErrorDisplay, ProgressBar } from './Spinner';
import HoverableImage from './HoverableImage';
import { getErrorMessage } from '../utils/imageUtils';
import { ReloadIcon } from './Icons';
import ImageOptionsPanel from './ImageOptionsPanel';
import ResultPlaceholder from './shared/ResultPlaceholder';
import { PHOTO_ALBUM_POSES, PHOTO_ALBUM_BACKGROUNDS } from '../utils/photoAlbumConfig';

type GenerationMode = 'fullModel' | 'faceAndOutfit';

interface GeneratedAlbumImage extends ImageFile {
    pose: string;
}

interface PhotoAlbumCreatorProps {
    transferredImage?: ImageFile;
    onTransferConsumed?: () => void;
}

export const PhotoAlbumCreator: React.FC<PhotoAlbumCreatorProps> = ({ transferredImage, onTransferConsumed }) => {
    const { t } = useLanguage();
    const { imageEditModel } = useApi();
    const buildImageServiceConfig = (onStatusUpdate: (message: string) => void) => ({
        onStatusUpdate,
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
    const [regeneratingStates, setRegeneratingStates] = useState<Record<string, boolean>>({});
    const [error, setError] = useState<string | null>(null);
    const [generationStatus, setGenerationStatus] = useState('');
    const [generationProgress, setGenerationProgress] = useState({ progress: 0, total: 0 });

    const POSE_LABELS: Record<string, string> = t('photoAlbum.poseLabels', { returnObjects: true });
    const POSES: string[] = PHOTO_ALBUM_POSES.map(p => p.id);
    const FRAMES = t('photoAlbum.frames', { returnObjects: true });
    const BACKGROUND_LABELS: Record<string, string> = t('photoAlbum.backgroundLabels', { returnObjects: true });
    const BACKGROUND_PROMPTS = PHOTO_ALBUM_BACKGROUNDS.reduce((acc, curr) => {
        acc[curr.id] = curr.prompt;
        return acc;
    }, {} as Record<string, string>);
    const HAIR_STYLES = t('photoAlbum.hairStyles', { returnObjects: true });
    const SKIN_TONES = t('photoAlbum.skinTones', { returnObjects: true });

    const handleStartOver = () => {
        setGeneratedImages([]);
        setError(null);
        setIsLoading(false);
    };

    // Consume transferred outfit image from another feature
    useEffect(() => {
        if (transferredImage) {
            setOutfitImage(transferredImage);
            setMode('faceAndOutfit');
            onTransferConsumed?.();
        }
    }, [transferredImage]);

    const generateImageForPose = async (pose: string) => {
        const imagesForApi: ImageFile[] = [];
        let imageRolesPrompt = '';
        if (mode === 'fullModel' && originalPhoto) {
            imagesForApi.push(originalPhoto);
            imageRolesPrompt = "**Image Role**: The provided image ('Source Image') contains the model, their outfit, footwear, and potentially a background. Your task is to extract the model, their clothing, and footwear, then place them in a new scene.";
        } else if (mode === 'faceAndOutfit' && faceImage && outfitImage) {
            imagesForApi.push(faceImage, outfitImage);
            imageRolesPrompt = "**Image Roles**:\n- **Image 1 ('Face Reference')**: Provides the model's face, hair, and skin tone. This is the source of truth for identity.\n- **Image 2 ('Outfit Image')**: Provides the clothing and footwear to be worn by the model.";
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
    - If using 'Face Reference' and 'Outfit Image', dress the model in the complete outfit and footwear from the 'Outfit Image'. Preserve the outfit and footwear design, color, texture, and fit with 100% accuracy.
    - If using a single 'Source Image', use the outfit and footwear the model is already wearing. Ensure the footwear matches the original image exactly.
- **New Pose**: The model's new pose MUST be: "${PHOTO_ALBUM_POSES.find(p => p.id === pose)?.prompt || pose}".
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

        const [result] = await editImage({ images: imagesForApi, prompt, numberOfImages: 1, aspectRatio, resolution }, imageEditModel, buildImageServiceConfig(setGenerationStatus));

        return { ...result, pose };
    };

    const getModeInputError = () => {
        if (mode === 'fullModel' && !originalPhoto) {
            return t('photoAlbum.error.noPhoto');
        }
        if (mode === 'faceAndOutfit' && (!faceImage || !outfitImage)) {
            return t('photoAlbum.error.noFaceOrOutfit');
        }

        return null;
    };

    const handleGenerate = async () => {
        const inputError = getModeInputError();
        if (inputError) {
            setError(inputError);
            return;
        }
        if (selectedPoses.length === 0) {
            setError(t('photoAlbum.error.noPose'));
            return;
        }
        setIsLoading(true);
        setError(null);
        setGeneratedImages([]);
        setRegeneratingStates({});

        const posesToGenerate = POSES.filter(p => selectedPoses.includes(p));
        const total = posesToGenerate.length;
        setGenerationProgress({ progress: 0, total });

        const newImages: GeneratedAlbumImage[] = [];

        for (const [index, pose] of posesToGenerate.entries()) {
            setGenerationStatus(t('photoAlbum.generatingStatus', { progress: index + 1, total }));
            setGenerationProgress({ progress: index + 1, total });

            try {
                const result = await generateImageForPose(pose);
                newImages.push(result);
                setGeneratedImages([...newImages]);
            } catch (err) {
                setError(t('photoAlbum.error.generationFailed', { pose, error: getErrorMessage(err, t) }));
                setIsLoading(false);
                return;
            }
        }

        setIsLoading(false);
    };

    const handleRegenerateSingle = async (pose: string) => {
        const inputError = getModeInputError();
        if (inputError) {
            setError(inputError);
            return;
        }

        setRegeneratingStates(prev => ({ ...prev, [pose]: true }));
        setError(null);

        try {
            const regeneratedImage = await generateImageForPose(pose);
            setGeneratedImages(prev => prev.map(image => image.pose === pose ? regeneratedImage : image));
        } catch (err) {
            setError(t('photoAlbum.error.generationFailed', { pose, error: getErrorMessage(err, t) }));
        } finally {
            setRegeneratingStates(prev => ({ ...prev, [pose]: false }));
        }
    };

    return (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6 lg:gap-8 items-start overflow-x-hidden pb-12">
            {/* Left Column: Inputs */}
            <div className="flex flex-col gap-6">
                <div className="text-center">
                    <h2 className="text-xl md:text-2xl font-bold mb-1">{t('photoAlbum.title')}</h2>
                    <p className="text-zinc-400">{t('photoAlbum.description')}</p>
                </div>

                <div className="p-4 bg-zinc-900/50 rounded-lg border border-zinc-800">
                    <div className="flex justify-center gap-2 bg-zinc-800/50 p-1.5 rounded-lg mb-4">
                        <button onClick={() => setMode('fullModel')} className={`flex-1 px-4 py-1.5 text-sm font-semibold rounded-md transition-colors duration-200 ${mode === 'fullModel' ? 'bg-amber-600 text-white' : 'text-zinc-300 hover:bg-zinc-700/50'}`}>{t('photoAlbum.mode.fullModel')}</button>
                        <button onClick={() => setMode('faceAndOutfit')} className={`flex-1 px-4 py-1.5 text-sm font-semibold rounded-md transition-colors duration-200 ${mode === 'faceAndOutfit' ? 'bg-amber-600 text-white' : 'text-zinc-300 hover:bg-zinc-700/50'}`}>{t('photoAlbum.mode.faceAndOutfit')}</button>
                    </div>

                    {mode === 'fullModel' ? (
                        <div className="max-w-[50%] mx-auto">
                            <ImageUploader image={originalPhoto} onImageUpload={setOriginalPhoto} title={t('photoAlbum.originalPhoto')} id="pa-original" />
                        </div>
                    ) : (
                        <div className="grid grid-cols-2 gap-4">
                            <ImageUploader image={faceImage} onImageUpload={setFaceImage} title={t('photoAlbum.faceImage')} id="pa-face" />
                            <ImageUploader image={outfitImage} onImageUpload={setOutfitImage} title={t('photoAlbum.outfitImage')} id="pa-outfit" />
                        </div>
                    )}
                </div>

                <div className="p-4 bg-zinc-900/50 rounded-lg border border-zinc-800 space-y-4">
                    <h3 className="text-base md:text-lg font-semibold text-center text-amber-400">{t('photoAlbum.addons')}</h3>

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
                        <input type="text" value={additionalNotes} onChange={e => setAdditionalNotes(e.target.value)} placeholder={t('photoAlbum.additionalNotesPlaceholder')} className="w-full bg-zinc-800 border border-zinc-700 rounded-lg p-2 text-sm" />
                    </div>
                </div>

                <div className="p-4 bg-zinc-900/50 rounded-lg border border-zinc-800">
                    <label className="block text-sm font-medium text-zinc-300 mb-2">{t('photoAlbum.choosePoses')}</label>
                    <div className="flex justify-between items-center mb-2">
                        <button onClick={() => setSelectedPoses(POSES)} className="text-xs text-amber-400 hover:underline">{t('photoAlbum.selectAll')}</button>
                        <button onClick={() => setSelectedPoses([])} className="text-xs text-zinc-400 hover:underline">{t('photoAlbum.clearSelection')}</button>
                    </div>
                    <div className="max-h-48 overflow-y-auto space-y-2 p-3 bg-zinc-800/50 rounded-lg border border-zinc-700">
                        {POSES.map(poseId => (
                            <label key={poseId} className="flex items-center gap-3 cursor-pointer">
                                <input type="checkbox" checked={selectedPoses.includes(poseId)} onChange={() => setSelectedPoses(prev => prev.includes(poseId) ? prev.filter(p => p !== poseId) : [...prev, poseId])} className="w-4 h-4 rounded text-amber-500 bg-zinc-700 border-zinc-600 focus:ring-amber-500" />
                                <span className="text-sm text-zinc-300">{POSE_LABELS[poseId] || poseId}</span>
                            </label>
                        ))}
                    </div>
                    <p className="text-xs text-zinc-400 mt-2">{selectedPoses.length} selected</p>
                </div>

                <div className="text-center">
                    <button onClick={handleGenerate} disabled={isLoading} className="bg-gradient-to-r from-amber-500 to-orange-600 text-white font-bold py-3 px-8 rounded-full hover:opacity-90 disabled:from-zinc-600 disabled:to-zinc-700 disabled:opacity-70 disabled:cursor-not-allowed shadow-lg shadow-amber-500/30 transition-all transform hover:scale-105">
                        {isLoading ? <Spinner /> : t('photoAlbum.generateButton', { count: selectedPoses.length })}
                    </button>
                </div>
            </div>
            {/* Right Column: Output */}
            <div>
                <div className={`relative w-full min-h-[50vh] lg:min-h-0 lg:aspect-[4/5] bg-zinc-900/50 rounded-2xl border border-zinc-800 p-4 flex flex-col ${generatedImages.length === 0 && !isLoading && !error ? 'items-center justify-center' : ''}`}>
                    {/* Header with Start Over button */}
                    {generatedImages.length > 0 && (
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-base font-semibold text-zinc-300">{t('photoAlbum.outputTitle')}</h3>
                            <button onClick={handleStartOver} className="flex items-center gap-1.5 text-xs bg-zinc-700/80 text-zinc-200 font-medium py-1.5 px-3 rounded-lg hover:bg-zinc-700 transition-colors">
                                <ReloadIcon className="w-3.5 h-3.5" />
                                <span>{t('photoAlbum.startOver')}</span>
                            </button>
                        </div>
                    )}

                    {/* Loading state */}
                    {isLoading && (
                        <div className="flex flex-col items-center justify-center gap-4 text-center py-8">
                            <Spinner />
                            <p className="text-zinc-400 text-sm">{generationStatus}</p>
                            <ProgressBar progress={generationProgress.progress} total={generationProgress.total} />
                        </div>
                    )}

                    {/* Error state */}
                    {error && !isLoading && (
                        <div className="mb-4">
                            <ErrorDisplay title={t('common.generationFailed')} message={error} onClear={() => setError(null)} />
                        </div>
                    )}

                    {/* Generated images grid - 2 columns */}
                    {generatedImages.length > 0 && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                            {generatedImages.map((image, index) => (
                                <div key={index}>
                                    <HoverableImage
                                        image={image}
                                        altText={POSE_LABELS[image.pose] || image.pose}
                                        onRegenerate={() => handleRegenerateSingle(image.pose)}
                                        isGenerating={isLoading || regeneratingStates[image.pose]}
                                    />
                                    <p className="text-xs text-zinc-400 mt-1.5 text-center truncate" title={POSE_LABELS[image.pose] || image.pose}>{POSE_LABELS[image.pose] || image.pose}</p>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Placeholder when no images */}
                    {generatedImages.length === 0 && !isLoading && !error && (
                        <ResultPlaceholder description={t('photoAlbum.outputPanelDescription')} />
                    )}
                </div>
            </div>
        </div>
    );
};
