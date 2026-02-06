import React, { useEffect } from 'react';

interface ToastProps {
  message: string;
  type: 'success' | 'error';
  onClose: () => void;
  duration?: number;
}

export const Toast: React.FC<ToastProps> = ({ message, type, onClose, duration = 3000 }) => {
  useEffect(() => {
    const timer = setTimeout(() => {
      onClose();
    }, duration);
    return () => clearTimeout(timer);
  }, [onClose, duration]);

  return (
    <div className={`fixed top-4 right-4 z-[9999] px-6 py-4 rounded-lg shadow-2xl border flex items-center gap-3 animate-in slide-in-from-right-10 fade-in duration-300 ${
      type === 'success' 
        ? 'bg-slate-900 border-green-500/50 text-green-200' 
        : 'bg-slate-900 border-red-500/50 text-red-200'
    }`}>
      <span className={`text-xl ${type === 'success' ? 'text-green-500' : 'text-red-500'}`}>
        {type === 'success' ? '✓' : '✕'}
      </span>
      <p className="font-medium text-sm">{message}</p>
      <button onClick={onClose} className="ml-4 opacity-50 hover:opacity-100 text-sm">✖</button>
    </div>
  );
};