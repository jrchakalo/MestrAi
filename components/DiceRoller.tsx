import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { DiceRollRequest } from '../types';
import { Button } from './ui/Button';

interface DiceRollerProps {
  isOpen: boolean;
  request: DiceRollRequest | null;
  onRollComplete: (total: number) => void;
}

export const DiceRoller: React.FC<DiceRollerProps> = ({ isOpen, request, onRollComplete }) => {
  const [rolling, setRolling] = useState(false);
  const [result, setResult] = useState<number | null>(null);
  const isCompletingRef = useRef(false);
  const rollTimeoutRef = useRef<number | null>(null);
  const completeTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    if (!isOpen) {
      setRolling(false);
      setResult(null);
      isCompletingRef.current = false;
      if (rollTimeoutRef.current) {
        window.clearTimeout(rollTimeoutRef.current);
        rollTimeoutRef.current = null;
      }
      if (completeTimeoutRef.current) {
        window.clearTimeout(completeTimeoutRef.current);
        completeTimeoutRef.current = null;
      }
    }
  }, [isOpen]);

  useEffect(() => {
    return () => {
      if (rollTimeoutRef.current) window.clearTimeout(rollTimeoutRef.current);
      if (completeTimeoutRef.current) window.clearTimeout(completeTimeoutRef.current);
    };
  }, []);

  const handleVirtualRoll = () => {
    if (rolling || isCompletingRef.current) return;
    setRolling(true);
    // Simulate animation time
    rollTimeoutRef.current = window.setTimeout(() => {
      const roll = Math.floor(Math.random() * 20) + 1; // Default d20
      setResult(roll);
      setRolling(false);
      
      // Auto close after showing result briefly
      completeTimeoutRef.current = window.setTimeout(() => {
        if (isCompletingRef.current) return;
        isCompletingRef.current = true;
        onRollComplete(roll);
        setResult(null);
      }, 1500);
    }, 1000);
  };

  const handleManualRoll = (value: string) => {
    if (rolling || isCompletingRef.current) return;
    const parsed = Number.parseInt(value, 10);
    const roll = Number.isFinite(parsed) ? Math.min(20, Math.max(1, parsed)) : 10;
    isCompletingRef.current = true;
    onRollComplete(roll);
  };

  if (!isOpen || !request) return null;

  const difficultyLabel = {
    NORMAL: 'Normal',
    HARD: 'Dificil',
    VERY_HARD: 'Muito Dificil',
  }[request.difficulty] || 'Normal';

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
        <motion.div 
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0 }}
          className="w-full max-w-md bg-slate-900 border border-slate-700 rounded-xl shadow-2xl overflow-hidden"
        >
          <div className="p-6 text-center">
            <h3 className="text-2xl font-bold text-purple-400 mb-2">Teste de {request.attribute}</h3>
            <p className="text-slate-400 mb-6">Dificuldade: {difficultyLabel}</p>

            <div className="flex justify-center mb-8">
              <motion.div
                animate={rolling ? { rotate: 360 } : {}}
                transition={rolling ? { duration: 0.5, repeat: Infinity, ease: "linear" } : {}}
                className="w-24 h-24 flex items-center justify-center bg-purple-900/30 rounded-full border-2 border-purple-500"
              >
                {result ? (
                  <span className="text-4xl font-bold text-white">{result}</span>
                ) : (
                  <svg className="w-12 h-12 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                  </svg>
                )}
              </motion.div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <Button onClick={handleVirtualRoll} disabled={rolling} className="w-full">
                {rolling ? "Rolando..." : "Rolar d20"}
              </Button>
              <div className="flex gap-2">
                 <input 
                   type="number" 
                   placeholder="Manual"
                   className="w-full bg-slate-800 border border-slate-700 rounded px-2 text-center text-white"
                   min={1}
                   max={20}
                   disabled={rolling || result !== null}
                   onKeyDown={(e) => {
                     if(e.key === 'Enter') {
                        handleManualRoll(e.currentTarget.value);
                     }
                   }}
                 />
              </div>
            </div>
            <p className="text-xs text-slate-500 mt-4">Digite o valor manual e tecle Enter se usar dados físicos.</p>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
