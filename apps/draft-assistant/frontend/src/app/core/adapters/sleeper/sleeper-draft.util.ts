import { League, SleeperDraft } from '../../models';
import { SLEEPER_DRAFT_PLAYER_TYPE } from './sleeper-draft-payload.templates';

export interface SleeperDraftPresentation {
  name: string;
  type: string;
  status: string;
  scoring: string;
}

export interface SleeperUserDraftPosition {
  slot: number;
  firstRoundPick: number;
  label: string;
}

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

const toPositiveInteger = (value: unknown): number | null => {
  const numeric = Number(value);
  if (!Number.isInteger(numeric) || numeric <= 0) {
    return null;
  }

  return numeric;
};

const titleize = (value: string): string =>
  value
    .split(/[_\-\s]+/)
    .filter((part) => part.length > 0)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(' ');

const firstNonEmpty = (...values: Array<string | null | undefined>): string | null => {
  for (const value of values) {
    const normalized = value?.trim();
    if (normalized) {
      return normalized;
    }
  }

  return null;
};

const isSuperflexLeague = (league: League | null | undefined): boolean =>
  !!league?.roster_positions?.includes('SUPER_FLEX');

export const getSleeperDraftStatusLabel = (draft: SleeperDraft): string =>
  titleize(draft.status ?? 'unknown');

export const getSleeperDraftTypeLabel = (draft: SleeperDraft): string => {
  const metadataType = firstNonEmpty(draft.metadata?.['type']);
  if (metadataType) {
    return titleize(metadataType);
  }

  const draftType = firstNonEmpty(draft.type);
  if (draftType) {
    return titleize(draftType);
  }

  if (isSleeperRookieDraft(draft)) {
    return 'Rookie';
  }

  return 'Unknown';
};

export const getSleeperDraftNameLabel = (draft: SleeperDraft): string => {
  const metadataName = firstNonEmpty(draft.metadata?.['name']);
  if (metadataName) {
    return metadataName;
  }

  const metadataType = firstNonEmpty(draft.metadata?.['type']);
  if (metadataType) {
    return titleize(metadataType);
  }

  const draftType = firstNonEmpty(draft.type);
  if (draftType) {
    return titleize(draftType);
  }

  return 'Unnamed Draft';
};

export const getSleeperDraftScoringLabel = (
  draft: SleeperDraft,
  league: League | null | undefined,
): string => {
  const metadataScoring = firstNonEmpty(
    draft.metadata?.['scoring_type'],
    draft.metadata?.['scoring'],
    draft.metadata?.['format'],
  );
  if (metadataScoring) {
    return titleize(metadataScoring);
  }

  if (isSuperflexLeague(league)) {
    return 'Superflex';
  }

  if (league) {
    return '1QB';
  }

  return 'Unknown';
};

export const getSleeperDraftPresentation = (
  draft: SleeperDraft,
  league: League | null | undefined,
): SleeperDraftPresentation => ({
  name: getSleeperDraftNameLabel(draft),
  type: getSleeperDraftTypeLabel(draft),
  status: getSleeperDraftStatusLabel(draft),
  scoring: getSleeperDraftScoringLabel(draft, league),
});

export const getSleeperUserDraftPosition = (
  draft: SleeperDraft,
  userId: string | null | undefined,
): SleeperUserDraftPosition | null => {
  if (!userId) {
    return null;
  }

  const slotValue = draft.draft_order?.[userId];
  const slot = toPositiveInteger(slotValue);
  if (slot === null) {
    return null;
  }

  const teams = toPositiveInteger(draft.settings?.['teams']);
  const label = teams
    ? `1.${String(slot).padStart(String(teams).length, '0')}`
    : `Slot ${slot}`;

  return {
    slot,
    firstRoundPick: slot,
    label,
  };
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
