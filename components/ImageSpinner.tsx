import React, { useState, useEffect, useRef, useCallback } from 'react';
import { ImageFile } from '../types';
import { PlayIcon, PauseIcon, ZoomInIcon, ZoomOutIcon } from './Icons';

interface ImageSpinnerProps {
  images: ImageFile[];
  autoplayIntervalMs?: number;
}

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

const ImageSpinner: React.FC<ImageSpinnerProps> = ({ images, autoplayIntervalMs = 120 }) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const startPointer = useRef({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement>(null);

  const frameCount = images.length;
  const activeImage = frameCount > 0 ? images[currentIndex] : null;
  const imageSrc = activeImage ? `data:${activeImage.mimeType};base64,${activeImage.base64}` : '';

  useEffect(() => {
    if (!isPlaying || frameCount < 2) {
      return;
    }
    const id = window.setInterval(() => {
      setCurrentIndex(prev => (prev + 1) % frameCount);
    }, autoplayIntervalMs);
    return () => window.clearInterval(id);
  }, [isPlaying, frameCount, autoplayIntervalMs]);

  useEffect(() => {
    setCurrentIndex(0);
    setIsPlaying(false);
  }, [frameCount]);

  const togglePlay = useCallback(() => {
    if (frameCount < 2) {
      return;
    }
    setIsPlaying(prev => !prev);
  }, [frameCount]);

  const handleScrub = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    setCurrentIndex(Number(event.target.value));
    setIsPlaying(false);
  }, []);

  const zoomIn = useCallback(() => {
    setZoom(prev => clamp(prev * 1.2, 1, 5));
  }, []);

  const zoomOut = useCallback(() => {
    setZoom(prev => {
      const next = clamp(prev / 1.2, 1, 5);
      if (next === 1) {
        setPan({ x: 0, y: 0 });
      }
      return next;
    });
  }, []);

  const handleWheel = useCallback(
    (event: React.WheelEvent<HTMLDivElement>) => {
      event.preventDefault();
      if (event.deltaY > 0) {
        zoomOut();
      } else {
        zoomIn();
      }
    },
    [zoomIn, zoomOut],
  );

  const beginPan = useCallback((event: React.MouseEvent<HTMLDivElement>) => {
    if (zoom === 1) {
      return;
    }
    event.preventDefault();
    setIsPanning(true);
    startPointer.current = { x: event.clientX, y: event.clientY };
  }, [zoom]);

  const continuePan = useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      if (!isPanning || zoom === 1) {
        return;
      }
      event.preventDefault();
      const dx = event.clientX - startPointer.current.x;
      const dy = event.clientY - startPointer.current.y;
      startPointer.current = { x: event.clientX, y: event.clientY };
      setPan(prev => ({ x: prev.x + dx, y: prev.y + dy }));
    },
    [isPanning, zoom],
  );

  const endPan = useCallback(() => setIsPanning(false), []);

  if (!frameCount || !activeImage) {
    return (
      <div className="flex h-48 w-full items-center justify-center rounded-xl border border-dashed border-slate-700 text-sm text-slate-400">
        Upload or generate images to preview the spinner.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div
        ref={containerRef}
        className="relative flex aspect-square items-center justify-center overflow-hidden rounded-2xl border border-slate-700 bg-slate-900"
        onWheel={handleWheel}
        onMouseDown={beginPan}
        onMouseMove={continuePan}
        onMouseUp={endPan}
        onMouseLeave={endPan}
      >
        <img
          src={imageSrc}
          alt="Generated spin frame"
          className="select-none object-contain"
          draggable={false}
          style={{
            transform: `scale(${zoom}) translate(${pan.x / zoom}px, ${pan.y / zoom}px)`,
            transition: isPanning ? 'none' : 'transform 120ms ease-out',
          }}
        />
        {frameCount > 1 && (
          <div className="absolute bottom-4 left-1/2 flex -translate-x-1/2 items-center gap-3 rounded-full bg-black/50 px-4 py-2 text-xs text-white backdrop-blur">
            <button
              type="button"
              className="rounded-full bg-white/10 p-1 text-white transition hover:bg-white/20"
              onClick={togglePlay}
              aria-label={isPlaying ? 'Pause spin' : 'Play spin'}
            >
              {isPlaying ? <PauseIcon className="h-4 w-4" /> : <PlayIcon className="h-4 w-4" />}
            </button>
            <span>
              {currentIndex + 1}/{frameCount}
            </span>
          </div>
        )}
      </div>

      {frameCount > 1 && (
        <div className="flex flex-col gap-3 rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
          <input
            type="range"
            min={0}
            max={frameCount - 1}
            step={1}
            value={currentIndex}
            onChange={handleScrub}
            className="h-2 w-full cursor-pointer rounded-full bg-slate-700 accent-emerald-400"
            aria-label="Scrub through frames"
          />
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <button
                type="button"
                className="rounded-full bg-slate-800 p-2 text-slate-200 transition hover:bg-slate-700"
                onClick={zoomOut}
                aria-label="Zoom out"
              >
                <ZoomOutIcon className="h-4 w-4" />
              </button>
              <button
                type="button"
                className="rounded-full bg-slate-800 p-2 text-slate-200 transition hover:bg-slate-700"
                onClick={zoomIn}
                aria-label="Zoom in"
              >
                <ZoomInIcon className="h-4 w-4" />
              </button>
            </div>
            <span className="text-sm text-slate-400">{Math.round(zoom * 100)}%</span>
          </div>
        </div>
      )}
    </div>
  );
};

export default ImageSpinner;
