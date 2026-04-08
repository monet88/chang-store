import React, { useCallback, useState } from 'react';
import { ImageFile } from '../types';
import { useLanguage } from '../contexts/LanguageContext';
import { DownloadIcon } from './Icons';
import { downloadImageAsJpeg } from '@/utils/imageDownload';

interface ImageComparatorProps {
  before: ImageFile;
  after: ImageFile;
  /** Context-aware download filename (without extension) */
  downloadName?: string;
  downloadPrefix?: string;
}

const ImageComparator: React.FC<ImageComparatorProps> = ({ before, after, downloadName, downloadPrefix = 'upscaled-image' }) => {
  const { t } = useLanguage();
  const [sliderVal, setSliderVal] = useState(50);
  
  const beforeUrl = `data:${before.mimeType};base64,${before.base64}`;
  const afterUrl = `data:${after.mimeType};base64,${after.base64}`;

  const handleDownloadClick = useCallback((e: React.MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    void downloadImageAsJpeg(
      after,
      downloadName
        ? { baseName: downloadName }
        : { prefix: downloadPrefix },
    );
  }, [after, downloadName, downloadPrefix]);

  return (
    <div className="comparator-container">
      <div className="comparator-image-wrapper">
        <img src={beforeUrl} alt={t('imageComparator.beforeAlt')} />
        {sliderVal < 95 && <div className="comparator-label before">{t('imageComparator.before')}</div>}
      </div>
      
      <div className="comparator-image-wrapper" style={{ clipPath: `inset(0 ${100 - sliderVal}% 0 0)` }}>
        <img src={afterUrl} alt={t('imageComparator.afterAlt')} />
        {sliderVal > 5 && <div className="comparator-label after">{t('imageComparator.after')}</div>}
      </div>

      <button
        type="button"
        className="absolute top-2 right-2 z-20 p-2 bg-black/50 rounded-full text-white hover:bg-black/70 transition-colors"
        aria-label={t('imageActions.download')}
        onClick={handleDownloadClick}
      >
        <DownloadIcon className="w-5 h-5" />
      </button>

      <div className="comparator-handle" style={{ left: `${sliderVal}%` }} />
      
      <input
        type="range"
        min="0"
        max="100"
        value={sliderVal}
        onChange={(e) => setSliderVal(Number(e.target.value))}
        className="comparator-slider"
        aria-label={t('imageComparator.sliderAria')}
      />
    </div>
  );
};

export default ImageComparator;
