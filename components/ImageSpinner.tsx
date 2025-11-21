
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { ImageFile } from '../types';
import { useLanguage } from '../contexts/LanguageContext';
import { PlayIcon, PauseIcon, ZoomInIcon, ZoomOutIcon } from './Icons';

interface ImageSpinnerProps {
    images: ImageFile[];
}

// FIX: The component was not returning any JSX, causing a type error. Implemented the full component functionality.
const ImageSpinner: React.FC<ImageSpinnerProps> = ({ images }) => {
    const { t } = useLanguage();
    const [currentIndex, setCurrentIndex] = useState(0);
    const [isPlaying, setIsPlaying] = useState(false);
    const [zoom, setZoom] = useState(1);
    const [pan, setPan] = useState({ x: 0, y: 0 });
    const [isPanning, setIsPanning] = useState(false);
    const lastPos = useRef({ x: 0, y: 0 });
    const containerRef = useRef<HTMLDivElement>(null);

    const totalImages = images.length;
    const imageUrl = totalImages > 0 ? `data:${images[currentIndex]?.mimeType};base64,${images[currentIndex]?.base64}` : '';

    useEffect(() => {
        let interval: number | undefined;
        if (isPlaying && totalImages > 0) {
            interval = window.setInterval(() => {
                setCurrentIndex(prev => (prev + 1) % totalImages);
            }, 100); // 10fps
        }
        return () => {
            if (interval) clearInterval(interval);
        };
    }, [isPlaying, totalImages]);

    const togglePlay = () => {
        setIsPlaying(prev => !prev);
    };

    const handleScrubberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setCurrentIndex(Number(e.target.value));
        setIsPlaying(false);
    };

    const handleZoomIn = () => setZoom(prev => Math.min(prev * 1.2, 5));

    const handleZoomOut = useCallback(() => {
        const newZoom = Math.max(zoom / 1.2, 0.5);
        if (newZoom <= 1) {
            setPan({ x: 0, y: 0 });
            setZoom(1);
        } else {
            setZoom(newZoom);
        }
    }, [zoom]);

    const handleWheel = useCallback((e: React.WheelEvent<HTMLDivElement>) => {
        e.preventDefault();
        const newZoom = e.deltaY > 0 ? Math.max(zoom / 1.1, 0.5) : Math.min(zoom * 1.1, 5);
        if (newZoom <= 1) {
            setPan({ x: 0, y: 0 });
            setZoom(1);
        } else {
            setZoom(newZoom);
        }
    }, [zoom]);

    const handlePanStart = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
        if (zoom > 1) {
            e.preventDefault();
            setIsPanning(true);
            lastPos.current = { x: e.clientX, y: e.clientY };
        }
    }, [zoom]);

    const handlePanMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
        if (isPanning && zoom > 1) {
            