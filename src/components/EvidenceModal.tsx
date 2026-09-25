// Serif for the audit title; mono only for rule ids and evidence keys. deslop-ignore-file 07 34
import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X } from 'lucide-react';
import { DecisionTrace, RecommendationEvidenceTrace, RuleStatus } from '../types/health';

interface EvidenceModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  type: 'meal' | 'workout';
  recommendationSummary: string;
  userContextSummary: string;
  evidenceTraces: RecommendationEvidenceTrace[];
  trace?: DecisionTrace;
  ruleStatus?: RuleStatus;
  ruleId?: string;
  ruleName?: string;
  equipmentNote?: string;
  translationNote?: string;
}

const RULE_STATUS_LABEL: Record<RuleStatus, string> = {
  evidence_derived: 'evidence_derived · 文献之式',
  evidence_constrained: 'evidence_constrained · 证据之束',
  engineering_heuristic: 'engineering_heuristic · 工程权宜',
};

const RULE_STATUS_TEXT: Record<RuleStatus, string> = {
  evidence_derived: 'text-accent',
  evidence_constrained: 'text-tier2',
  engineering_heuristic: 'text-ink2',
};

const STRENGTH_LABEL: Record<'High' | 'Moderate' | 'Limited', string> = {
  High: '证据 强',
  Moderate: '证据 中',
  Limited: '证据 弱',
};

function formatValue(value: unknown): string {
  if (value === null || value === undefined) return '—';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

function TraceRows({ data }: { data: Record<string, unknown> }) {
  const entries = Object.entries(data);
  if (entries.length === 0) return null;
  return (
    <dl className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-3 gap-y-1 text-xs">
      {entries.map(([key, value]) => (
        <React.Fragment key={key}>
          <dt className="text-ink2 truncate">{key}</dt>
          <dd className="text-ink font-mono text-right tabular-nums break-all">
            {formatValue(value)}
          </dd>
        </React.Fragment>
      ))}
    </dl>
  );
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2 pt-3 border-t border-line">
      <h4 className="text-xs font-semibold text-ink2">{label}</h4>
      {children}
    </section>
  );
}

export const EvidenceModal: React.FC<EvidenceModalProps> = ({
  isOpen,
  onClose,
  title,
  recommendationSummary,
  userContextSummary,
  evidenceTraces,
  trace,
  ruleStatus,
  ruleId,
  ruleName,
  equipmentNote,
  translationNote,
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
          className="fixed inset-0 bg-ink/40 cursor-pointer"
        />

        {/* Audit sheet */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 8 }}
          transition={{ duration: 0.15 }}
          className="relative w-full max-w-md max-h-[85vh] overflow-y-auto bg-paper border border-line rounded-lg p-5 shadow-md z-10 space-y-3 text-xs text-ink2"
        >
          {/* Header */}
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="text-lg font-serif font-medium text-ink">{title}</h3>
              <p className="text-xs text-ink2 mt-1">{recommendationSummary}</p>
            </div>
            <button
              onClick={onClose}
              aria-label="阖之"
              className="p-1.5 rounded-lg text-ink3 hover:text-ink hover:bg-surface transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Context from the user's own records */}
          <Section label="君之实录">
            <p className="text-xs text-ink leading-relaxed">{userContextSummary}</p>
          </Section>

          {/* Which rule fired */}
          {ruleId && (
            <Section label="所中之规">
              <div className="space-y-1">
                <div className="font-mono text-[12px] text-ink break-all">{ruleId}</div>
                {ruleName && <div className="text-xs text-ink2">{ruleName}</div>}
                {ruleStatus && (
                  <div className={`text-[12px] ${RULE_STATUS_TEXT[ruleStatus]}`}>
                    {RULE_STATUS_LABEL[ruleStatus]}
                  </div>
                )}
              </div>
            </Section>
          )}

          {/* Deterministic decision trace */}
          {trace && (
            <Section label="决策之迹">
              <div className="space-y-3">
                <div>
                  <div className="text-[12px] text-ink3 mb-1">所入</div>
                  <TraceRows data={trace.inputSnapshot} />
                </div>
                <div>
                  <div className="text-[12px] text-ink3 mb-1">所推之值</div>
                  <TraceRows data={trace.derivedValues} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <div className="text-[12px] text-ink3 mb-1">所循之规</div>
                    <ul className="space-y-0.5 font-mono text-[12px] text-ink break-all">
                      {trace.ruleIds.map((id) => (
                        <li key={id}>{id}</li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <div className="text-[12px] text-ink3 mb-1">信度</div>
                    <div className="text-ink">
                      {trace.confidence === 'high'
                        ? '高'
                        : trace.confidence === 'medium'
                        ? '中'
                        : '低'}
                    </div>
                  </div>
                </div>
                {trace.assumptions.length > 0 && (
                  <div>
                    <div className="text-[12px] text-ink3 mb-1">所设之前提</div>
                    <ul className="space-y-1 text-ink2 leading-relaxed">
                      {trace.assumptions.map((item) => (
                        <li key={item} className="flex gap-1.5">
                          <span className="text-ink4">·</span>
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {trace.limitations.length > 0 && (
                  <div>
                    <div className="text-[12px] text-ink3 mb-1">局限</div>
                    <ul className="space-y-1 text-ink2 leading-relaxed">
                      {trace.limitations.map((item) => (
                        <li key={item} className="flex gap-1.5">
                          <span className="text-ink4">·</span>
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </Section>
          )}

          {/* Evidence behind the recommendation */}
          {evidenceTraces.length > 0 && (
            <Section label="证据所出">
              <ul className="space-y-2.5">
                {evidenceTraces.map((item) => (
                  <li key={item.evidenceId} className="space-y-1">
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-xs text-ink font-medium leading-snug">
                        {item.reference.title}
                      </span>
                      <span className="shrink-0 text-[12px] text-ink3">
                        {STRENGTH_LABEL[item.evidenceStrength]}
                      </span>
                    </div>
                    <div className="text-[12px] text-ink3">
                      {item.reference.organization} · {item.reference.year}
                      {item.reference.url && (
                        <a
                          href={item.reference.url}
                          target="_blank"
                          rel="noreferrer"
                          className="ml-1.5 text-ink2 hover:text-ink underline"
                        >
                          原文
                        </a>
                      )}
                    </div>
                    <p className="text-[12px] text-ink2 leading-relaxed">{item.relevance}</p>
                    <p className="text-[12px] text-ink4 leading-relaxed">
                      局限：{item.reference.limitations}
                    </p>
                  </li>
                ))}
              </ul>
            </Section>
          )}

          {/* Optional engineering notes */}
          {(equipmentNote || translationNote) && (
            <Section label="工程按语">
              <div className="space-y-1 text-[12px] text-ink2 leading-relaxed">
                {equipmentNote && <p>{equipmentNote}</p>}
                {translationNote && <p>{translationNote}</p>}
              </div>
            </Section>
          )}

          {/* Close */}
          <button onClick={onClose} className="btn-primary w-full">
            览毕
          </button>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
