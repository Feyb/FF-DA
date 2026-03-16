# Plan: Sleeper Live Draft Assistant

Build a new Angular frontend app in this repo that connects to Sleeper draft state in real time, merges multi-source player value signals (Sleeper ADP and KeepTradeCut Rating + optional ESPN/Yahoo/FantasyPros/projection feeds), and outputs value-first recommendations that still enforce roster coverage by position (QB, RB, WR, TE) for 1QB, Superflex, and TE+ leagues. The approach is to separate concerns into ingest, normalization, ranking, and UI orchestration with a signal store and pluggable source adapters. A mock draft is not mocked data in a service its a real draft that is not beeing commited to the league, can be used to train the draft.

## Requirements:

Home
- the user can enter his sleeper name and based on the that the users leagues will be showing up. Alternatively you can enter the league id directly.
- the user can select his league.
  - all the other tabs are based on the selected league.

Team View Tab:
- The user can view his team he has on sleeper.
- The user can view his rating on the team he has based on KeepTradeCut combined with the Sleeper Rating
- The user can see the starters, bench, ingured reserve and his picks

Players Tab:
- The user can see all players
- the user can filter players by different criterias
 - players positions (QB, RB, WR, TE)
 - Rookies only
- Players can be sorterd by the player properties.
- if a draft is running its eighter a draft from the league or a mock draft you can enable that already picked players get striked out
- the default ordering of the players is based on the keeptradecut rankings and can be combined with the sleeper trankings
- in the players tab you can do a tier list (s,a,b,c,d) while s is the top tier and d the lowest tier
- the players will get a tag to quickly identify the tier

Draft Tab:
- The user can enter his draft url based on his leagues that have a draft open (mock drafts or real drafts)
- the draft sync every 1s.
- the draft page show the teams drafting and highlifts the one team next to pick
- the draft pages shows the row of the draft pick
- the draft page shows the already picked players
- the draft page shows the players in the buttom
  - the players can be starred and they will show up in another player list to quickly find starred players that the user likes to pick.
  - if the players is already picked remove the player from the starred list
  - the players can bne filter the same way as in the players tab.
  - the player also are sorted the same way as in the players tab.
  - the players are filtered based on the draft type. for eample a rookie draft only shows rookies for this years rookie class.
- the user can see the best avialable pick based on the tier list or based on keeptradecuts raiting.
  - the user has another recommended raiting call team need. this will be suggested based on the team needs. For example if the combined value of rbs are low or lower then most of the other teams it will recommend to pick an rb with the highest possible raiting available.
# Plan: Sleeper Live Draft Assistant

Build a new Angular app focused on live Sleeper draft assistance with four functional tabs (Home, Team View, Players, Draft), using Sleeper + KeepTradeCut as ranking inputs, with resilient fallbacks and league-aware recommendations.

## Steps

### Phase 1 - App bootstrap and routing foundation
- Scaffold pnpm monorepo with workspace config, root package.json, and `apps/draft-assistant/frontend` structure.
- Install and configure Angular Material v3 (MDC) with a custom M3 theme in `packages/theme`.
- Install and configure TailwindCSS in `packages/tailwind-config`; use `@apply` directive in CSS files for >5 utility classes.
- Create app shell using Material navigation (tab bar or nav rail) and lazy route structure for Home, Team View, Players, and Draft.
- Define shared domain models for League, Team, Player, Draft, DraftPick, RankingValue, TierTag, and filters.
- Establish signal-store based state slices for selected user, selected league, selected draft, and global loading/error statuses.

### Phase 2 - Data adapters and normalization
- Implement Sleeper adapter for username -> user lookup, leagues listing, league roster/team data, draft data, and players catalog.
- Implement KeepTradeCut adapter for client-side ratings ingestion.
- Build normalization/crosswalk service with Sleeper player_id as canonical identity key.
- Add source health tracking and fallback behavior: if KTC fails, use Sleeper ranking + warning banner.
- _Dependency: blocks Phase 3 and 4._

### Phase 3 - Ranking and recommendation engine
- Implement default ordering: KTC rank primary, Sleeper rank tie-breaker.
- Implement combined team score for Team View plus absolute per-position breakdown (QB, RB, WR, TE).
- Implement team-needs recommendation against league-average positional value baseline.
- Add rookie class filter inferred from current season year.
- _Dependency: depends on Phase 2._

### Phase 4 - Home and Team View
- Home: selected league drives all other tabs.
- Home: support both Sleeper username lookup and direct league-id entry as alternative sources.
- Home: render a flat list of leagues including league status (no extra filtering/search UI in V1).
- Team View: show starters, bench, IR, and future picks only.
- Team View: show combined team score and absolute per-position ratings only (no delta-vs-league in V1).
- _Dependency: depends on Phase 2 and Phase 3._

