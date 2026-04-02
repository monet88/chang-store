import React, { useState, useEffect } from 'react';
import { useLanguage } from '../../contexts/LanguageContext';
import { usePromptLibrary } from '../../hooks/usePromptLibrary';
import { useToast } from '../Toast';
import { CloseIcon, SearchIcon, DeleteIcon, CopyIcon, CheckIcon, EditIcon } from '../Icons';

interface PromptLibraryModalProps {
  isOpen: boolean;
  onClose: () => void;
  // onSelect will be used to inject the prompt back into the UI in a later phase
  onSelect?: (prompt: string) => void;
}

const PromptLibraryModal: React.FC<PromptLibraryModalProps> = ({ isOpen, onClose, onSelect }) => {
  const { t } = useLanguage();
  const { showToast } = useToast();
  const { searchPrompts, deletePrompt, savePrompt, editPrompt } = usePromptLibrary();
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedPromptId, setExpandedPromptId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [newTitle, setNewTitle] = useState('');
  const [newText, setNewText] = useState('');

  // Setup keyboard listener (Escape to close)
  useEffect(() => {
    const handleEsc = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };
    if (isOpen) {
      window.addEventListener('keydown', handleEsc);
      document.body.style.overflow = 'hidden';
    }
    return () => {
      window.removeEventListener('keydown', handleEsc);
      document.body.style.overflow = 'auto';
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const results = searchPrompts(searchQuery);

  const handleDelete = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (window.confirm(t('promptLibrary.deleteConfirm') || 'Are you sure you want to delete this prompt?')) {
      deletePrompt(id);
    }
  };

  const handleEdit = (e: React.MouseEvent, prompt: any) => {
    e.stopPropagation();
    setEditingId(prompt.id);
    setNewTitle(prompt.title || '');
    setNewText(prompt.text || '');
    setIsCreating(true);
  };

  const handleSaveNew = () => {
    if (!newText.trim()) return;
    if (editingId) {
      editPrompt(editingId, newTitle.trim(), newText.trim());
    } else {
      savePrompt(newTitle.trim(), newText.trim());
    }
    setIsCreating(false);
    setEditingId(null);
    setNewTitle('');
    setNewText('');
    setSearchQuery('');
    showToast(t('promptLibrary.saveSuccess') || 'Prompt saved');
  };

  return (
    <div
      className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[60] flex flex-col items-center justify-center p-4 sm:p-6 animate-fade-in"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div 
        className="w-full max-w-2xl bg-slate-900/90 border border-slate-700/50 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh] sm:max-h-[80vh]"
        onClick={(e) => e.stopPropagation()} // Prevent closing when clicking inside
      >
        {/* Header */}
        <div className="flex justify-between items-center p-4 sm:px-6 sm:py-5 border-b border-slate-700/50 flex-shrink-0">
          <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
            {t('promptLibrary.title') || 'Prompt Library'}
          </h2>
          <div className="flex items-center gap-3">
            {!isCreating && (
              <button
                onClick={() => setIsCreating(true)}
                className="px-3 py-1.5 bg-[#818CF8]/10 hover:bg-[#818CF8]/20 text-[#818CF8] text-sm font-medium rounded-lg transition-colors flex items-center gap-2 active:scale-95"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                {t('promptLibrary.createNew') || 'New Prompt'}
              </button>
            )}
            <button
              onClick={onClose}
              className="p-1.5 sm:p-2 rounded-full text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
              aria-label="Close"
            >
              <CloseIcon className="w-5 h-5 sm:w-6 sm:h-6" />
            </button>
          </div>
        </div>

        {isCreating ? (
          <div className="flex-1 flex flex-col p-4 sm:p-6 overflow-y-auto animate-fade-in scrollbar-thin scrollbar-thumb-slate-700 scrollbar-track-transparent">
            <div className="flex flex-col gap-5 max-w-2xl w-full mx-auto">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5 ml-1">
                  {t('promptLibrary.newTitle') || 'Prompt Title'}
                </label>
                <input
                  type="text"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder={t('promptLibrary.newTitlePlaceholder') || 'e.g. Remove Hand from Pocket'}
                  className="w-full bg-slate-800/50 border border-slate-700/50 text-white rounded-xl px-4 py-3 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-[#818CF8]/50 transition-all"
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5 ml-1">
                  {t('promptLibrary.newText') || 'Prompt Text'} <span className="text-red-400">*</span>
                </label>
                <textarea
                  value={newText}
                  onChange={(e) => setNewText(e.target.value)}
                  placeholder={t('promptLibrary.newTextPlaceholder') || 'Enter the detailed instructions here...'}
                  className="w-full bg-slate-800/50 border border-slate-700/50 text-white rounded-xl px-4 py-3 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-[#818CF8]/50 min-h-[160px] resize-y transition-all"
                />
              </div>
              <div className="flex justify-end gap-3 mt-4 pt-4 border-t border-slate-800/50">
                <button
                  onClick={() => { setIsCreating(false); setEditingId(null); setNewTitle(''); setNewText(''); }}
                  className="px-5 py-2.5 hover:bg-slate-800 text-slate-300 hover:text-white text-sm font-medium rounded-xl transition-colors"
                >
                  {t('common.cancel') || 'Cancel'}
                </button>
                <button
                  onClick={handleSaveNew}
                  disabled={!newText.trim()}
                  className="px-5 py-2.5 bg-[#818CF8] hover:bg-[#6366F1] disabled:bg-slate-800 disabled:text-slate-500 text-white text-sm font-medium rounded-xl transition-colors disabled:cursor-not-allowed"
                >
                  {t('common.save') || 'Save Prompt'}
                </button>
              </div>
            </div>
          </div>
        ) : (
          <>

        {/* Search */}
        <div className="p-4 sm:px-6 border-b border-slate-800/50 flex-shrink-0">
          <div className="relative">
            <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
            <input
              type="text"
              className="w-full bg-slate-800/50 border border-slate-700/50 text-white rounded-xl pl-10 pr-4 py-3 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-[#818CF8]/50 focus:border-[#818CF8] transition-all"
              placeholder={t('promptLibrary.searchPlaceholder')}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto p-2 sm:p-4 scrollbar-thin scrollbar-thumb-slate-700 scrollbar-track-transparent">
          {results.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-12 text-center h-full">
              <div className="w-16 h-16 bg-slate-800/50 rounded-full flex items-center justify-center mb-4">
                <SearchIcon className="w-8 h-8 text-slate-500" />
              </div>
              <p className="text-lg font-medium text-slate-300 mb-1">{t('promptLibrary.emptyState')}</p>
              <p className="text-sm text-slate-500">{t('promptLibrary.emptyStateBody')}</p>
            </div>
          ) : (
            <div className="space-y-2">
              {results.map((prompt) => (
                <div
                  key={prompt.id}
                  className={`group flex flex-col p-4 bg-slate-800/30 hover:bg-slate-800/70 border border-transparent hover:border-slate-700/50 rounded-xl transition-all ${expandedPromptId === prompt.id ? 'border-slate-600/50 bg-slate-800/50' : 'cursor-pointer active:scale-[0.99]'}`}
                >
                  <div 
                    className="flex justify-between items-start gap-4 cursor-pointer"
                    onClick={() => setExpandedPromptId(expandedPromptId === prompt.id ? null : prompt.id)}
                  >
                    <div className="flex flex-col gap-1.5 flex-1 min-w-0">
                      <div className="flex gap-2 items-center min-h-6">
                        {prompt.isCurated && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-[#818CF8]/10 text-[#818CF8] border border-[#818CF8]/20 flex-shrink-0">
                            {t('promptLibrary.curatedBadge')}
                          </span>
                        )}
                        <h3 className="text-base font-semibold text-slate-200 truncate pr-2">
                          {prompt.title || "Untitled"}
                        </h3>
                      </div>
                      
                      {expandedPromptId !== prompt.id && (
                        <p className="text-sm text-slate-400 leading-relaxed font-normal whitespace-pre-wrap line-clamp-1">
                          {prompt.text}
                        </p>
                      )}
                    </div>
                    
                    <div className="flex gap-1 flex-shrink-0">
                      <button
                        onClick={(e) => handleEdit(e, prompt)}
                        className={`p-1.5 rounded-md transition-all sm:opacity-0 group-hover:opacity-100 focus:opacity-100 flex-shrink-0
                          ${prompt.isCurated 
                            ? 'text-slate-600 cursor-not-allowed hidden' 
                            : 'text-slate-500 hover:text-[#818CF8] hover:bg-[#818CF8]/20 active:scale-95'}`}
                        aria-label="Edit"
                        disabled={prompt.isCurated}
                      >
                        {!prompt.isCurated && <EditIcon className="w-4 h-4" />}
                      </button>
                      <button
                        onClick={(e) => handleDelete(e, prompt.id)}
                        className={`p-1.5 rounded-md transition-all sm:opacity-0 group-hover:opacity-100 focus:opacity-100 flex-shrink-0
                          ${prompt.isCurated 
                            ? 'text-slate-600 cursor-not-allowed hidden' 
                            : 'text-slate-500 hover:text-red-400 hover:bg-red-900/20 active:scale-95'}`}
                        aria-label="Delete"
                        disabled={prompt.isCurated}
                      >
                        {!prompt.isCurated && <DeleteIcon className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                  
                  {expandedPromptId === prompt.id && (
                    <div className="mt-3 pt-3 border-t border-slate-700/50 animate-fade-in flex flex-col gap-3">
                      <div className="bg-slate-900/50 rounded-lg p-3 relative group/text">
                        <p className="text-sm text-slate-300 leading-relaxed font-normal whitespace-pre-wrap pr-6">
                          {prompt.text}
                        </p>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            navigator.clipboard.writeText(prompt.text);
                            setCopiedId(prompt.id);
                            showToast(t('promptLibrary.copyPrompt') || "Copied to clipboard");
                            setTimeout(() => setCopiedId(null), 2000);
                          }}
                          className="absolute top-2 right-2 p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white rounded-md transition-all opacity-0 group-hover/text:opacity-100 active:scale-95"
                          title="Copy prompt"
                        >
                          {copiedId === prompt.id ? <CheckIcon className="w-4 h-4 text-green-400" /> : <CopyIcon className="w-4 h-4" />}
                        </button>
                      </div>
                      
                      <div className="flex justify-end">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            navigator.clipboard.writeText(prompt.text);
                            showToast(t('promptLibrary.copyPrompt') || 'Copied to clipboard');
                            onClose();
                          }}
                          className="px-4 py-2 bg-[#818CF8]/10 hover:bg-[#818CF8]/20 text-[#818CF8] hover:text-white font-medium text-sm rounded-lg transition-colors flex items-center gap-2"
                        >
                          <CopyIcon className="w-4 h-4" />
                          {t('promptLibrary.copyPrompt') || 'Copy'}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
        </>
        )}
      </div>
    </div>
  );
};

export default PromptLibraryModal;
