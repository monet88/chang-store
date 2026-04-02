import { useState, useEffect, useCallback } from 'react';
import { SavedPrompt } from '../types';

const STORAGE_KEY = 'chang_store_prompts';
const MAX_PROMPTS = 50;

const CURATED_PROMPTS: SavedPrompt[] = [
  {
    id: "curated-1",
    title: "Remove Hand from Pocket",
    text: "Edit the image to remove the hand that is inside the pocket. Move that hand completely outside and place it hanging naturally by the person's side with fingers slightly curled. Reconstruct the pocket area so it appears empty and flat, with natural fabric folds. Only modify the hand and arm position. Do not change anything else, including identity, clothing, lighting, or background. Style: photorealistic, seamless edit.",
    createdAt: Date.now() - 3000,
    isCurated: true,
  },
  {
    id: "curated-2",
    title: "Untucked Shirt",
    text: "Edit the image to make the shirt untucked. The shirt should be fully outside the waistband, with the hem visible and naturally draping over the pants or skirt. Preserve the original shirt design, fabric, color, and fit. Add realistic folds and draping consistent with the person's pose. Only modify the shirt position. Do not change anything else, including identity, pose, accessories, lighting, or background. Style: photorealistic, seamless edit.",
    createdAt: Date.now() - 2000,
    isCurated: true,
  },
  {
    id: "curated-3",
    title: "Combo (Pocket + Untuck)",
    text: "Edit the image with two adjustments:\n\n1. Remove the hand that is inside the pocket:\n- Move that hand completely outside\n- Place it hanging naturally by the person's side with relaxed fingers\n- Reconstruct the pocket area so it appears empty and flat, with natural fabric folds\n\n2. Make the shirt untucked:\n- The shirt should be fully outside the waistband\n- The hem must be visible and drape naturally over the pants or skirt\n- Preserve the original shirt design, fabric, color, and fit\n\nConstraints:\n- Only modify the hand/arm position and the shirt position\n- Keep everything else unchanged, including identity, pose, accessories, lighting, and background\n- Maintain realistic proportions, fabric behavior, and natural folds\n\nStyle: photorealistic, seamless edit",
    createdAt: Date.now() - 1000,
    isCurated: true,
  }
];

export function usePromptLibrary() {
  const [prompts, setPrompts] = useState<SavedPrompt[]>([]);

  // Initialize from local storage or set curated
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        const migrated = parsed.map((p: SavedPrompt) => {
          if (p.isCurated && !p.title) {
            const curatedMatch = CURATED_PROMPTS.find((c) => c.id === p.id);
            if (curatedMatch) return { ...p, title: curatedMatch.title };
          }
          return p;
        });
        setPrompts(migrated);
      } else {
        setPrompts(CURATED_PROMPTS);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(CURATED_PROMPTS));
      }
    } catch (e) {
      console.error("Failed to load prompt library", e);
      setPrompts(CURATED_PROMPTS);
    }
  }, []);

  // Save changes to localStorage whenever prompts update
  useEffect(() => {
    if (prompts.length > 0) {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(prompts));
      } catch (e) {
        console.error("Failed to save prompt library", e);
      }
    }
  }, [prompts]);

  const savePrompt = useCallback((title: string, text: string) => {
    setPrompts(prev => {
      const newPrompt: SavedPrompt = {
        id: crypto.randomUUID(),
        title,
        text,
        createdAt: Date.now(),
      };
      // Pre-pend and enforce max limit
      const updated = [newPrompt, ...prev].slice(0, MAX_PROMPTS);
      return updated;
    });
  }, []);

  const deletePrompt = useCallback((id: string) => {
    setPrompts(prev => prev.filter(p => p.id !== id));
  }, []);

  const searchPrompts = useCallback((query: string) => {
    if (!query.trim()) {
       // Sort newest first: the array is generally maintained in descending order (newest first). 
       // but we sort anyway to guarantee.
       return [...prompts].sort((a, b) => b.createdAt - a.createdAt);
    }
    const q = query.toLowerCase();
    return prompts
      .filter(p => (p.title || p.text).toLowerCase().includes(q))
      .sort((a, b) => b.createdAt - a.createdAt);
  }, [prompts]);

  const editPrompt = useCallback((id: string, newTitle: string, newText: string) => {
    setPrompts(prev => prev.map(p => 
      p.id === id ? { ...p, title: newTitle, text: newText } : p
    ));
  }, []);

  return {
    prompts,
    savePrompt,
    deletePrompt,
    searchPrompts,
    editPrompt,
  };
}
