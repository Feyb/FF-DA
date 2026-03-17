# Draft Assistant Plan And Current Status

This document reflects the actual state of `apps/draft-assistant/frontend` as of March 17, 2026.

## Goal

Build an Angular draft assistant for Sleeper leagues with four tabs:

- Home
- Team View
- Players
- Draft

The app is intended to use Sleeper as the league source of truth and KeepTradeCut as the primary ranking source.

## Current Snapshot

The app exists and boots as an Angular 20 standalone application with lazy routes for all four tabs. The current implementation is strongest in Home, Team View, and Players. Draft is still a placeholder.

Implemented today:

- Angular 20 app with Angular Material and Tailwind in place.
- Lazy routes for `home`, `team`, `players`, and `draft`.
- App shell with toolbar, tab navigation, and active league shown in the header.
- Local storage persistence for selected Sleeper user and selected league.
- Local storage persistence for the last entered Sleeper username on the Home page.
- Home flow for username lookup and direct league-id lookup.
- Team View data loading from Sleeper rosters, league users, player catalog, and live KTC parsing.
- Team View roster grouping into starters, bench, IR, and future picks.
- Team View combined and per-position scoring, roster selector fallback, league rankings panel, player headshots, and tier coloring.
- Players view with KTC-enriched rows, position filters, rookies-only filter, sort controls, tier-colored rows, and expandable detail rows.

Not implemented today:

- Functional Draft tab.
- Recommendation engine.
- Persisted player tiers, starred players, and export/import workflow.
- Completed fallback ranking and scoring behavior when KTC is unavailable.
- Custom Material theme from the provided token set.
- Dark mode switch in the toolbar.
- Automated tests.

## Phase Status

### Phase 1 - App bootstrap and routing foundation

Status: Mostly complete

Done:

- Angular application exists at `apps/draft-assistant/frontend`.
- Angular Material is installed and used throughout the app.
- Tailwind is configured and used in styles.
- App shell and lazy routes are present.
- Shared models exist for core domain data.
- App-level signal store exists for selected user and selected league.

Current limitations:

- The app is using the default light Angular Material theme in `src/styles.scss`.
- The requested custom Material token theme has not been applied.
- The requested dark-mode toggle has not been implemented.

### Phase 2 - Data adapters and normalization

Status: Partially complete

Done:

- Sleeper adapter is implemented for user lookup, league lookup, roster loading, league users, and player catalog access.
- KTC adapter is implemented by fetching `/ktc/dynasty-rankings` and extracting `playersArray` from the returned HTML.
- KTC name normalization and lookup map generation are implemented.
- KTC fields currently used include value, rank, positional rank, overall tier, positional tier, rookie, team, and age.

Current limitations:

- Cross-source identity still relies mainly on normalized player names for KTC matching instead of a stronger canonical join.
- Source health exists only in a minimal form.
- KTC failure handling is inconsistent with the original plan. The code still exposes `ktcUnavailable`, but full fallback ordering and scoring are not fully implemented end-to-end.

### Phase 3 - Ranking and recommendation engine

Status: Partially complete

Done:

- Team View computes a combined team score and absolute per-position scores for QB, RB, WR, and TE.
- KTC-first player enrichment is implemented in Team View and Players.
- Rookie filtering is supported in Players.
- Inactive players are filtered out in Players.
- Free agents without a team are filtered out unless KTC marks them as rookies.

Current limitations:

- There is no completed recommendation engine yet.
- League-average positional need analysis is not implemented.
- The intended Sleeper tie-breaker behavior is not represented cleanly in the current code.
- Fallback scoring logic is not fully wired even though a legacy helper still exists in the KTC service.

### Phase 4 - Home and Team View

Status: Mostly complete

Done:

- Home supports Sleeper username lookup.
- Home supports direct league-id lookup.
- Home automatically reloads leagues when a saved username is found in local storage.
- Selected user and selected league persist in local storage.
- Selected league is shown in the app toolbar.
- Team View loads automatically when a league is selected.
- Team View shows starters, bench, IR, and future picks.
- Team View shows combined score and absolute positional scores.
- Team View shows league-wide standings on the right side.
- Team View shows player headshots with fallback images.
- Team View cards display KTC rank, positional rank, value, tier, age, experience, and injury status.
- Team View groups starters and bench by position and applies positional tier coloring.
- Team View includes a positional tier legend.

Current limitations:

