import React from 'react';

interface TooltipProps {
  children: React.ReactNode;
  content: string;
  className?: string;
  position?: 'top' | 'bottom' | 'left' | 'right';
}

const Tooltip: React.FC<TooltipProps> = ({ children, content, className = '', position = 'top' }) => {
  const positionClasses = {
    top: 'bottom-full left-1/2 -translate-x-1/2 mb-2',
    bottom: 'top-full left-1/2 -translate-x-1/2 mt-2',
    left: 'bottom-full left-0 mb-2 sm:right-full sm:left-auto sm:top-1/2 sm:bottom-auto sm:-translate-y-1/2 sm:mr-2 sm:mb-0',
    right: 'bottom-full right-0 mb-2 sm:left-full sm:right-auto sm:top-1/2 sm:bottom-auto sm:-translate-y-1/2 sm:ml-2 sm:mb-0',
  };

  return (
    <div className={`relative group ${className}`}>
      {children}
      {content && (
        <div className={`absolute ${positionClasses[position]} w-max max-w-[calc(100vw-2rem)] sm:max-w-xs p-2 text-xs font-semibold text-white bg-zinc-800 border border-zinc-700 rounded-md shadow-lg opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity duration-300 pointer-events-none z-tooltip`}>
          {content}
        </div>
      )}
    </div>
  );
};

export default Tooltip;
