
import React, { useState, useEffect, useRef } from 'react';
import { Feature, ImageFile } from '../types';
import { useLanguage } from '../contexts/LanguageContext';
import { analyzeScene } from '../services/gemini/text';
import { enforceVisualPreservation, fuseStyleForCompactPrompt, generateVideoSceneSuggestions, enhanceSceneDescription } from '../services/gemini/video';
import { generateVideo } from '../services/imageEditingService';
import { useApi } from '../contexts/ApiProviderContext';
import { getActiveApiKey } from '../services/apiClient';
import ImageUploader from './ImageUploader';
import Spinner, { ErrorDisplay } from './Spinner';
import { getErrorMessage } from '../utils/imageUtils';
import { MagicWandIcon, DownloadIcon } from './Icons';
import ResultPlaceholder from './shared/ResultPlaceholder';


type VideoStyle = 'cinematic' | 'lookbook' | 'advertising' | 'storytelling' | 'kids_animation' | 'documentary';
type CameraAngle = 'closeUp' | 'mediumShot' | 'fullBody';

const STYLE_PRESETS = {
    "cinematic": {
        "id": "cinematic_standard", "description": "Realistic, film-grade cinematography with balanced emotion and storytelling.",
        "camera": { "type": "ARRI Alexa LF or Sony Venice 2", "lens": "35mm or 50mm prime lens for balanced intimacy", "movement": "slow push-in or dolly tracking with stable Steadicam feel", "frame_rate": "24fps", "film_grain": "Kodak 5219 or soft digital film texture" },
        "lighting": { "type": "natural film lighting with subtle color contrast", "tone": "balanced warm-cool palette, cinematic realism", "FX": "soft rim lights, lens flares, diffused bloom highlights" },
        "emotion": { "expression": "natural, subtle human emotion", "gaze_behavior": "realistic, focused on narrative connection" },
        "audio": { "tempo": "75–90 BPM", "music": "cinematic orchestral or ambient synth score", "tone": "deep, emotive, narrative-driven" },
        "color_palette": "Cinematic teal-orange or balanced daylight"
    },
    "lookbook": {
        "id": "fashion_lookbook", "description": "Minimalist fashion presentation focusing on fabric, motion, and lighting. No overt storytelling.",
        "camera": { "type": "Sony FX6 / ARRI Alexa Mini", "lens": "50mm prime for portrait compression", "movement": "locked tripod, slow pan or tilt to emphasize outfit flow", "frame_rate": "30fps", "film_grain": "minimal, clean digital softness" },
        "lighting": { "type": "soft daylight or studio bounce light", "tone": "neutral whites and gentle contrast for fabric texture", "FX": "light refraction, fabric highlights" },
        "emotion": { "expression": "neutral, poised elegance", "gaze_behavior": "calm and confident, slightly aloof" },
        "audio": { "tempo": "60–75 BPM", "music": "ambient or slow electronic fashion beat", "tone": "chic, rhythmic, understated" },
        "color_palette": "Soft whites, beige, or clean monochrome"
    },
    "advertising": {
        "id": "brand_tvc", "description": "High-energy branded commercial emphasizing motion, product, and brand feel.",
        "camera": { "type": "RED Komodo 6K or Alexa 35", "lens": "24mm–35mm wide cinematic lens for dynamic perspective", "movement": "fast gimbal tracking, low angle hero shot, orbit for emphasis", "frame_rate": "24fps or 60fps for slow motion", "film_grain": "Clean digital, no grain" },
        "lighting": { "type": "high contrast stylized commercial lighting", "tone": "Vibrant, brand-color-centric palette", "FX": "Product highlights, clean lens flares, subtle bloom" },
        "emotion": { "expression": "Confident, aspirational, positive", "gaze_behavior": "Direct eye contact, energetic" },
        "audio": { "tempo": "110–128 BPM", "music": "Upbeat electronic or pop track", "tone": "Energetic, motivational, catchy" },
        "color_palette": "Brand-driven: deep blues, reds, metallics, and clean whites"
    },
    "storytelling": {
        "id": "narrative_film", "description": "Narrative flow, emotional rhythm, and visually descriptive actions to tell a story.",
        "camera": { "type": "ARRI Alexa Mini", "lens": "50mm or 85mm prime for character focus", "movement": "Slow character follow, gentle push-in on emotional beats", "frame_rate": "24fps", "film_grain": "Subtle, natural film grain (e.g., Kodak Vision3 250D)" },
        "lighting": { "type": "Motivated natural light (e.g., from a window or lamp)", "tone": "Warm and soft for intimacy, or cool and contrasted for drama", "FX": "Dust motes in light beams, soft focus transitions" },
        "emotion": { "expression": "Evolving and authentic; showing curiosity, tension, or resolution", "gaze_behavior": "Character-driven, looking at objects or other characters in the scene" },
        "audio": { "tempo": "70–85 BPM", "music": "Emotive piano or string score", "tone": "Narrative, reflective, heartfelt" },
        "color_palette": "Naturalistic with a slight mood-based color grade"
    },
    "kids_animation": {
        "id": "playful_animation", "description": "Colorful, playful, and high-energy style suitable for children's content.",
        "camera": { "type": "Virtual 3D camera", "lens": "Wide angle (18-24mm) for expressive space", "movement": "Bouncy, energetic, quick pans and zooms", "frame_rate": "30fps", "film_grain": "None" },
        "lighting": { "type": "Bright, high-key lighting", "tone": "Saturated and vibrant primary colors", "FX": "Sparkles, soft glows, simple lens flares" },
        "emotion": { "expression": "Exaggerated and clear: joy, surprise, silliness", "gaze_behavior": "Direct to camera, engaging" },
        "audio": { "tempo": "120-140 BPM", "music": "Upbeat, playful tunes with simple melodies", "tone": "Fun, happy, energetic" },
        "color_palette": "Bright primary and secondary colors"
    },
    "documentary": {
        "id": "observational_doc", "description": "Authentic, observational style, capturing a moment of reality.",
        "camera": { "type": "Canon C300 or Sony FX3", "lens": "24-70mm zoom for flexibility", "movement": "Handheld with subtle organic movement, or static tripod shot", "frame_rate": "24fps", "film_grain": "Natural, minimal digital noise" },
        "lighting": { "type": "Available, natural light", "tone": "Realistic and true to the environment", "FX": "None" },
        "emotion": { "expression": "Candid and genuine", "gaze_behavior": "Observational, not directed at camera" },
        "audio": { "tempo": "N/A", "music": "Minimal ambient score or diegetic sound only", "tone": "Grounded, observational, real" },
        "color_palette": "Natural and unstylized"
    }
};


