import React, { useState, useEffect } from 'react';
import { LookbookSet } from '../types';
import { getSavedLookbookSets, deleteLookbookSet } from '../utils/storage';
import HoverableImage from './HoverableImage';

const TrashIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...props}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
    </svg>
);

const SavedLookbooks: React.FC = () => {
    const [savedSets, setSavedSets] = useState<LookbookSet[]>([]);

    useEffect(() => {
        setSavedSets(getSavedLookbookSets());
    }, []);

    const handleDelete = (id: string) => {
        deleteLookbookSet(id);
        setSavedSets(prevSets => prevSets.filter(set => set.id !== id));
    };

    if (savedSets.length === 0) {
        return (
            <div>
                <h2 className="text-xl md:text-2xl font-bold text-center mb-1">Saved Lookbooks</h2>
                <p className="text-slate-400 text-center mb-6">You haven't saved any lookbooks yet.</p>
                <p className="text-slate-500 text-center">Generated lookbooks can be saved from the 'Lookbook Generation' tab.</p>
            </div>
        );
    }

    return (
        <div>
            <h2 className="text-xl md:text-2xl font-bold text-center mb-1">Saved Lookbooks</h2>
            <p className="text-slate-400 text-center mb-6">Review and download your saved collections.</p>
            <div className="space-y-12">
                {savedSets.map(set => (
                    <div key={set.id} className="bg-slate-800/60 p-6 rounded-xl border border-slate-700">
                        <div className="flex justify-between items-center mb-4">
                            <div>
                                <h3 className="text-base md:text-lg font-semibold text-amber-400">Lookbook Collection</h3>
                                <p className="text-sm text-slate-400">
                                    Saved on: {new Date(set.createdAt).toLocaleString()}
                                </p>
                            </div>
                            <button 
                                onClick={() => handleDelete(set.id)}
                                className="flex items-center gap-2 text-sm text-red-400 hover:text-red-300 bg-red-500/10 hover:bg-red-500/20 px-3 py-2 rounded-lg transition-colors"
                                aria-label="Delete this lookbook set"
                            >
                                <TrashIcon className="w-4 h-4" />
                                <span>Delete Set</span>
                            </button>
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                            {set.images.map((image, index) => (
                                <HoverableImage 
                                    key={index}
                                    image={image}
                                    altText={`Saved lookbook image ${index + 1}`}
                                    downloadFileName={`saved-lookbook-${set.id}-${index + 1}`}
                                />
                            ))}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default SavedLookbooks;
