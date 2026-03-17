import { SleeperDraft } from '../../models';
import { SLEEPER_DRAFT_PLAYER_TYPE } from './sleeper-draft-payload.templates';

export const extractSleeperDraftId = (input: string): string | null => {
  const normalized = input.trim();
  if (!normalized) {
    return null;
  }

  const directId = normalized.match(/^\d{10,}$/);
  if (directId) {
    return directId[0];
  }

  const sleeperUrl = normalized.match(/sleeper\.com\/draft\/nfl\/(\d{10,})/i);
  if (sleeperUrl) {
    return sleeperUrl[1];
  }

  return null;
};

const isTruthyFlag = (value: unknown): boolean => {
  const normalized = String(value ?? '').toLowerCase().trim();
  return normalized === '1' || normalized === 'true' || normalized === 'yes' || normalized === 'on';
};

const toNumericSetting = (value: unknown): number | null => {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
};

export const isSleeperRookieDraft = (draft: SleeperDraft): boolean => {
  const playerType = toNumericSetting(draft.settings?.['player_type']);
  if (playerType === SLEEPER_DRAFT_PLAYER_TYPE.ROOKIES_ONLY) {
    return true;
  }

  const type = (draft.type ?? '').toLowerCase();
  if (type.includes('rookie')) {
    return true;
  }

  const metadataEntries = Object.entries(draft.metadata ?? {});
  if (
    metadataEntries.some(([key, value]) =>
      key.toLowerCase().includes('rookie')
        ? isTruthyFlag(value) || String(value ?? '').trim().length === 0
        : String(value ?? '').toLowerCase().includes('rookie'),
    )
  ) {
    return true;
  }

  const settingsEntries = Object.entries(draft.settings ?? {});
  return settingsEntries.some(([key, value]) =>
    key.toLowerCase().includes('rookie')
      ? isTruthyFlag(value)
      : String(value ?? '').toLowerCase().includes('rookie'),
  );
};
