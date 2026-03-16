/**
 * UpscaleAnalysisReportCard — Collapsible sections showing the fashion analysis report.
 *
 * Renders garments, materials, background, lighting, framing, pose,
 * and preservation risks in a structured, scannable layout.
 *
 * Receives data only — all state lives in the parent hook.
 */

import React, { useState } from 'react';
import type { UpscaleAnalysisReport } from '../../types';
import { useLanguage } from '../../contexts/LanguageContext';

interface UpscaleAnalysisReportCardProps {
  report: UpscaleAnalysisReport;
}

/** Collapsible section wrapper */
const Section: React.FC<{
  title: string;
  icon: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}> = ({ title, icon, defaultOpen = false, children }) => {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="border border-zinc-700/60 rounded-lg overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-4 py-2.5 bg-zinc-800/60 hover:bg-zinc-800 transition-colors text-left"
        aria-expanded={open}
      >
        <span className="flex items-center gap-2 text-sm font-medium text-zinc-200">
          <span>{icon}</span>
          {title}
        </span>
        <span
          className={`text-zinc-500 transition-transform duration-200 ${
            open ? 'rotate-180' : ''
          }`}
        >
          ▾
        </span>
      </button>
      {open && <div className="px-4 py-3 text-sm text-zinc-300 space-y-2">{children}</div>}
    </div>
  );
};

/** Risk badge with color coding */
const RiskBadge: React.FC<{ level: string; label: string }> = ({ level, label }) => {
  const colors: Record<string, string> = {
    high: 'bg-red-500/20 text-red-400 border-red-500/30',
    medium: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
    low: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
  };
  return (
    <span
      className={`inline-block text-[10px] font-bold uppercase px-1.5 py-0.5 rounded border ${
        colors[level] ?? colors.low
      }`}
    >
      {label}
    </span>
  );
};

const UpscaleAnalysisReportCard: React.FC<UpscaleAnalysisReportCardProps> = ({ report }) => {
  const { t } = useLanguage();

  const riskLabels: Record<string, string> = {
    high: t('upscale.reportRiskHigh'),
    medium: t('upscale.reportRiskMedium'),
    low: t('upscale.reportRiskLow'),
  };

  return (
    <div className="space-y-2">
      <h4 className="text-sm font-bold text-zinc-100 flex items-center gap-2">
        <span>📋</span>
        {t('upscale.reportTitle')}
      </h4>

      <div className="space-y-1.5">
        {/* Garments */}
        <Section title={t('upscale.reportGarments')} icon="👗" defaultOpen>
          {report.garments.map((g, i) => (
            <div key={i} className="flex gap-2">
              <span className="text-violet-400 font-medium shrink-0">{g.name}</span>
              <span className="text-zinc-500">·</span>
              <span className="text-zinc-400 text-xs">{g.type}</span>
              <span className="text-zinc-500">—</span>
              <span className="text-zinc-400 text-xs">{g.description}</span>
            </div>
          ))}
        </Section>

        {/* Materials */}
        <Section title={t('upscale.reportMaterials')} icon="🧵">
          {report.materials.map((m, i) => (
            <div key={i} className="text-xs">
              <span className="text-violet-400 font-medium">{m.garment}</span>
              <span className="text-zinc-500"> — </span>
              {m.fabric}, {m.texture} texture, {m.weight} weight, {m.sheen} sheen
            </div>
          ))}
        </Section>

        {/* Background */}
        <Section title={t('upscale.reportBackground')} icon="🏞️">
          <div className="text-xs space-y-1">
            <div><span className="text-zinc-500">Environment:</span> {report.background.environment}</div>
            <div><span className="text-zinc-500">Surfaces:</span> {report.background.surfaces}</div>
            <div><span className="text-zinc-500">Depth:</span> {report.background.depth}</div>
            <div>{report.background.description}</div>
          </div>
        </Section>

        {/* Lighting */}
        <Section title={t('upscale.reportLighting')} icon="💡">
          <div className="text-xs space-y-1">
            <div><span className="text-zinc-500">Direction:</span> {report.lighting.direction}</div>
            <div><span className="text-zinc-500">Quality:</span> {report.lighting.quality}</div>
            <div><span className="text-zinc-500">Temperature:</span> {report.lighting.colorTemperature}</div>
            <div><span className="text-zinc-500">Shadows:</span> {report.lighting.shadows}</div>
          </div>
        </Section>

        {/* Framing */}
        <Section title={t('upscale.reportFraming')} icon="📐">
          <div className="text-xs space-y-1">
            <div><span className="text-zinc-500">Shot:</span> {report.framing.shotType}</div>
            <div><span className="text-zinc-500">Angle:</span> {report.framing.angle}</div>
            <div><span className="text-zinc-500">Composition:</span> {report.framing.composition}</div>
          </div>
        </Section>

        {/* Pose */}
        <Section title={t('upscale.reportPose')} icon="🧍">
          <div className="text-xs space-y-1">
            <div><span className="text-zinc-500">Body:</span> {report.pose.bodyPosition}</div>
            <div><span className="text-zinc-500">Gesture:</span> {report.pose.gesture}</div>
            <div><span className="text-zinc-500">Expression:</span> {report.pose.expression}</div>
            <div><span className="text-zinc-500">Movement:</span> {report.pose.movement}</div>
          </div>
        </Section>

        {/* Preservation Risks */}
        {report.preservationRisks.length > 0 && (
          <Section title={t('upscale.reportPreservationRisks')} icon="⚠️" defaultOpen>
            {report.preservationRisks.map((r, i) => (
              <div key={i} className="flex items-start gap-2 text-xs">
                <RiskBadge level={r.riskLevel} label={riskLabels[r.riskLevel] ?? r.riskLevel} />
                <div>
                  <span className="text-zinc-200 font-medium">{r.area}</span>
                  <span className="text-zinc-500"> — </span>
                  <span className="text-zinc-400">{r.detail}</span>
                </div>
              </div>
            ))}
          </Section>
        )}
      </div>
    </div>
  );
};

export default UpscaleAnalysisReportCard;
