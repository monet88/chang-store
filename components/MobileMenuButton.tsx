/**
 * Mobile hamburger menu button
 *
 * Visible only on screens < lg (1024px).
 * Toggles sidebar visibility on mobile devices.
 */

import React from 'react';

interface MobileMenuButtonProps {
  onClick: () => void;
}

const MobileMenuButton: React.FC<MobileMenuButtonProps> = ({ onClick }) => {
  return (
    <button
      onClick={onClick}
      className="lg:hidden fixed top-4 left-4 z-50 p-2 bg-slate-800/90 backdrop-blur-sm rounded-lg border border-slate-700 text-slate-300 hover:text-white hover:bg-slate-700 transition-colors"
      aria-label="Toggle menu"
    >
      {/* Hamburger icon */}
      <svg
        xmlns="http://www.w3.org/2000/svg"
        fill="none"
        viewBox="0 0 24 24"
        strokeWidth={1.5}
        stroke="currentColor"
        className="w-6 h-6"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5"
        />
      </svg>
    </button>
  );
};

export default MobileMenuButton;
