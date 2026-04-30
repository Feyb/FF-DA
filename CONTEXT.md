# Context: Draft Assistant

Domain language for the draft-assistant frontend. Use these terms exactly when
naming files, classes, methods, signals, tests, and issue titles.

## Core terms

**DraftPlayerRow**
The shared, normalised row shape that callers (DraftStore, PlayersStore,
TeamViewStore) consume. Defined in `core/models`. Built by
`PlayerNormalizationService.buildPlayerRows()`. Carries identity + ranks/tiers
from every available ranking source plus computed `sleeperRank` and `adpDelta`.

**Ranking source**
An external feed of player rankings/values that contributes fields to
`DraftPlayerRow`. The available sources are: `ktc`, `flock`, `flockRookie`,
`fpAdp`, `fc`, `ffc`. Each is fetched by an adapter under `core/adapters/`.
Callers ask `PlayerNormalizationService` for a subset via the `sources` input.

**LeagueFormat**
The pair of facts that drive format-specific adapter fetches:
`{ isSuperflex, isRookie }`. 1QB vs Superflex affects which KTC/Flock/FantasyPros
file ships; rookie vs redraft affects which FantasyCalc/FFC variant applies.

**PlayerNormalizationService**
The single module that owns the pipeline external sources →
`DraftPlayerRow[]`. Callers pass a `LeagueFormat`, a season, and the
`RankingSource`s they care about; they never see adapter Maps.
