import React from 'react';
import { panelClass, eyebrowClass, sectionTitleClass, helperClass } from './provider-studio-styles';

interface StepPanelProps {
  /** Eyebrow text, e.g. "STEP 1 · UPLOAD". */
  eyebrow: string;
  title: string;
  hint?: string;
  children: React.ReactNode;
}

/**
 * Stepped, rounded-card panel matching Gemini's `VirtualTryOn` sections. Wraps a
 * logical studio group with a step eyebrow, section title, and optional hint.
 */
const StepPanel: React.FC<StepPanelProps> = ({ eyebrow, title, hint, children }) => (
  <section className={`${panelClass} space-y-5`}>
    <div className="space-y-1.5">
      <p className={eyebrowClass}>{eyebrow}</p>
      <h3 className={sectionTitleClass}>{title}</h3>
      {hint && <p className={helperClass}>{hint}</p>}
    </div>
    {children}
  </section>
);

export default StepPanel;