- The active league is shown in the toolbar, but there is no theme toggle there yet.
- Team View still uses `ngClass` for tier class application instead of pure class bindings.
- The current scoring warning text still references Sleeper fallback scoring even though the fallback path is not fully implemented.

### Phase 5 - Players tab

Status: Partially complete

Done:

- Players view loads live player data from Sleeper and KTC.
- Default view is KTC-centric.
- Position filters are implemented.
- Rookies-only filter is implemented.
- Sorting controls are implemented for default, KTC value, name, position, team, and age.
- Player rows are tier-colored using positional tier.
- Expand and collapse details rows are implemented.
- Player headshots are rendered with a fallback image.
- Additional player details shown today include rookie flag, Sleeper rank, overall tier, positional tier, KTC rank, and KTC value.
- The template was moved out of the TypeScript file into `players.component.html`.

Current limitations:

- The component still keeps a large inline `styles` block in `players.component.ts` instead of using `players.component.scss`.
- Persisted manual tier edits are not implemented.
- Starred players are not implemented.
- Export and import backup is not implemented.
- Draft-aware pick strikeout is not implemented.

### Phase 6 - Draft tab and live sync

Status: Not started

Current state:

- `draft.component.ts` is still a placeholder component that renders “Draft — coming soon”.

Missing work:

- Draft selection.
- Live polling.
- Pick board.
- Available player pool.
- Star list.
- Rookie-only draft handling.
- Recommendations.
- Stale-data recovery UX.

### Phase 7 - Verification and hardening

Status: Not started

Missing work:

- Unit tests.
- Integration tests.
- Formal validation checklist.

## Current File Ownership

- `apps/draft-assistant/frontend/src/app/app.routes.ts` - lazy route setup for Home, Team, Players, and Draft.
- `apps/draft-assistant/frontend/src/app/app.component.ts` - shell-level navigation and toolbar state.
- `apps/draft-assistant/frontend/src/app/app.component.html` - toolbar with active league and tab nav.
- `apps/draft-assistant/frontend/src/app/core/state/app.store.ts` - persisted selected user and league.
- `apps/draft-assistant/frontend/src/app/core/adapters/sleeper/sleeper.service.ts` - Sleeper API integration.
- `apps/draft-assistant/frontend/src/app/core/adapters/ktc/ktc-rating.service.ts` - KTC HTML fetch, parse, lookup build, and team score helpers.
- `apps/draft-assistant/frontend/src/app/core/models/index.ts` - shared app models including KTC and Team View types.
- `apps/draft-assistant/frontend/src/app/features/home/home.store.ts` - username and league loading.
- `apps/draft-assistant/frontend/src/app/features/home/home.component.ts` - Home inputs and persisted username behavior.
- `apps/draft-assistant/frontend/src/app/features/team-view/team-view.store.ts` - roster loading, KTC enrichment, standings, and scoring.
- `apps/draft-assistant/frontend/src/app/features/team-view/team-view.component.ts` - Team View presentation logic.
- `apps/draft-assistant/frontend/src/app/features/team-view/team-view.component.html` - grouped roster, cards, legend, and standings UI.
- `apps/draft-assistant/frontend/src/app/features/players/players.store.ts` - player filtering, sorting, and row derivation.
- `apps/draft-assistant/frontend/src/app/features/players/players.component.ts` - Players view logic and currently inline styles.
- `apps/draft-assistant/frontend/src/app/features/players/players.component.html` - Players table and expandable detail rows.
- `apps/draft-assistant/frontend/src/app/features/draft/draft.component.ts` - placeholder Draft tab.
- `apps/draft-assistant/frontend/src/styles.scss` - default Material light theme and global styles.

## Current Gaps To Prioritize

1. Implement the real Draft tab before adding more polish elsewhere.
2. Finish KTC-unavailable fallback behavior so warnings match actual runtime behavior.
3. Apply the requested custom Material theme and add the toolbar dark-mode switch.
4. Move Players inline styles into `players.component.scss` to match repository Angular conventions.
5. Add tests for KTC parsing, player filtering, Team View scoring, and persistence flows.

## Verification Status

Working in the current codebase:

- App routes for all four tabs.
- Persisted Sleeper username, user, and selected league.
- Home league loading and selection.
- Team View roster analysis and standings display.
- Players filtering, sorting, tier coloring, and expanded metadata rows.
- KTC parsing from the proxied rankings page.

Still unverified or incomplete:

- Full KTC outage fallback behavior.
- Draft workflows.
- Dark theme behavior.
- Automated test coverage.
