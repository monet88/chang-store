/**
 * Semi-transparent overlay for mobile sidebar
 *
 * Appears behind sidebar when open on mobile.
 * Click to close sidebar.
 */

import React from 'react';

interface MobileOverlayProps {
  isOpen: boolean;
  onClose: () => void;
}

const MobileOverlay: React.FC<MobileOverlayProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div
      className="lg:hidden fixed inset-0 z-20 bg-black/50 backdrop-blur-sm transition-opacity"
      onClick={onClose}
      aria-hidden="true"
    />
  );
};

export default MobileOverlay;
