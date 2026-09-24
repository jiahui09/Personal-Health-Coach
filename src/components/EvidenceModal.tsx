import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X } from 'lucide-react';
import { DecisionTrace, RecommendationEvidenceTrace } from '../types/health';

interface EvidenceModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  type: 'meal' | 'workout';
  recommendationSummary: string;
  userContextSummary: string;
  evidenceTraces: RecommendationEvidenceTrace[];
  trace?: DecisionTrace;
  ruleStatus?: string;
  ruleId?: string;
  ruleName?: string;
  equipmentNote?: string;
  translationNote?: string;
}

export const EvidenceModal: React.FC<EvidenceModalProps> = ({
  isOpen,
  onClose,
  type,
  trace,
  ruleId,
  evidenceTraces,
  equipmentNote,
}) => {
  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 bg-[#1c1917]/40 backdrop-blur-2xs cursor-pointer"
        />

        {/* Minimal Audit Sheet */}
        <motion.div
          initial={{ scale: 0.97, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.97, opacity: 0 }}
          transition={{ duration: 0.15 }}
          className="relative w-full max-w-md bg-[#faf8f5] border border-[#ded8cc] rounded-2xl p-6 shadow-xl z-10 space-y-4 font-sans text-xs text-[#44403c]"
        >
          {/* Header */}
          <div className="flex items-center justify-between pb-3 border-b border-[#e9e4dc]">
            <h3 className="text-lg font-serif font-medium text-[#1c1917]">
              Why this?
            </h3>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-[#78716c] hover:text-[#1c1917] hover:bg-[#eeeae2] transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Section: Your data */}
          <div className="space-y-1">
            <div className="font-mono text-[10px] uppercase tracking-wider text-[#78716c]">
              Your data
            </div>
            {type === 'meal' ? (
              <div className="space-y-0.5 text-xs text-[#1c1917]">
                <div>Weight: 68.4 kg</div>
                <div>Goal: Fat loss</div>
                <div>Protein today: 63 g</div>
              </div>
            ) : (
              <div className="space-y-0.5 text-xs text-[#1c1917]">
                <div>Sleep: 7h 20m</div>
                <div>Energy: 3/5</div>
                <div>Soreness: 3/5</div>
              </div>
            )}
          </div>

          {/* Section: Calculated context */}
          <div className="space-y-1">
            <div className="font-mono text-[10px] uppercase tracking-wider text-[#78716c]">
              Calculated context
            </div>
            {type === 'meal' ? (
              <div className="space-y-0.5 text-xs text-[#1c1917]">
                <div>Protein reference: 96–137 g/day (1.4–2.0 g/kg)</div>
                <div>Estimated energy reference: ≈ 1,950 kcal/day</div>
              </div>
            ) : (
              <div className="space-y-0.5 text-xs text-[#1c1917]">
                <div>Training state: Light (Intermediate balance)</div>
                <div>Prescribed volume: 2 sets / movement (RIR 2–3)</div>
              </div>
            )}
          </div>

          {/* Section: Decision */}
          <div className="space-y-1">
            <div className="font-mono text-[10px] uppercase tracking-wider text-[#78716c]">
              Decision
            </div>
            <div className="text-xs text-[#1c1917]">
              {type === 'meal'
                ? 'A balanced, moderate-protein meal was selected (≈ 480–580 kcal, ≈ 35–45g protein).'
                : '16 min Light session with moderate bodyweight volume.'}
            </div>
          </div>

          {/* Section: Rules */}
          <div className="space-y-1">
            <div className="font-mono text-[10px] uppercase tracking-wider text-[#78716c]">
              Rules
            </div>
            <div className="font-mono text-[11px] text-[#57534e]">
              {type === 'meal' ? (
                <>
                  <div>PROTEIN_TARGET_01</div>
                  <div>MEAL_PROTEIN_GAP_01</div>
                </>
              ) : (
                <>
                  <div>WORKOUT_AUTOREGULATION_01</div>
                  <div>CALISTHENICS_PROGRESSION_01</div>
                </>
              )}
            </div>
          </div>

          {/* Section: Evidence */}
          <div className="space-y-1">
            <div className="font-mono text-[10px] uppercase tracking-wider text-[#78716c]">
              Evidence
            </div>
            <div className="text-xs text-[#1c1917]">
              {type === 'meal' ? (
                <div>Morton et al., 2018 · Schoenfeld & Aragon, 2018</div>
              ) : (
                <div>ACSM 2026 Position Stand · Helms et al., 2016</div>
              )}
            </div>
          </div>

          {/* Section: Limitation */}
          <div className="space-y-1 pt-1 border-t border-[#eeeae2]">
            <div className="font-mono text-[10px] uppercase tracking-wider text-[#78716c]">
              Limitation
            </div>
            <div className="text-[11px] text-[#78716c] leading-relaxed">
              {type === 'meal' ? (
                <div>
                  Population-level evidence does not define an exact individual optimum. Meal templates use approximate nutritional values.
                </div>
              ) : (
                <div>
                  Product decision heuristic, not a clinically validated readiness threshold. Pull movements are limited without equipment.
                </div>
              )}
            </div>
          </div>

          {/* Close Button */}
          <div className="pt-2">
            <button
              onClick={onClose}
              className="w-full py-2 rounded-xl bg-[#1c1917] text-white text-xs font-medium hover:bg-[#332f2b] transition-colors cursor-pointer"
            >
              我知道了
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
