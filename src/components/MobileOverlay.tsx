import React from 'react';

interface MobileOverlayProps {
  isOpen: boolean;
  onClose: () => void;
}

const MobileOverlay: React.FC<MobileOverlayProps> = ({ isOpen, onClose }) => {
  if (!isOpen) {
    return null;
  }

  return (
    <button
      type="button"
      className="fixed inset-0 z-30 bg-black/70 backdrop-blur-sm lg:hidden"
      onClick={onClose}
      aria-label="Close navigation"
    />
  );
};

export default MobileOverlay;
