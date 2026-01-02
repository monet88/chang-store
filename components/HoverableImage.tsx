import React from 'react';
import { ImageFile } from '../types';
import { useLanguage } from '../contexts/LanguageContext';
import { useImageGallery } from '../contexts/ImageGalleryContext';
import { useToast } from './Toast';
import Spinner from './Spinner';
import { CloudUploadIcon, DeleteIcon, DownloadIcon, EditorIcon, FullscreenIcon, GalleryIcon, RegenerateIcon } from './Icons';
import { useImageViewer } from '../contexts/ImageViewerContext';

interface HoverableImageProps {
    image: ImageFile;
    altText: string;
    downloadFileName?: string;
    onRegenerate?: () => void;
    onUpscale?: () => void;
    onDelete?: () => void;
    onEdit?: () => void;
    onClick?: () => void;
    isGenerating?: boolean;
    isUpscaling?: boolean;
    containerClassName?: string;
}

const HoverableImage: React.FC<HoverableImageProps> = ({
    image,
    altText,
    downloadFileName = 'generated-image.png',
    onRegenerate,
    onUpscale,
    onDelete,
    onEdit,
    onClick,
    isGenerating,
    isUpscaling,
    containerClassName
}) => {
    const { openImageViewer } = useImageViewer();
    const { t } = useLanguage();
    const { addImage, images } = useImageGallery();
    const { showToast } = useToast();
    const imageUrl = `data:${image.mimeType};base64,${image.base64}`;

    /** Check if image is already saved to gallery */
    const isSavedToGallery = images.some(img => img.base64 === image.base64);

    /** Handle save to gallery click */
    const handleSaveToGallery = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (isSavedToGallery) return;
        addImage(image);
        showToast(t('toast.imageSaved'));
    };

    const defaultClassName = "relative group w-full bg-slate-900 rounded-lg overflow-hidden border border-slate-700 shadow-md aspect-[4/5]";

    const handleExpandClick = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (isUpscaling) return;
        openImageViewer(image);
    };

    const handleDeleteClick = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (onDelete) {
            onDelete();
        }
    };

    const handleEditClick = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (onEdit) {
            onEdit();
        }
    };

    const handleImageClick = () => {
        if(onClick) {
            onClick();
        } else {
            openImageViewer(image);
        }
    }

    return (
        <>
            <div className={containerClassName ?? defaultClassName}>
                <img src={imageUrl} alt={altText} className="object-cover h-full w-full cursor-pointer" onClick={handleImageClick} />
                
                {isUpscaling && (
                    <div className="absolute inset-0 bg-black/60 flex items-center justify-center z-10">
                        <div className="flex flex-col items-center gap-2">
                            <Spinner />
                            <span className="text-white text-xs font-semibold">{t('imageActions.upscale')}...</span>
                        </div>
                    </div>
                )}

                <div className="absolute inset-0 bg-black/70 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex flex-col justify-between p-2 sm:p-4 z-20 pointer-events-none">
                    {/* Top right icons */}
                    <div className="flex justify-end gap-2 pointer-events-auto">
                         {/* Save to Gallery button */}
                         <button
                            onClick={handleSaveToGallery}
                            disabled={isSavedToGallery}
                            className={`p-2 rounded-full transition-colors ${
                                isSavedToGallery
                                    ? 'bg-green-600/70 text-white cursor-default'
                                    : 'bg-slate-900/50 text-white hover:bg-amber-600/80'
                            }`}
                            aria-label={isSavedToGallery ? t('imageActions.savedToGallery') : t('imageActions.saveToGallery')}
                            title={isSavedToGallery ? t('imageActions.savedToGallery') : t('imageActions.saveToGallery')}
                        >
                            <GalleryIcon className="w-5 h-5" />
                        </button>
                         {onEdit && (
                            <button 
                                onClick={handleEditClick}
                                className="p-2 bg-slate-900/50 rounded-full text-white hover:bg-slate-800/80 transition-colors"
                                aria-label={t('imageActions.edit')}
                            >
                                <EditorIcon className="w-5 h-5" />
                            </button>
                        )}
                        {onDelete && (
                            <button 
                                onClick={handleDeleteClick}
                                className="p-2 bg-red-600/70 rounded-full text-white hover:bg-red-500/90 transition-colors"
                                aria-label="Delete image"
                            >
                                <DeleteIcon className="w-5 h-5" />
                            </button>
                        )}
                        <button 
                            onClick={handleExpandClick}
                            className="p-2 bg-slate-900/50 rounded-full text-white hover:bg-slate-800/80 transition-colors"
                            aria-label="View full image"
                        >
                            <FullscreenIcon className="w-5 h-5" />
                        </button>
                    </div>
                    
                    {/* Bottom buttons */}
                    <div className="flex justify-center items-center gap-3 bg-slate-950/80 p-2 rounded-full backdrop-blur-sm pointer-events-auto">
                        {onRegenerate && (
                            <button
                                onClick={onRegenerate}
                                disabled={isGenerating || isUpscaling}
                                className="p-2.5 bg-slate-700/80 rounded-full text-white hover:bg-slate-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                aria-label={t('imageActions.regenerate')}
                            >
                                {isGenerating ? <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-amber-400"></div> : <RegenerateIcon className="w-5 h-5" />}
                            </button>
                        )}
                        {onUpscale && (
                            <button
                                onClick={onUpscale}
                                disabled={isGenerating || isUpscaling}
                                className="p-2.5 bg-slate-700/80 rounded-full text-white hover:bg-slate-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                aria-label={t('imageActions.upscale')}
                            >
                                {isUpscaling ? <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-amber-400"></div> : <CloudUploadIcon className="w-5 h-5" />}
                            </button>
                        )}
                         <a
                            href={imageUrl}
                            download={downloadFileName}
                            className="p-2.5 bg-amber-600 rounded-full text-white hover:bg-amber-500 transition-colors"
                            aria-label={t('imageActions.download')}
                        >
                            <DownloadIcon className="w-5 h-5" />
                        </a>
                    </div>
                </div>
            </div>
        </>
    );
};

export default HoverableImage;
