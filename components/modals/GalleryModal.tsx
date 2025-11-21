


import React, { useState, useEffect } from 'react';
import { useImageGallery } from '../../contexts/ImageGalleryContext';
import HoverableImage from '../HoverableImage';
import { useLanguage } from '../../contexts/LanguageContext';
import { ImageFile } from '../../types';
import { CheckIcon, CloseIcon, UploadIcon } from '../Icons';
import { uploadMultipleImages } from '../../services/imageHostingService';
import Spinner, { ProgressBar } from '../Spinner';
import { useImageViewer } from '../../contexts/ImageViewerContext';
import UploadResultsModal, { UploadResult, UploadFailure } from './UploadResultsModal';
import { useApi } from '../../contexts/ApiProviderContext';

interface GalleryModalProps {
  onClose: () => void;
  onEditImage: (image: ImageFile) => void;
}

const GalleryModal: React.FC<GalleryModalProps> = ({ onClose, onEditImage }) => {
    const { images, deleteImage, clearImages } = useImageGallery();
    const { t } = useLanguage();
    const { imgbbApiKey } = useApi();
    const [selectedIndices, setSelectedIndices] = useState<number[]>([]);
    
    type UploadState = {
        status: 'idle' | 'uploading' | 'done';
        results: { success: UploadResult[], failures: UploadFailure[] } | null;
        progress: { current: number; total: number; message: string };
    };
    const [uploadState, setUploadState] = useState<UploadState>({ status: 'idle', results: null, progress: { current: 0, total: 0, message: '' } });

    useEffect(() => {
        const handleEsc = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                if (uploadState.status !== 'uploading' && uploadState.status !== 'done') {
                    onClose();
                }
            }
        };
        window.addEventListener('keydown', handleEsc);
        document.body.style.overflow = 'hidden';
        return () => {
            window.removeEventListener('keydown', handleEsc);
            document.body.style.overflow = 'auto';
        };
    }, [onClose, uploadState.status]);

    const toggleSelection = (index: number) => {
        setSelectedIndices(prev => 
            prev.includes(index) ? prev.filter(i => i !== index) : [...prev, index]
        );
    };

    const handleClearAll = () => {
        if (window.confirm(t('gallery.clearAllConfirmation', { count: images.length }))) {
            clearImages();
        }
    };
    
    const handleUpload = async () => {
        const selectedImages = selectedIndices.map(i => images[i]);
        if (selectedImages.length === 0) return;

        setUploadState({ status: 'uploading', results: null, progress: { current: 0, total: selectedImages.length, message: 'Starting upload...' } });

        const results = await uploadMultipleImages(selectedImages, imgbbApiKey, (index, total, message) => {
            setUploadState(prev => ({ ...prev, progress: { current: index, total, message } }));
        });

        setUploadState(prev => ({ ...prev, status: 'done', results }));
    };

    const closeResultsModal = () => {
        setUploadState({ status: 'idle', results: null, progress: { current: 0, total: 0, message: '' } });
        setSelectedIndices([]);
    };

    return (
        <>
            <div
                className="fixed inset-0 bg-black/90 backdrop-blur-sm z-50 flex flex-col p-4 animate-fade-in"
                onClick={onClose}
                role="dialog"
                aria-modal="true"
            >
                <div className="flex justify-between items-center p-4 text-white w-full max-w-7xl mx-auto flex-shrink-0">
                    <div className="flex items-center gap-4">
                        <h2 className="text-2xl font-bold">{t('gallery.title')} ({images.length})</h2>
                        {images.length > 0 && (
                            <button
                                onClick={handleClearAll}
                                className="text-sm text-red-400 hover:text-red-300 bg-red-900/50 hover:bg-red-900/80 px-3 py-1.5 rounded-md transition-colors"
                            >
                                {t('gallery.clearAll')}
                            </button>
                        )}
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 rounded-full bg-black/30 hover:bg-black/50 transition-colors"
                        aria-label={t('gallery.closeAria')}
                    >
                        <CloseIcon className="w-8 h-8" />
                    </button>
                </div>
                <div 
                    className="flex-grow overflow-y-auto p-4"
                    onClick={(e) => e.stopPropagation()}
                >
                    {images.length === 0 ? (
                        <div className="flex items-center justify-center h-full">
                            <p className="text-slate-400 text-xl">{t('gallery.emptyMessage')}</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 max-w-7xl mx-auto">
                            {images.map((image, index) => {
                                const isSelected = selectedIndices.includes(index);
                                return (
                                <div key={`${index}-${image.base64.substring(0, 20)}`} className="relative">
                                    <div className={`rounded-lg overflow-hidden transition-all duration-200 ${isSelected ? 'ring-4 ring-emerald-500' : 'ring-0 ring-transparent'}`}>
                                        <HoverableImage
                                            image={image}
                                            altText={t('gallery.altText', { index: index + 1 })}
                                            downloadFileName={`gallery-image-${index + 1}.png`}
                                            onDelete={() => deleteImage(image.base64)}
                                            onClick={() => toggleSelection(index)}
                                            onEdit={() => onEditImage(image)}
                                        />
                                    </div>
                                    {isSelected && (
                                        <div className="absolute top-2 left-2 p-1 bg-emerald-500 rounded-full text-white pointer-events-none z-30">
                                            <CheckIcon className="w-4 h-4"/>
                                        </div>
                                    )}
                                </div>
                            )})}
                        </div>
                    )}
                </div>
                 {selectedIndices.length > 0 && (
                    <div className="sticky bottom-0 left-0 right-0 w-full flex-shrink-0 z-50" onClick={e => e.stopPropagation()}>
                        <div className="max-w-7xl mx-auto p-4 bg-slate-900/80 backdrop-blur-sm border-t border-slate-700 flex items-center justify-between rounded-t-lg">
                            <p className="font-semibold text-white">{selectedIndices.length} images selected</p>
                            <div className="flex items-center gap-4">
                                <button onClick={() => setSelectedIndices([])} className="text-sm text-slate-400 hover:text-white">Clear selection</button>
                                <button onClick={handleUpload} className="flex items-center gap-2 text-sm bg-emerald-600 text-white font-semibold py-2 px-4 rounded-lg hover:bg-emerald-500 transition-colors">
                                    <UploadIcon className="w-5 h-5" />
                                    <span>Smart Upload</span>
                                </button>
                            </div>
                        </div>
                    </div>
                 )}
            </div>

            {uploadState.status === 'uploading' && (
                 <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[60] flex items-center justify-center p-4 animate-fade-in" role="status" aria-modal="true">
                    <div className="bg-slate-900 p-8 rounded-lg text-center">
                        <Spinner />
                        <h3 className="text-lg font-semibold text-white mt-4">Uploading...</h3>
                        <p className="text-slate-400 text-sm mt-2">{uploadState.progress.message}</p>
                        <div className="mt-4">
                            <ProgressBar progress={uploadState.progress.current} total={uploadState.progress.total} />
                        </div>
                    </div>
                </div>
            )}

            {uploadState.status === 'done' && uploadState.results && (
                <UploadResultsModal results={uploadState.results} onClose={closeResultsModal} />
            )}
        </>
    );
};

export default GalleryModal;