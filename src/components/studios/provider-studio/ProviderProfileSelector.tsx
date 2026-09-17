import React from 'react';
import { useLanguage } from '../../../contexts/LanguageContext';
import { useApi } from '../../../contexts/ApiProviderContext';
import { useServedModels } from '../../../hooks/useServedModels';

/** Driver ids the provider studios can be pointed at (mirrors `ImageDriverId`). */
export type StudioDriverId = 'openai-images' | 'grok-images';

/**
 * Which image-lane gateway this studio uses, and whether its served models are known.
 *
 * A profile is picked before a model (the operator's own mental model: "provider này có model
 * gì"), and a profile belongs to exactly one driver, so a studio only ever lists its own lane.
 */
export const ProviderProfileSelector: React.FC<{ driver: StudioDriverId }> = ({ driver }) => {
  const { t } = useLanguage();
  const { imageProfiles, selectImageProfile, servedModelsVersion, imageProfileForDriver } = useApi();
  const profiles = imageProfiles.filter((profile) => profile.driver === driver);
  const activeProfile = imageProfileForDriver(driver);
  const served = useServedModels(activeProfile?.baseUrl, activeProfile?.apiKey, servedModelsVersion);

  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={`provider-profile-${driver}`} className="text-sm font-medium text-zinc-300">
        {t('studio.profile.label')}
      </label>
      <select
        id={`provider-profile-${driver}`}
        aria-label={t('studio.profile.label')}
        value={activeProfile?.id ?? ''}
        onChange={(event) => selectImageProfile(event.target.value || null)}
        className="rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-zinc-100 focus:border-white/30 focus:outline-none"
      >
        {profiles.length === 0 && <option value="">{t('studio.profile.none')}</option>}
        {profiles.map((profile) => (
          <option key={profile.id} value={profile.id}>
            {profile.label || profile.id}
          </option>
        ))}
      </select>
      <p className="text-xs text-zinc-500">
        {served
          ? t('studio.profile.servedModels', { count: served.length })
          : t('studio.profile.notChecked')}
      </p>
    </div>
  );
};

export default ProviderProfileSelector;
