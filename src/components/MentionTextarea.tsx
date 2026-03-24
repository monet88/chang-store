/**
 * MentionTextarea - Textarea with @mention autocomplete dropdown
 *
 * Features:
 * - Detects @ character while typing
 * - Shows dropdown with image thumbnails + @imgN tags
 * - Keyboard navigation (arrow keys, enter, escape)
 * - Inserts @imgN at cursor position on selection
 */

import React, { useState, useRef, useCallback, useEffect } from 'react';
import { ImageFile } from '../types';

/** Props for MentionTextarea component */
interface MentionTextareaProps {
  /** Current textarea value */
  value: string;
  /** Callback when value changes */
  onChange: (value: string) => void;
  /** Available images for mention */
  images: ImageFile[];
  /** Placeholder text */
  placeholder?: string;
  /** Number of rows */
  rows?: number;
  /** Unique ID for the component */
  id?: string;
}

/** Mention option for dropdown */
interface MentionOption {
  /** Tag string like @img1 */
  tag: string;
  /** Index in images array */
  index: number;
  /** Image data for thumbnail */
  image: ImageFile;
}

/**
 * MentionTextarea component
 * Provides autocomplete dropdown when typing @ to reference images
 */
const MentionTextarea: React.FC<MentionTextareaProps> = React.memo(({
  value,
  onChange,
  images,
  placeholder,
  rows = 3,
  id,
}) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Dropdown state
  const [showDropdown, setShowDropdown] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);

  // Generate mention options from images
  const options: MentionOption[] = images.map((img, idx) => ({
    tag: `@img${idx + 1}`,
    index: idx,
    image: img,
  }));

  /**
   * Insert mention tag at cursor position, replacing @ and any partial text
   */
  const insertMention = useCallback((tag: string) => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const cursorPos = textarea.selectionStart;
    const textBeforeCursor = value.substring(0, cursorPos);
    const lastAtIndex = textBeforeCursor.lastIndexOf('@');

    if (lastAtIndex === -1) return;

    // Replace @... with @imgN + space
    const newValue =
      value.substring(0, lastAtIndex) +
      tag + ' ' +
      value.substring(cursorPos);

    onChange(newValue);
    setShowDropdown(false);
    setSelectedIndex(0);

    // Restore focus and set cursor after inserted tag
    setTimeout(() => {
      textarea.focus();
      const newCursorPos = lastAtIndex + tag.length + 1;
      textarea.setSelectionRange(newCursorPos, newCursorPos);
    }, 0);
  }, [value, onChange]);

  /**
   * Handle textarea input change - detect @ trigger
   */
  const handleChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newValue = e.target.value;
    const cursorPos = e.target.selectionStart;
    onChange(newValue);

    // Check if @ was just typed or we're after an @
    const textBeforeCursor = newValue.substring(0, cursorPos);
    const lastAtIndex = textBeforeCursor.lastIndexOf('@');

    if (lastAtIndex !== -1 && images.length > 0) {
      const textAfterAt = textBeforeCursor.substring(lastAtIndex + 1);
      // Show dropdown if @ is at end or followed by partial "img" match
      // Also handle case where user is typing numbers after @img
      if (textAfterAt === '' || /^i?m?g?\d*$/i.test(textAfterAt)) {
        setShowDropdown(true);
        setSelectedIndex(0);
        return;
      }
    }
    setShowDropdown(false);
  }, [onChange, images.length]);

  /**
   * Handle keyboard navigation in dropdown
   */
  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (!showDropdown || options.length === 0) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex(prev => Math.min(prev + 1, options.length - 1));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex(prev => Math.max(prev - 1, 0));
        break;
      case 'Enter':
        e.preventDefault();
        insertMention(options[selectedIndex].tag);
        break;
      case 'Escape':
        e.preventDefault();
        setShowDropdown(false);
        break;
      case 'Tab':
        if (showDropdown) {
          e.preventDefault();
          insertMention(options[selectedIndex].tag);
        }
        break;
    }
  }, [showDropdown, options, selectedIndex, insertMention]);

  /**
   * Close dropdown when clicking outside
   */
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node) &&
        textareaRef.current &&
        !textareaRef.current.contains(e.target as Node)
      ) {
        setShowDropdown(false);
      }
    };

    if (showDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showDropdown]);

  /**
   * Scroll selected option into view
   */
  useEffect(() => {
    if (showDropdown && dropdownRef.current) {
      const selectedEl = dropdownRef.current.children[selectedIndex] as HTMLElement;
      if (selectedEl) {
        selectedEl.scrollIntoView({ block: 'nearest' });
      }
    }
  }, [selectedIndex, showDropdown]);

  return (
    <div className="relative">
      {/* Textarea */}
      <textarea
        ref={textareaRef}
        id={id}
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        rows={rows}
        className="w-full px-4 py-3 bg-zinc-800/50 rounded-lg border border-zinc-700 focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500 text-white placeholder-zinc-500 resize-none transition-colors"
        aria-autocomplete="list"
        aria-expanded={showDropdown}
        aria-controls={showDropdown ? `${id}-dropdown` : undefined}
      />

      {/* Dropdown */}
      {showDropdown && options.length > 0 && (
        <div
          ref={dropdownRef}
          id={`${id}-dropdown`}
          role="listbox"
          className="absolute z-50 mt-1 w-full max-h-48 overflow-y-auto bg-zinc-800 border border-zinc-700 rounded-lg shadow-xl"
        >
          {options.map((opt, idx) => (
            <button
              key={opt.tag}
              type="button"
              role="option"
              aria-selected={idx === selectedIndex}
              className={`flex items-center gap-3 w-full px-3 py-2 text-left transition-colors ${
                idx === selectedIndex
                  ? 'bg-zinc-700 text-white'
                  : 'text-zinc-300 hover:bg-zinc-700/50'
              }`}
              onClick={() => insertMention(opt.tag)}
              onMouseEnter={() => setSelectedIndex(idx)}
            >
              {/* Thumbnail */}
              <img
                src={`data:${opt.image.mimeType};base64,${opt.image.base64}`}
                alt={opt.tag}
                className="w-8 h-8 object-cover rounded flex-shrink-0"
              />
              {/* Tag label */}
              <span className="text-amber-400 font-mono text-sm">{opt.tag}</span>
            </button>
          ))}
        </div>
      )}

      {/* Hint text */}
      {images.length > 0 && (
        <p className="text-xs text-zinc-500 mt-1">
          Type @ to mention images
        </p>
      )}
    </div>
  );
});

// Add displayName for debugging
MentionTextarea.displayName = 'MentionTextarea';

export default MentionTextarea;
