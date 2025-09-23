'use client';

import React, { useEffect, useState } from 'react';
import ConfettiCanvas from 'react-canvas-confetti';

interface ConfettiSplashProps {
  isOpen: boolean;
  onClose: () => void;
  duration?: number; // in milliseconds, default 3000
}

export default function ConfettiSplash({ 
  isOpen, 
  onClose, 
  duration = 3000
}: ConfettiSplashProps) {
  const [showConfetti, setShowConfetti] = useState(false);

  // Auto-close after specified duration
  useEffect(() => {
    if (isOpen) {
      setShowConfetti(true);
      const timer = setTimeout(() => {
        setShowConfetti(false);
        setTimeout(() => {
          onClose();
        }, 500); // Allow confetti to fade out
      }, duration);
      
      return () => clearTimeout(timer);
    }
  }, [isOpen, duration, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 pointer-events-none">
      {showConfetti && (
        <ConfettiCanvas />
      )}
    </div>
  );
}