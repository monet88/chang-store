
import React, { useState, useEffect, useMemo } from 'react';
import { useLanguage } from '../../contexts/LanguageContext';

type PoseCollection = {
    title: string;
    poses: {
        title: string;
        label: string;
        imageUrl: string;
    }[];
}

const CloseIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" {...props}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
    </svg>
);
const ChevronLeftIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" {...props}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
    </svg>
);
const ChevronRightIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" {...props}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
    </svg>
);
const CheckCircleIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" {...props}>
        <path fillRule="evenodd" d="M2.25 12c0-5.385 4.365-9.75 9.75-9.75s9.75 4.365 9.75 9.75-4.365 9.75-9.75 9.75S2.25 17.385 2.25 12zm13.36-1.814a.75.75 0 10-1.22-.872l-3.236 4.53L9.53 12.22a.75.75 0 00-1.06 1.06l2.25 2.25a.75.75 0 001.14-.094l3.75-5.25z" clipRule="evenodd" />
    </svg>
);


interface PoseLibraryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (selectedPoses: string[]) => void;
  initialSelectedPoses: string[];
}

const PoseLibraryModal: React.FC<PoseLibraryModalProps> = ({ isOpen, onClose, onConfirm, initialSelectedPoses }) => {
    const { t } = useLanguage();
    const collections: PoseCollection[] = t('poseChanger.poseCollections', { returnObjects: true });
    const [activeCollectionTitle, setActiveCollectionTitle] = useState(collections[0].title);
    const [currentPoseIndex, setCurrentPoseIndex] = useState(0);
    const [selectedPoses, setSelectedPoses] = useState<string[]>(initialSelectedPoses);

    const activeCollection = useMemo(() => collections.find(c => c.title === activeCollectionTitle) || collections[0], [activeCollectionTitle, collections]);
    const currentPose = activeCollection.poses[currentPoseIndex];
    
    useEffect(() => {
        if (!isOpen) return;
        document.body.style.overflow = 'hidden';

        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
            if (e.key === 'ArrowRight') handleNext();
            if (e.key === 'ArrowLeft') handlePrev();
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => {
            document.body.style.overflow = 'auto';
            window.removeEventListener('keydown', handleKeyDown);
        };
    }, [isOpen, onClose, currentPoseIndex, activeCollection.poses.length]);

    const handleCollectionChange = (title: string) => {
        setActiveCollectionTitle(title);
        setCurrentPoseIndex(0);
    };

    const handleNext = () => setCurrentPoseIndex(prev => (prev + 1) % activeCollection.poses.length);
    const handlePrev = () => setCurrentPoseIndex(prev => (prev - 1 + activeCollection.poses.length) % activeCollection.poses.length);

    const togglePoseSelection = (poseLabel: string) => {
        setSelectedPoses(prev => 
            prev.includes(poseLabel) 
                ? prev.filter(p => p !== poseLabel)
                : [...prev, poseLabel]
        );
    };
    
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-md z-[60] flex flex-col p-4 sm:p-6 lg:p-8 animate-fade-in" role="dialog" aria-modal="true">
            <header className="flex-shrink-0 flex items-center justify-between pb-4 border-b border-slate-700">
                <div>
                    <h2 className="text-xl md:text-2xl font-bold text-white">{t('poseModal.title')}</h2>
                    <p className="text-sm text-slate-400">{t('poseModal.description')}</p>
                </div>
                <button
                    onClick={onClose}
                    className="p-2 rounded-full text-slate-400 hover:text-white hover:bg-slate-700 transition-colors"
                    aria-label={t('poseModal.closeAria')}
                >
                    <CloseIcon className="w-7 h-7" />
                </button>
            </header>

            <main className="flex-grow flex flex-col md:flex-row gap-6 mt-4 overflow-hidden">
                <aside className="w-full md:w-48 lg:w-56 flex-shrink-0 overflow-x-auto md:overflow-x-hidden md:overflow-y-auto md:pr-2">
                    <nav className="flex flex-row md:flex-col gap-2 pb-2 md:pb-0 w-max md:w-full">
                        {collections.map(collection => (
                            <button
                                key={collection.title}
                                onClick={() => handleCollectionChange(collection.title)}
                                className={`w-full text-left p-3 rounded-lg text-sm font-semibold transition-colors duration-200 whitespace-nowrap ${
                                    activeCollectionTitle === collection.title
                                        ? 'bg-emerald-600 text-white'
                                        : 'text-slate-300 hover:bg-slate-700/50'
                                }`}
                            >
                                {collection.title}
                            </button>
                        ))}
                    </nav>
                </aside>
                
                <div className="flex-grow flex flex-col lg:flex-row gap-6 overflow-hidden min-w-0 min-h-0">
                    <div className="flex-grow flex flex-col items-center justify-center gap-4 overflow-hidden relative">
                        <div className="relative w-full h-full max-h-[50vh] lg:max-h-[70vh] flex items-center justify-center">
                            {currentPose && <img src={currentPose.imageUrl} alt={currentPose.title} className="max-w-full max-h-full object-contain rounded-lg shadow-2xl" />}
                        
                            <button onClick={handlePrev} className="absolute left-0 sm:left-4 top-1/2 -translate-y-1/2 p-3 bg-black/40 rounded-full text-white hover:bg-black/60 transition-colors" aria-label={t('poseModal.prevAria')}><ChevronLeftIcon className="w-6 h-6" /></button>
                            <button onClick={handleNext} className="absolute right-0 sm:right-4 top-1/2 -translate-y-1/2 p-3 bg-black/40 rounded-full text-white hover:bg-black/60 transition-colors" aria-label={t('poseModal.nextAria')}><ChevronRightIcon className="w-6 h-6" /></button>
                        
                            {currentPose && (
                                <button 
                                    onClick={() => togglePoseSelection(currentPose.label)}
                                    className={`absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-2 font-bold py-2 px-6 rounded-full transition-all duration-200 text-sm shadow-lg ${
                                        selectedPoses.includes(currentPose.label)
                                        ? 'bg-emerald-500 text-slate-900'
                                        : 'bg-slate-800/80 text-white hover:bg-slate-700'
                                    }`}
                                >
                                    {selectedPoses.includes(currentPose.label) ? `✓ ${t('poseModal.selected')}` : t('poseModal.selectPose')}
                                </button>
                            )}
                        </div>
                    </div>
                    <aside className="w-full lg:w-64 xl:w-72 flex-shrink-0 bg-slate-900/50 border border-slate-700 rounded-lg p-4 overflow-y-auto max-h-48 lg:max-h-full">
                        <h3 className="text-base md:text-lg font-semibold text-emerald-400 mb-3">{t('poseModal.poseDescription')}</h3>
                        {currentPose ? (
                             <div>
                                <h4 className="text-base font-semibold text-white mb-2">{currentPose.title}</h4>
                                <p className="text-slate-300 text-sm leading-relaxed">{currentPose.label}</p>
                            </div>
                        ) : (
                            <p className="text-slate-500">{t('poseModal.noPoseSelected')}</p>
                        )}
                    </aside>
                </div>
            </main>
            
            <footer className="flex-shrink-0 mt-4 pt-4 border-t border-slate-700 flex flex-col gap-4">
                <div className="overflow-x-auto w-full">
                    <div className="flex gap-3 pb-2 w-max">
                        {activeCollection.poses.map((pose, index) => {
                            const isSelected = selectedPoses.includes(pose.label);
                            return (
                                <button
                                    key={pose.imageUrl}
                                    onClick={() => setCurrentPoseIndex(index)}
                                    className={`relative w-20 h-28 rounded-md overflow-hidden flex-shrink-0 transition-all duration-200 group ring-2 ${
                                        currentPoseIndex === index ? 'ring-emerald-400 scale-105' : 'ring-transparent hover:ring-emerald-500/50'
                                    }`}
                                >
                                    <img src={pose.imageUrl} alt={pose.title} className="w-full h-full object-cover"/>
                                    <div className="absolute inset-0 bg-black/30 group-hover:bg-black/10 transition-colors"></div>
                                    {isSelected && (
                                        <div className="absolute top-1 right-1 text-emerald-500 bg-slate-900/60 rounded-full">
                                            <CheckCircleIcon className="w-5 h-5" />
                                        </div>
                                    )}
                                </button>
                            );
                        })}
                    </div>
                </div>
                <div className="flex items-center justify-between sm:justify-end gap-4">
                    <span className="text-white font-medium">{t('poseModal.posesSelectedCount', { count: selectedPoses.length })}</span>
                    <button
                        onClick={() => onConfirm(selectedPoses)}
                        className="bg-emerald-600 text-white font-bold py-2.5 px-8 rounded-full hover:bg-emerald-500 transition-opacity"
                    >
                        {t('poseModal.confirmButton')}
                    </button>
                </div>
            </footer>
        </div>
    );
};

export default PoseLibraryModal;