### Phase 5 - Players tab
- Implement all-players table with filters for positions and rookies-only.
- Implement sorting by player properties with default ranking from Phase 3.
- Implement tier tagging (S/A/B/C/D) with visible tag on each player row.
- Persist tiers and starred state in local storage per league, with JSON export/import backup support.
- If active draft selected, strike out picked players based on that currently selected draft only.
- _Dependency: depends on Phase 3 and shared selected draft state._

### Phase 6 - Draft tab and live sync
- Support selecting/opening draft context from league drafts.
- If multiple drafts are available, require explicit user draft selection (no auto-selection).
- Poll draft state every 1 second.
- Show teams drafting, highlight next-to-pick team, and show current pick row.
- Show picked players and available players panel with same filters/sorting behavior as Players tab.
- Implement star list in Draft tab and auto-remove starred players once picked.
- For rookie-only drafts, limit available player pool to inferred current rookie class.
- Implement recommendation panel with best available by tier/rank and team-need recommendation.
- On polling interruptions, show stale-data warning and auto-retry.
- _Dependency: depends on Phase 2, 3, and 5 filter/sort parity._

### Phase 7 - Verification and hardening
- Add unit tests for ranking merge logic, team-need scoring, rookie filtering, and picked-player exclusion.
- Add integration tests for league selection propagation and draft polling status transitions.
- Add manual validation checklist using real Sleeper public data and simulated KTC outage.

## Relevant files
- `apps/draft-assistant/frontend/src/app/app.routes.ts` — tab routes and lazy boundaries.
- `apps/draft-assistant/frontend/src/app/core/state/*` — signal store slices for app-wide state.
- `apps/draft-assistant/frontend/src/app/core/adapters/sleeper/*` — Sleeper API integration and mapping.
- `apps/draft-assistant/frontend/src/app/core/adapters/ktc/*` — KTC ingestion and availability flags.
- `apps/draft-assistant/frontend/src/app/core/ranking/*` — ranking merge and recommendation logic.
- `apps/draft-assistant/frontend/src/app/features/home/*` — username lookup and league selection.
- `apps/draft-assistant/frontend/src/app/features/team-view/*` — roster/picks/rating presentation.
- `apps/draft-assistant/frontend/src/app/features/players/*` — filtering/sorting/tiering.
- `apps/draft-assistant/frontend/src/app/features/draft/*` — live sync and draft board UX.
- `packages/theme/` — Angular Material M3 custom theme.
- `packages/tailwind-config/` — shared TailwindCSS config.

## Verification
1. Confirm Home tab loads leagues from Sleeper username and selection propagates to Team View, Players, and Draft.
2. Confirm direct league-id entry also populates the league list.
3. Confirm default player ordering is KTC primary with Sleeper tie-breaker.
4. Confirm KTC failure triggers warning banner and Sleeper-only fallback rankings.
5. Confirm Team View renders starters/bench/IR/future picks and shows combined + absolute positional scores.
6. Confirm Players tab filters/sorts, applies S/A/B/C/D tags, and persists via local storage with JSON export/import working.
7. Confirm Draft tab polls every second, highlights next picker, updates picked players, and removes picked starred players.
8. Confirm rookie-only draft mode constrains player pool to inferred current rookie class.
9. Confirm recommendation panel returns best available and team-need suggestion based on league-average positional deficits.

## Decisions
- Included in V1: Home, Team View, Players, Draft (all functional).
- UI stack: Angular Material v3 (MDC) for component primitives + TailwindCSS for layout and utility styling.
- TailwindCSS convention: use `@apply` in CSS files when applying >5 utility classes.
- Auth/access: Sleeper username lookup as primary; direct league-id entry as alternative.
- Data sources in V1: Sleeper + KeepTradeCut only.
- KeepTradeCut integration: client-side ingestion.
- Ranking: KTC default, Sleeper tie-break.
- Team need baseline: league average by position.
- Team View score display: absolute values only (no delta vs league average).
- League types in V1: 1QB, Superflex, Rookie-only drafts; TE+ excluded.
- Persistence: local storage per league with JSON export/import backup.
- Draft context for pick strikeout in Players: currently selected active draft.
- Rookie class: inferred from current season year.
- Team View picks: future picks only.
- Polling failure behavior: stale-data warning + auto-retry.
- Canonical player identity: Sleeper player_id.
- Multiple drafts available: force explicit user draft selection.
- Home league list UX: flat list with status only in V1 (no search/sort).
- Training mode (mock draft): same UX as live draft in V1.

## Further Considerations
1. Add optional search/sort to Home league list in V2 if users report navigation friction.
2. If client-side KTC integration faces CORS/rate-limit constraints, introduce a minimal proxy fallback without changing ranking logic.
3. If draft polling load becomes high, move from fixed 1s polling to adaptive interval when draft is paused/off-clock.
