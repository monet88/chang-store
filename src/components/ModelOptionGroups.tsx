import React from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { type SelectableModel } from '../types';

/**
 * Picker options, grouped by what discovery knows about them. A single verified group renders
 * as plain options (no optgroup), so a picker that never ran discovery looks exactly as before.
 */
export const ModelOptionGroups: React.FC<{ options: readonly SelectableModel[] }> = ({ options }) => {
  const { t } = useLanguage();
  const served = options.filter((option) => !option.disabled && !option.unverified);
  const unverified = options.filter((option) => option.unverified);
  const missing = options.filter((option) => option.disabled);

  return (
    <>
      {served.map((option) => (
        <option key={option.modelId} value={option.modelId}>{option.label}</option>
      ))}
      {unverified.length > 0 && (
        <optgroup label={t('modelSelector.unverified')}>
          {unverified.map((option) => (
            <option key={option.modelId} value={option.modelId}>{option.label}</option>
          ))}
        </optgroup>
      )}
      {missing.length > 0 && (
        <optgroup label={t('error.gateway.modelNotServed')}>
          {missing.map((option) => (
            <option key={option.modelId} value={option.modelId} disabled>{option.label}</option>
          ))}
        </optgroup>
      )}
    </>
  );
};