export const VideoGenerator: React.FC = () => {
    const { t, language } = useLanguage();
    const { getModelsForFeature, aivideoautoAccessToken, aivideoautoVideoModels } = useApi();
    const { videoGenerateModel } = getModelsForFeature(Feature.Video);

    const [faceImage, setFaceImage] = useState<ImageFile | null>(null);
    const [gender, setGender] = useState<'male' | 'female'>('female');
    const [sceneDescription, setSceneDescription] = useState('');
    const [suggestions, setSuggestions] = useState<string[]>([]);
    const [isLoadingSuggestions, setIsLoadingSuggestions] = useState(false);

    const [duration, setDuration] = useState(8);
    const [style, setStyle] = useState<VideoStyle>('cinematic');
    const [cameraAngle, setCameraAngle] = useState<CameraAngle>('fullBody');
    const [technicalPrompt, setTechnicalPrompt] = useState('');

    const [isLoading, setIsLoading] = useState(false);
    const [loadingMessage, setLoadingMessage] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [generatedVideoUrl, setGeneratedVideoUrl] = useState<string | null>(null);
    const [playableVideoUrl, setPlayableVideoUrl] = useState<string | null>(null);
    const [isDownloading, setIsDownloading] = useState(false);
    const videoRef = useRef<HTMLVideoElement>(null);
    const loadingMessageIntervalRef = useRef<number | null>(null);

    const STYLES: { key: VideoStyle, label: string }[] = Object.keys(STYLE_PRESETS).map(key => ({
        key: key as VideoStyle,
        label: t(`videoAI.style${key.charAt(0).toUpperCase() + key.slice(1)}` as any),
    }));

    const CAMERA_ANGLES: { key: CameraAngle, label: string }[] = [
        { key: 'closeUp', label: t('videoAI.cameraAngle.options.closeUp') },
        { key: 'mediumShot', label: t('videoAI.cameraAngle.options.mediumShot') },
        { key: 'fullBody', label: t('videoAI.cameraAngle.options.fullBody') },
    ];

    const handleSuggestScenes = async () => {
        if (!faceImage) {
            setError(t('videoAI.suggestionInputError'));
            return;
        }
        setIsLoadingSuggestions(true);
        setError(null);
        setSuggestions([]);
        try {
            const results = await generateVideoSceneSuggestions(
                faceImage,
                gender,
                sceneDescription,
                t('videoAI.apiVideoSuggestTemplate', { returnObjects: true })
            );
            setSuggestions(results);
        } catch (err) {
            setError(getErrorMessage(err, t));
        } finally {
            setIsLoadingSuggestions(false);
        }
    };

    const handleEnhancePrompt = async () => {
        if (!sceneDescription.trim()) return;
        setIsLoading(true);
        setLoadingMessage(t('videoAI.status.generatingPrompt'));
        try {
            const baseDescription = await analyzeScene(faceImage!);
            const enhanced = await enhanceSceneDescription(baseDescription);
            setSceneDescription(enhanced);
        } catch (err) {
            setError(getErrorMessage(err, t));
        } finally {
            setIsLoading(false);
        }
    };

    const handleGenerateVideo = async () => {
        if (!faceImage || !sceneDescription) {
            setError(t('videoAI.inputError'));
            return;
        }
        if (videoGenerateModel.startsWith('aivideoauto--') && !aivideoautoAccessToken) {
            setError(t('error.api.aivideoautoAuth'));
            return;
        }
        setIsLoading(true);
        setError(null);
        setGeneratedVideoUrl(null);
        setPlayableVideoUrl(null);

        // Cycle through loading messages
        const messages = t('videoAI.loadingMessages', { returnObjects: true });
        let messageIndex = 0;
        setLoadingMessage(messages[messageIndex]);
        loadingMessageIntervalRef.current = window.setInterval(() => {
            messageIndex = (messageIndex + 1) % messages.length;
            setLoadingMessage(messages[messageIndex]);
        }, 5000);

        try {
            const enforcedPrompt = await enforceVisualPreservation(sceneDescription, duration, cameraAngle);
            const downloadLink = await generateVideo(
                enforcedPrompt,
                videoGenerateModel,
                { aivideoautoAccessToken, onStatusUpdate: setLoadingMessage, aivideoautoVideoModels },
                faceImage
            );

            setGeneratedVideoUrl(downloadLink);

            // For Gemini links, append API key for direct use
            let finalUrl = downloadLink;
            if (downloadLink.includes('generativelanguage.googleapis.com')) {
                const apiKey = getActiveApiKey();
                if (apiKey) {
                    finalUrl = `${downloadLink}&key=${apiKey}`;
                }
            }

            setLoadingMessage(t('videoAI.status.preparingPlayback'));

            // Fetch the video blob to create a playable URL
            const response = await fetch(finalUrl);
            if (!response.ok) throw new Error(`Failed to fetch video: ${response.statusText}`);
            const blob = await response.blob();
            const objectURL = URL.createObjectURL(blob);
            setPlayableVideoUrl(objectURL);

        } catch (err) {
            setError(getErrorMessage(err, t));
        } finally {
            setIsLoading(false);
            if (loadingMessageIntervalRef.current) {
                clearInterval(loadingMessageIntervalRef.current);
            }
        }
    };

    useEffect(() => {
        return () => {
            if (loadingMessageIntervalRef.current) {
                clearInterval(loadingMessageIntervalRef.current);
            }
        };
    }, []);

    const handleDownload = async () => {
        if (!playableVideoUrl) return;
        setIsDownloading(true);
        try {
            const a = document.createElement('a');
            a.href = playableVideoUrl;
            a.download = `generated-video-${Date.now()}.mp4`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
        } catch (err) {
            setError(getErrorMessage(err, t));
        } finally {
            setIsDownloading(false);
        }
    }

    return (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6 lg:gap-8 items-start overflow-x-hidden pb-12">
            <div className="flex flex-col gap-6">
                <div className="text-center">
                    <h2 className="text-xl md:text-2xl font-bold mb-1">{t('videoAI.title')}</h2>
                    <p className="text-zinc-400">{t('videoAI.description')}</p>
                </div>

                <div className="p-4 bg-zinc-900/50 rounded-lg border border-zinc-800 space-y-4">
                    <h3 className="text-base md:text-lg font-semibold text-center text-amber-400">{t('videoAI.step1')}</h3>
                    <div className="grid grid-cols-2 gap-4 items-center">
                        <ImageUploader image={faceImage} onImageUpload={setFaceImage} title={t('videoAI.faceImageTitle')} id="video-face-upload" />
                        <div>
                            <label className="block text-sm font-medium text-zinc-300 mb-2">{t('videoAI.gender')}</label>
                            <div className="flex gap-2">
                                <button onClick={() => setGender('female')} className={`flex-1 py-2 text-sm rounded-md ${gender === 'female' ? 'bg-amber-600 text-white' : 'bg-zinc-700'}`}>{t('videoAI.female')}</button>
                                <button onClick={() => setGender('male')} className={`flex-1 py-2 text-sm rounded-md ${gender === 'male' ? 'bg-amber-600 text-white' : 'bg-zinc-700'}`}>{t('videoAI.male')}</button>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="p-4 bg-zinc-900/50 rounded-lg border border-zinc-800 space-y-4">
                    <h3 className="text-base md:text-lg font-semibold text-center text-amber-400">{t('videoAI.step2')}</h3>
                    <div>
                        <label htmlFor="scene-desc" className="block text-sm font-medium text-zinc-300 mb-2">{t('videoAI.sceneDescriptionLabel')}</label>
                        <textarea id="scene-desc" value={sceneDescription} onChange={e => setSceneDescription(e.target.value)} rows={5} placeholder={t('videoAI.sceneDescriptionPlaceholder')} className="w-full bg-zinc-800/50 border border-zinc-700 rounded-lg p-2 text-zinc-200" />
                    </div>
                    <div className="flex gap-2">
                        <button onClick={handleEnhancePrompt} disabled={!faceImage || isLoading} className="flex-1 flex items-center justify-center gap-2 bg-zinc-700/80 text-zinc-200 font-semibold py-2 rounded-lg text-sm disabled:opacity-50"><MagicWandIcon className="w-4 h-4" /> {t('videoAI.enhancePrompt')}</button>
                        <button onClick={handleSuggestScenes} disabled={!faceImage || isLoadingSuggestions} className="flex-1 bg-zinc-700/80 text-zinc-200 font-semibold py-2 rounded-lg text-sm disabled:opacity-50">{isLoadingSuggestions ? <Spinner /> : t('videoAI.suggestScenes')}</button>
                    </div>
                    {suggestions.length > 0 && (
                        <div className="space-y-2 pt-2 border-t border-zinc-700">
                            <h4 className="text-sm font-semibold text-zinc-300">{t('videoAI.suggestionsTitle')}</h4>
                            {suggestions.map((s, i) => (
                                <div key={i} className="flex items-center gap-2 text-xs bg-zinc-800/70 p-2 rounded-md">
                                    <p className="flex-grow text-zinc-400">{s}</p>
                                    <button onClick={() => setSceneDescription(s)} className="text-amber-400 hover:text-amber-300 font-bold flex-shrink-0">{t('videoAI.useSuggestion')}</button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                <div className="p-4 bg-zinc-900/50 rounded-lg border border-zinc-800 space-y-4">
                    <div className="grid grid-cols-3 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-zinc-300 mb-2">{t('videoAI.durationLabel')}</label>
                            <input type="number" value={duration} onChange={e => setDuration(Number(e.target.value))} min="3" max="15" className="w-full bg-zinc-800/50 border border-zinc-700 rounded-lg p-2 text-zinc-200" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-zinc-300 mb-2">{t('videoAI.style')}</label>
                            <select value={style} onChange={e => setStyle(e.target.value as VideoStyle)} className="w-full bg-zinc-800/50 border border-zinc-700 rounded-lg p-2 text-zinc-200">
                                {STYLES.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-zinc-300 mb-2">{t('videoAI.cameraAngle.label')}</label>
                            <select value={cameraAngle} onChange={e => setCameraAngle(e.target.value as CameraAngle)} className="w-full bg-zinc-800/50 border border-zinc-700 rounded-lg p-2 text-zinc-200">
                                {CAMERA_ANGLES.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
                            </select>
                        </div>
                    </div>
                </div>

                <div className="text-center">
                    <button onClick={handleGenerateVideo} disabled={isLoading || !faceImage || !sceneDescription} className="bg-gradient-to-r from-amber-500 to-orange-600 text-white font-bold py-3 px-8 rounded-full disabled:opacity-50">
                        {isLoading ? <Spinner /> : t('videoAI.generateButton')}
                    </button>
                </div>
            </div>

            <div className="lg:sticky lg:top-8">
                <div className="relative w-full min-h-[400px] lg:h-auto lg:aspect-[9/16] bg-zinc-900/50 rounded-2xl border border-zinc-800 flex items-center justify-center p-2 sm:p-4">
                    {isLoading ? (
                        <div className="text-center"><Spinner /><p className="mt-4 text-zinc-400">{loadingMessage}</p></div>
                    ) : error ? (
                        <ErrorDisplay title={t('common.generationFailed')} message={error} onClear={() => setError(null)} />
                    ) : playableVideoUrl ? (
                        <div className="w-full h-full flex flex-col gap-2">
                            <div className="flex-grow rounded-lg overflow-hidden">
                                <video ref={videoRef} src={playableVideoUrl} controls autoPlay loop muted className="w-full h-full object-cover" />
                            </div>
                            <div className="flex-shrink-0 flex items-center gap-2">
                                <button
                                    onClick={() => alert(sceneDescription)}
                                    className="flex-1 bg-orange-500 text-white font-bold py-2.5 px-4 rounded-lg hover:bg-orange-600 transition-colors text-sm uppercase"
                                >
                                    {t('videoAI.viewPrompt')}
                                </button>
                                <button
                                    onClick={handleDownload}
                                    disabled={isDownloading}
                                    className="flex-1 bg-blue-500 text-white font-bold py-2.5 px-4 rounded-lg hover:bg-blue-600 transition-colors text-sm uppercase disabled:bg-zinc-600 disabled:cursor-not-allowed flex items-center justify-center"
                                >
                                    {isDownloading ? <Spinner /> : t('videoAI.downloadVideo')}
                                </button>
                            </div>
                        </div>
                    ) : (
                        <ResultPlaceholder description={t('videoAI.outputPanelDescription')} />
                    )}
                </div>
            </div>
        </div>
    );
};
