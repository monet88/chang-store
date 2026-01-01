import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Feature, ImageFile, AspectRatio, ImageResolution, DEFAULT_IMAGE_RESOLUTION } from '../types';
import { useLanguage } from '../contexts/LanguageContext';
import { useImageGallery } from '../contexts/ImageGalleryContext';
import { useApi } from '../contexts/ApiProviderContext';
import { editImage } from '../services/imageEditingService';
import { getErrorMessage } from '../utils/imageUtils';
import ImageUploader from './ImageUploader';
import Spinner, { ErrorDisplay } from './Spinner';
import HoverableImage from './HoverableImage';
import { BrushIcon, EraserIcon, MarqueeIcon, VisibleIcon, HiddenIcon } from './Icons';
import ImageOptionsPanel from './ImageOptionsPanel';

type Tool = 'rectangle' | 'brush' | 'eraser';

const Inpainting: React.FC = () => {
    const { t } = useLanguage();
    const { addImage } = useImageGallery();
    const { getModelsForFeature, aivideoautoAccessToken, aivideoautoImageModels } = useApi();
    const { imageEditModel } = getModelsForFeature(Feature.Inpainting);
    const buildImageServiceConfig = (onStatusUpdate: (message: string) => void) => ({
        onStatusUpdate,
        aivideoautoAccessToken,
        aivideoautoImageModels,
    });

    const [image, setImage] = useState<ImageFile | null>(null);
    const [prompt, setPrompt] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [resultImage, setResultImage] = useState<ImageFile | null>(null);
    
    const [activeTool, setActiveTool] = useState<Tool>('rectangle');
    const [brushSize, setBrushSize] = useState(40);
    const [brushOpacity, setBrushOpacity] = useState(1);
    const [isDrawing, setIsDrawing] = useState(false);
    const [lastMask, setLastMask] = useState<string | null>(null);
    const [selectionRect, setSelectionRect] = useState<{ x: number, y: number, width: number, height: number } | null>(null);

    const [maskColor, setMaskColor] = useState('#FF0096'); // A vibrant pink
    const [maskPreviewOpacity, setMaskPreviewOpacity] = useState(0.5);
    const [isMaskVisible, setIsMaskVisible] = useState(true);
    const [aspectRatio, setAspectRatio] = useState<AspectRatio>('Default');
    const [resolution, setResolution] = useState<ImageResolution>(DEFAULT_IMAGE_RESOLUTION);

    const imageCanvasRef = useRef<HTMLCanvasElement>(null);
    const drawingCanvasRef = useRef<HTMLCanvasElement>(null);
    const cursorCanvasRef = useRef<HTMLCanvasElement>(null);
    const maskCanvasRef = useRef<HTMLCanvasElement>(null); // Offscreen
    const imageRef = useRef<HTMLImageElement>(new Image());
    const lastPointRef = useRef<{ x: number, y: number } | null>(null);

    const getCanvasMetrics = useCallback(() => {
        const container = imageCanvasRef.current?.parentElement;
        const img = imageRef.current;
        if (!container || !img.src || !img.naturalWidth) return null;

        const { naturalWidth: iw, naturalHeight: ih } = img;
        const { clientWidth: cw, clientHeight: ch } = container;
        if (iw === 0 || ih === 0) return null;

        const scale = Math.min(cw / iw, ch / ih);
        const dw = iw * scale;
        const dh = ih * scale;
        const dx = (cw - dw) / 2;
        const dy = (ch - dh) / 2;
        return { iw, ih, cw, ch, scale, dw, dh, dx, dy };
    }, []);

    const redrawOverlays = useCallback(() => {
        const drawingCanvas = drawingCanvasRef.current;
        const maskCanvas = maskCanvasRef.current;
        const drawingCtx = drawingCanvas?.getContext('2d');
        if (!drawingCtx || !drawingCanvas) return;
        
        drawingCtx.clearRect(0, 0, drawingCanvas.width, drawingCanvas.height);

        if (!isMaskVisible) return;

        // Draw brush mask overlay
        if (maskCanvas) {
            const isMaskEmpty = !maskCanvas.getContext('2d')?.getImageData(0, 0, maskCanvas.width, maskCanvas.height).data.some(channel => channel !== 0);
            if (!isMaskEmpty) {
                const tempCanvas = document.createElement('canvas');
                tempCanvas.width = maskCanvas.width;
                tempCanvas.height = maskCanvas.height;
                const tempCtx = tempCanvas.getContext('2d');
                if (tempCtx) {
                    tempCtx.drawImage(maskCanvas, 0, 0);
                    tempCtx.globalCompositeOperation = 'source-in';
                    tempCtx.fillStyle = maskColor;
                    tempCtx.fillRect(0, 0, tempCanvas.width, tempCanvas.height);
                    
                    const metrics = getCanvasMetrics();
                    if (metrics) {
                        drawingCtx.globalAlpha = maskPreviewOpacity;
                        drawingCtx.drawImage(tempCanvas, metrics.dx, metrics.dy, metrics.dw, metrics.dh);
                        drawingCtx.globalAlpha = 1.0;
                    }
                }
            }
        }
        
        // Draw rectangle selection overlay
        if (selectionRect) {
            drawingCtx.strokeStyle = maskColor;
            drawingCtx.lineWidth = 2;
            drawingCtx.setLineDash([6, 4]);
            drawingCtx.strokeRect(selectionRect.x, selectionRect.y, selectionRect.width, selectionRect.height);
            
            const r = parseInt(maskColor.slice(1, 3), 16);
            const g = parseInt(maskColor.slice(3, 5), 16);
            const b = parseInt(maskColor.slice(5, 7), 16);
            drawingCtx.fillStyle = `rgba(${r}, ${g}, ${b}, ${maskPreviewOpacity * 0.4})`;
            
            drawingCtx.fillRect(selectionRect.x, selectionRect.y, selectionRect.width, selectionRect.height);
            drawingCtx.setLineDash([]);
        }
    }, [getCanvasMetrics, selectionRect, isMaskVisible, maskColor, maskPreviewOpacity]);

    useEffect(() => {
        redrawOverlays();
    }, [isMaskVisible, maskColor, maskPreviewOpacity, redrawOverlays]);

    const setupCanvases = useCallback(() => {
        const metrics = getCanvasMetrics();
        if (!metrics) return;
        const { iw, ih, cw, ch, dx, dy, dw, dh } = metrics;
        
        [imageCanvasRef, drawingCanvasRef, cursorCanvasRef].forEach(ref => {
            if (ref.current) {
                ref.current.width = cw;
                ref.current.height = ch;
            }
        });

        if (maskCanvasRef.current && (maskCanvasRef.current.width !== iw || maskCanvasRef.current.height !== ih)) {
            maskCanvasRef.current.width = iw;
            maskCanvasRef.current.height = ih;
        }
        
        const imageCtx = imageCanvasRef.current?.getContext('2d');
        if (imageCtx) {
            imageCtx.clearRect(0, 0, cw, ch);
            imageCtx.drawImage(imageRef.current, dx, dy, dw, dh);
        }
        
        redrawOverlays();
    }, [getCanvasMetrics, redrawOverlays]);

    useEffect(() => {
        imageRef.current.crossOrigin = 'anonymous';
        if (image) {
            imageRef.current.src = `data:${image.mimeType};base64,${image.base64}`;
            imageRef.current.onload = setupCanvases;
        } else {
            // Clear canvases if image is removed
            [imageCanvasRef, drawingCanvasRef, maskCanvasRef, cursorCanvasRef].forEach(ref => {
                const canvas = ref.current;
                const ctx = canvas?.getContext('2d');
                if (ctx && canvas) {
                    ctx.clearRect(0, 0, canvas.width, canvas.height);
                }
            });
        }
        const handleResize = () => { if (image) setupCanvases(); };
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, [image, setupCanvases]);

    const getPointOnCanvas = (e: React.MouseEvent<HTMLCanvasElement>): { canvasX: number; canvasY: number } | null => {
        const canvas = drawingCanvasRef.current;
        if (!canvas) return null;
        const rect = canvas.getBoundingClientRect();
        return {
            canvasX: e.clientX - rect.left,
            canvasY: e.clientY - rect.top,
        };
    };

    const handleClearMask = useCallback(() => {
        const maskCanvas = maskCanvasRef.current;
        const maskCtx = maskCanvas?.getContext('2d');
        if (maskCanvas && maskCtx) {
            maskCtx.clearRect(0, 0, maskCanvas.width, maskCanvas.height);
        }
        setSelectionRect(null);
        redrawOverlays();
        setLastMask(null);
        setResultImage(null);
    }, [redrawOverlays]);

    const handleToolChange = (tool: Tool) => {
        setActiveTool(tool);
        handleClearMask();
    };

    const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
        const pos = getPointOnCanvas(e);
        if (!pos) return;
        
        setIsDrawing(true);
        lastPointRef.current = { x: pos.canvasX, y: pos.canvasY };
        setResultImage(null);
        
        if (activeTool === 'rectangle') {
            handleClearMask();
            setSelectionRect({ x: pos.canvasX, y: pos.canvasY, width: 0, height: 0 });
        } else {
            setSelectionRect(null);
        }
    };

    const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
        const pos = getPointOnCanvas(e);
        const cursorCtx = cursorCanvasRef.current?.getContext('2d');
        if (cursorCtx && cursorCanvasRef.current) {
            cursorCtx.clearRect(0, 0, cursorCanvasRef.current.width, cursorCanvasRef.current.height);
            if ((activeTool === 'brush' || activeTool === 'eraser') && pos) {
                cursorCtx.beginPath();
                cursorCtx.arc(pos.canvasX, pos.canvasY, brushSize / 2, 0, 2 * Math.PI);
                cursorCtx.strokeStyle = 'white';
                cursorCtx.lineWidth = 1.5;
                cursorCtx.stroke();
                cursorCtx.strokeStyle = 'black';
                cursorCtx.lineWidth = 0.5;
                cursorCtx.stroke();
            }
        }
        
        if (!isDrawing) return;
        if (!pos || !lastPointRef.current) return;
        
        if (activeTool === 'rectangle') {
            const startX = lastPointRef.current.x;
            const startY = lastPointRef.current.y;
            const width = pos.canvasX - startX;
            const height = pos.canvasY - startY;
            setSelectionRect({
                x: width > 0 ? startX : pos.canvasX,
                y: height > 0 ? startY : pos.canvasY,
                width: Math.abs(width),
                height: Math.abs(height),
            });
            redrawOverlays();
        } else { // brush or eraser
            const metrics = getCanvasMetrics();
            const maskCtx = maskCanvasRef.current?.getContext('2d');
            if (!metrics || !maskCtx) return;

            const start = {
                x: (lastPointRef.current.x - metrics.dx) / metrics.scale,
                y: (lastPointRef.current.y - metrics.dy) / metrics.scale,
            };
            const end = {
                x: (pos.canvasX - metrics.dx) / metrics.scale,
                y: (pos.canvasY - metrics.dy) / metrics.scale,
            };

            maskCtx.beginPath();
            maskCtx.moveTo(start.x, start.y);
            maskCtx.lineTo(end.x, end.y);
            maskCtx.strokeStyle = 'white';
            maskCtx.lineWidth = brushSize / metrics.scale;
            maskCtx.lineCap = 'round';
            maskCtx.lineJoin = 'round';

            if (activeTool === 'brush') {
                maskCtx.globalCompositeOperation = 'source-over';
                maskCtx.globalAlpha = brushOpacity;
            } else { // eraser
                maskCtx.globalCompositeOperation = 'destination-out';
                maskCtx.globalAlpha = 1;
            }
            maskCtx.stroke();
            
            lastPointRef.current = { x: pos.canvasX, y: pos.canvasY };
            redrawOverlays();
        }
    };

    const handleMouseUp = () => {
        if (isDrawing && activeTool === 'rectangle' && selectionRect && (selectionRect.width > 0 || selectionRect.height > 0)) {
            const metrics = getCanvasMetrics();
            const maskCanvas = maskCanvasRef.current;
            const maskCtx = maskCanvas?.getContext('2d');
            if (metrics && maskCanvas && maskCtx) {
                const rectX = (selectionRect.x - metrics.dx) / metrics.scale;
                const rectY = (selectionRect.y - metrics.dy) / metrics.scale;
                const rectWidth = selectionRect.width / metrics.scale;
                const rectHeight = selectionRect.height / metrics.scale;
                
                maskCtx.clearRect(0, 0, maskCanvas.width, maskCanvas.height);
                maskCtx.fillStyle = 'white';
                maskCtx.fillRect(rectX, rectY, rectWidth, rectHeight);
            }
        }
        setIsDrawing(false);
        lastPointRef.current = null;
    };
    
    const handleMouseLeave = () => {
        setIsDrawing(false);
        lastPointRef.current = null;
        const cursorCtx = cursorCanvasRef.current?.getContext('2d');
        if (cursorCtx && cursorCanvasRef.current) {
            cursorCtx.clearRect(0, 0, cursorCanvasRef.current.width, cursorCanvasRef.current.height);
        }
    };

    const handleGenerate = async () => {
        if (!image) { setError(t('inpainting.error.noImage')); return; }
        if (!prompt.trim()) { setError(t('inpainting.error.noPrompt')); return; }
        
        const maskCanvas = maskCanvasRef.current;
        const isMaskEmpty = !maskCanvas?.getContext('2d')?.getImageData(0, 0, maskCanvas.width, maskCanvas.height).data.some(channel => channel !== 0);

        let activeMaskDataUrl = isMaskEmpty ? lastMask : maskCanvas?.toDataURL('image/png');

        if (!activeMaskDataUrl) {
            setError(t('inpainting.error.noSelection'));
            return;
        }

        if (imageEditModel.startsWith('aivideoauto--') && !aivideoautoAccessToken) {
            setError(t('error.api.aivideoautoAuth'));
            return;
        }

        setIsLoading(true);
        setError(null);
        
        const finalPrompt = `# INSTRUCTION: MASKED IMAGE INPAINTING\n\n## IMAGE ROLES:\n- **Image 1 (Source):** The original image.\n- **Image 2 (Mask):** A black and white mask. The **white area** indicates the *only* region to be edited.\n\n## USER REQUEST:\nApply the following edit only inside the white area of the mask: "${prompt}"\n\n## CRITICAL RULES:\n1.  **Strict Boundaries:** All modifications MUST be confined to the white region of the mask.\n2.  **Seamless Blending:** The edited region must blend perfectly with the surrounding unchanged (black) area. Match lighting, texture, shadows, and perspective for a natural transition.\n3.  **Contextual Awareness:** The changes made within the mask should make sense in the context of the rest of the image.\n4.  **Preserve Unmasked Area:** The black region of the mask must remain 100% identical to the original source image.\n\n## OUTPUT:\nReturn ONLY the final edited, high-resolution (2K) image.`;

        const maskImage: ImageFile = {
            base64: activeMaskDataUrl.split(',')[1],
            mimeType: 'image/png'
        };

        try {
            const [result] = await editImage(
                { images: [image, maskImage], prompt: finalPrompt, numberOfImages: 1, aspectRatio },
                imageEditModel,
                buildImageServiceConfig(() => {})
            );
            setResultImage(result);
            addImage(result);
            if (!isMaskEmpty) {
                setLastMask(activeMaskDataUrl);
            }
        } catch (err) {
            setError(getErrorMessage(err, t));
        } finally {
            setIsLoading(false);
        }
    };
    
    return (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
            <div className="flex flex-col gap-6">
                <div className="text-center">
                    <h2 className="text-xl md:text-2xl font-bold mb-1">{t('inpainting.title')}</h2>
                    <p className="text-zinc-400 max-w-lg mx-auto">{t('inpainting.description')}</p>
                </div>

                <div className="w-full max-w-sm mx-auto">
                    <ImageUploader 
                        image={image} 
                        onImageUpload={(file) => { 
                            setImage(file); 
                            if(file) addImage(file);
                            handleClearMask();
                        }} 
                        title={t('inpainting.uploadTitle')} 
                        id="inpainting-upload" 
                    />
                </div>

                <div className="p-4 bg-zinc-900/50 rounded-lg border border-zinc-800 space-y-4">
                    <div className="flex justify-center items-center gap-4">
                        <div className="flex gap-1 bg-zinc-800 p-1 rounded-lg">
                            <button onClick={() => handleToolChange('rectangle')} className={`p-2 rounded-md ${activeTool === 'rectangle' ? 'bg-amber-600 text-white' : 'text-zinc-400 hover:bg-zinc-700'}`} title={t('inpainting.toolRectangle')}>
                                <MarqueeIcon className="w-5 h-5" />
                            </button>
                            <button onClick={() => handleToolChange('brush')} className={`p-2 rounded-md ${activeTool === 'brush' ? 'bg-amber-600 text-white' : 'text-zinc-400 hover:bg-zinc-700'}`} title={t('inpainting.toolBrush')}>
                                <BrushIcon className="w-5 h-5" />
                            </button>
                            <button onClick={() => handleToolChange('eraser')} className={`p-2 rounded-md ${activeTool === 'eraser' ? 'bg-amber-600 text-white' : 'text-zinc-400 hover:bg-zinc-700'}`} title={t('inpainting.toolEraser')}>
                                <EraserIcon className="w-5 h-5" />
                            </button>
                        </div>
                        <button onClick={handleClearMask} className="text-sm text-zinc-400 hover:text-white transition-colors">
                            {t('inpainting.clearSelection')}
                        </button>
                    </div>

                    <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t border-zinc-700/50">
                        <div className="flex items-center gap-2">
                            <label htmlFor="mask-color" className="text-sm text-zinc-300 whitespace-nowrap">{t('inpainting.maskColor')}:</label>
                            <input
                                id="mask-color"
                                type="color"
                                value={maskColor}
                                onChange={(e) => setMaskColor(e.target.value)}
                                className="w-8 h-8 p-0 border-none rounded cursor-pointer bg-transparent appearance-none"
                                style={{'WebkitAppearance': 'none'} as React.CSSProperties}
                            />
                        </div>
                        <div className="flex items-center gap-2 flex-grow w-full sm:w-auto">
                            <label htmlFor="mask-opacity" className="text-sm text-zinc-300 whitespace-nowrap">{t('inpainting.maskPreviewOpacity')}:</label>
                            <input
                                id="mask-opacity"
                                type="range"
                                min="0.1"
                                max="1"
                                step="0.05"
                                value={maskPreviewOpacity}
                                onChange={(e) => setMaskPreviewOpacity(Number(e.target.value))}
                                className="w-full"
                            />
                        </div>
                         <button onClick={() => setIsMaskVisible(!isMaskVisible)} className="p-2 rounded-md text-zinc-400 hover:bg-zinc-700" title={t('inpainting.toggleMaskVisibility')}>
                            {isMaskVisible ? <VisibleIcon className="w-5 h-5" /> : <HiddenIcon className="w-5 h-5" />}
                        </button>
                    </div>

                     {(activeTool === 'brush' || activeTool === 'eraser') && (
                        <div className="space-y-3 pt-4 border-t border-zinc-700/50 animate-fade-in">
                            <div>
                                <label className="text-sm text-zinc-300">{t('inpainting.brushSize')}: {brushSize}px</label>
                                <input type="range" min="1" max="200" value={brushSize} onChange={(e) => setBrushSize(Number(e.target.value))} className="w-full" />
                            </div>
                            {activeTool === 'brush' && (
                                <div>
                                    <label className="text-sm text-zinc-300">{t('inpainting.brushOpacity')}: {Math.round(brushOpacity * 100)}%</label>
                                    <input type="range" min="0.01" max="1" step="0.01" value={brushOpacity} onChange={(e) => setBrushOpacity(Number(e.target.value))} className="w-full" />
                                </div>
                            )}
                        </div>
                    )}
                </div>

                <div>
                    <label htmlFor="inpainting-prompt" className="block text-sm font-medium text-zinc-300 mb-2">{t('inpainting.promptLabel')}</label>
                    <textarea
                        id="inpainting-prompt"
                        value={prompt}
                        onChange={(e) => setPrompt(e.target.value)}
                        placeholder={t('inpainting.promptPlaceholder')}
                        rows={3}
                        className="w-full bg-zinc-800/50 border border-zinc-700 rounded-lg p-3 text-zinc-200 focus:ring-2 focus:ring-amber-500"
                    />
                </div>
                
                 <div className="p-4 bg-zinc-900/50 rounded-lg border border-zinc-800">
                    <ImageOptionsPanel
                      aspectRatio={aspectRatio} setAspectRatio={setAspectRatio}
                      resolution={resolution} setResolution={setResolution}
                      model={imageEditModel}
                    />
                </div>

                <div className="text-center">
                    <button 
                        onClick={handleGenerate} 
                        disabled={isLoading || !image}
                        className="bg-gradient-to-r from-amber-500 to-orange-600 text-white font-bold py-3 px-8 rounded-full hover:opacity-90 disabled:from-zinc-600 disabled:to-zinc-700 disabled:opacity-70 disabled:cursor-not-allowed shadow-lg shadow-amber-500/30"
                    >
                        {isLoading ? <Spinner /> : t('inpainting.generateButton')}
                    </button>
                </div>
            </div>

            <div className="sticky top-8">
                <div className={`relative w-full bg-zinc-900/50 rounded-2xl border border-zinc-800 flex items-center justify-center p-4 min-h-[50vh] lg:h-auto lg:aspect-[4/5] ${(activeTool === 'brush' || activeTool === 'eraser') && image ? 'cursor-none' : ''}`}>
                    <canvas ref={maskCanvasRef} className="hidden" />
                    <div className={`absolute inset-0 ${resultImage && !isDrawing ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}>
                         <canvas ref={imageCanvasRef} className="absolute inset-0 w-full h-full" />
                         <canvas 
                            ref={drawingCanvasRef} 
                            className={`absolute inset-0 w-full h-full z-10 ${image && activeTool !== 'rectangle' ? '' : 'cursor-crosshair'}`}
                            onMouseDown={handleMouseDown}
                            onMouseMove={handleMouseMove}
                            onMouseUp={handleMouseUp}
                            onMouseLeave={handleMouseLeave}
                         />
                         <canvas ref={cursorCanvasRef} className="absolute inset-0 w-full h-full pointer-events-none z-20" />
                    </div>

                    {resultImage && !isDrawing && (
                        <div className="w-full h-full">
                            <HoverableImage image={resultImage} altText="Inpainting result" onRegenerate={handleGenerate} isGenerating={isLoading} />
                        </div>
                    )}
                    
                    {!image && (
                        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                            <div className="text-center text-zinc-500 p-4">
                                <BrushIcon className="mx-auto h-16 w-16" />
                                <h3 className="mt-4 text-lg font-semibold text-zinc-400">{t('common.outputPanelTitle')}</h3>
                                <p className="mt-1 text-sm max-w-xs mx-auto">{t('inpainting.selectionInstruction')}</p>
                            </div>
                        </div>
                    )}
                    
                    {isLoading && (
                        <div className="absolute inset-0 bg-black/50 backdrop-blur-sm flex flex-col items-center justify-center text-center animate-fade-in z-30 rounded-2xl">
                            <Spinner />
                            <p className="mt-4 text-zinc-300 font-semibold">{t('inpainting.generatingStatus')}</p>
                        </div>
                    )}
                    
                    {error && !isLoading && (
                        <div className="absolute inset-0 p-4 w-full h-full flex items-center justify-center bg-black/70 z-30 rounded-2xl">
                            <ErrorDisplay title={t('common.generationFailed')} message={error} onClear={() => setError(null)} />
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default Inpainting;
