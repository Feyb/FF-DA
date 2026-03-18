## Plan: Draft Tab MVP

Build the final Draft tab as a live, league-aware draft workspace on top of the existing Home, Team View, and Players foundations. The recommended MVP is: live pick board + available player pool + team-by-team draft history + starred players + recommendations, with KTC best available as the default recommendation mode. Use the existing Angular signal-store pattern from Players/Team View, keep polling-based sync rather than inventing realtime infrastructure, and reuse the current Sleeper + KTC normalization pipeline.

**Steps**
1. Phase 1 - Confirm draft data source and normalize the domain model
Add the missing draft-fetch path in the Sleeper adapter, preferring direct draft endpoints if available and otherwise falling back to roster pick snapshots. Extend the shared models with draft-specific view contracts for draft state, pick entries, draft teams, available-player rows, starred entries, and recommendation results. This blocks all later phases.
2. Phase 2 - Build the Draft feature store
Create a Draft store scoped to the Draft tab using the PlayersStore pattern: loading, error, stale-data state, polling state, selected filters, starred-player state, picked-player state, draft history, available pool, and recommendation state. Reuse AppStore selectedLeague and KTC lookup helpers. This depends on Phase 1.
3. Phase 3 - Implement polling and refresh behavior
Add polling with a 1 second cadence while the draft is active, plus manual refresh and stale-data detection. Keep the polling logic inside the Draft store/hooks so the component stays presentational. Add clear transitions for initial load, refresh success, refresh failure, and stale snapshot warning. This depends on Phase 2.
4. Phase 4 - Derive draft board and available player pool
Build computed selectors that transform raw draft + roster + player catalog + KTC data into: current pick context, full pick board, team-by-team draft history, picked-player id set, and remaining available player rows. Reuse the current active-player, rookie, no-team, and KTC enrichment rules already used in Players. This depends on Phase 2 and can run in parallel with Phase 3 once the raw state shape is settled.
5. Phase 5 - Add starred-player workflow
Persist a per-league starred-player list, expose toggle methods from the Draft store, render a starred panel, and automatically hide or mark starred players once drafted. Keep the persistence contract aligned with the existing AppStore local-storage approach, but scoped to draft data rather than global league selection. This depends on Phase 2 and can run in parallel with Phase 4.
6. Phase 6 - Add MVP recommendations
Start with KTC best available as the default recommendation section, based on the filtered available pool after picked-player removal. Structure the recommendation model so tier-first or team-need modes can be added later without changing the UI contract. This depends on Phase 4.
7. Phase 7 - Build the Draft tab UI
Replace the placeholder Draft component with a full standalone feature using external HTML/SCSS files. The UI should include: draft status/header, current pick summary, pick board, team-by-team history, available player list with filters, starred list, recommendation panel, loading/error/stale states, and empty states when no draft context exists. Reuse Material patterns already present in Team View and Players. This depends on Phases 3 through 6.
8. Phase 8 - Verification and edge cases
Validate active draft flow, completed draft flow, no-draft flow, polling recovery, empty KTC results, rookie-only filtering, and star persistence. Add at least targeted store/service tests for draft normalization, picked-player exclusion, star persistence, and recommendation ordering. This depends on all prior phases.

**Relevant files**
- `c:/Users/cafa/1_Repos/FF/apps/draft-assistant/frontend/src/app/features/draft/draft.component.ts` — replace the current placeholder and use it as the entry point for the Draft feature.
- `c:/Users/cafa/1_Repos/FF/apps/draft-assistant/frontend/src/app/core/adapters/sleeper/sleeper.service.ts` — add draft retrieval methods and any polling-facing mapping helpers.
- `c:/Users/cafa/1_Repos/FF/apps/draft-assistant/frontend/src/app/core/models/index.ts` — extend shared contracts with draft state, pick rows, available-player rows, and recommendation shapes.
- `c:/Users/cafa/1_Repos/FF/apps/draft-assistant/frontend/src/app/core/state/app.store.ts` — reuse selected league context and mirror its persistence pattern where appropriate.
- `c:/Users/cafa/1_Repos/FF/apps/draft-assistant/frontend/src/app/core/adapters/ktc/ktc-rating.service.ts` — reuse normalization, lookup building, and ranking metadata helpers.
- `c:/Users/cafa/1_Repos/FF/apps/draft-assistant/frontend/src/app/features/players/players.store.ts` — primary template for store structure, filtering, sorting, and KTC-enriched row derivation.
- `c:/Users/cafa/1_Repos/FF/apps/draft-assistant/frontend/src/app/features/team-view/team-view.store.ts` — reference for multi-source aggregation and per-league derived views.
- `c:/Users/cafa/1_Repos/FF/apps/draft-assistant/frontend/src/app/app.routes.ts` — verify the Draft route stays aligned with any new external template/style files.
- `c:/Users/cafa/1_Repos/FF/.github/draft-assistant-plan.md` — keep the repo-level status document aligned once Draft implementation lands.

**Verification**
1. Confirm the Draft tab loads from an already selected league without extra league-selection UI.
2. Confirm a live or simulated draft snapshot populates current pick, board, history, and available pool consistently.
3. Confirm polling updates picked players within 1 second and raises a stale-data warning when refresh fails.
4. Confirm available-player filtering matches the existing Players rules for position, rookies, inactive-player exclusion, and no-team exclusion.
5. Confirm starred players persist per league and disappear or clearly mark as drafted once selected.
6. Confirm the recommendation section defaults to KTC best available and excludes already picked players.
7. Confirm the Draft tab behaves sensibly for leagues with no active draft or a completed draft.
8. Confirm targeted tests cover draft normalization, picked-player exclusion, recommendation ordering, and star persistence.

**Decisions**
- Included in MVP: live pick board, available player pool, starred players, recommendations, and team-by-team draft history.
- Default recommendation strategy: KTC best available.
- Sync strategy: polling, not websocket/realtime infrastructure.
- State pattern: feature-scoped signal store, matching Players and Team View.
- Player filtering baseline: reuse existing Players rules to avoid divergent ranking pools.
- Explicitly excluded from this MVP: manual draft controls, dark-mode/theme work, export/import workflows, and non-KTC recommendation modes.

**Further Considerations**
1. If Sleeper draft endpoints are unavailable or inconsistent for some league states, fall back to roster pick snapshots first instead of blocking the whole feature.
2. If the Draft template becomes too dense, split the board, available pool, and starred/recommendation panels into small presentational components without moving ownership out of the Draft store.
3. If polling every second is noisy after draft completion, stop polling automatically once the draft is complete and keep a manual refresh action available.


**Draft Backlog From SleeperTierSite Analysis**
1. Add an explicit Draft Source switch: league drafts vs direct draft URL mode.
2. Improve draft selection UX with table fields for type, status, teams, rounds, and draft slot.
3. Compute and display the user draft position from draft_order and selected user id.
4. Add a latest pick card with player name, position, team, and pick number.
5. Implement adaptive polling intervals by status: drafting, pre_draft/paused, complete.
6. Add stale-state diagnostics: retry count, last successful sync age, force refresh action.
7. Recompute board and recommendations only when picks actually change.
8. Add My Team mini-panel grouped by position.
9. Add per-position remaining tier counts in Draft tab.
10. Add tier divider rows in available player lists to reveal tier cliffs.
11. Add avoid marker alongside favorites/stars and use both in recommendation ordering.
12. Add manual pick correction controls: drafted and undo for sync mismatch cases.
13. Add collapsible recent picks side panel with quick lookup.
14. Add ADP urgency signal: likely gone soon based on current round vs ADP.
15. Add custom projection lane with fallback to KTC and clear source labels.
16. Persist draft session state per draft id: selected draft, stars, avoids, manual corrections.
17. Normalize URL-loaded draft metadata and show type/scoring/name consistently.
18. Keep rookie-mode auto detection robust: player_type heuristic plus metadata/settings hints.
19. Add draft completion mode with post-draft summary and remaining top-by-tier snapshots.
20. Add dev-only diagnostics panel for draft status, poll cadence, payload timestamps.
21. Harden empty/error states for invalid draft ids, private drafts, and no picks yet.
22. Improve mobile layout with collapsible sections and sticky recommendation context.
23. Add telemetry events for polling interruptions, stale transitions, and recommendation interactions.
24. Add targeted tests for pick normalization, rookie detection, exclusion logic, and recommendation ranking.


**Implemented Since Last Plan Sync**
1. Rookie draft auto-detection now prioritizes `settings.player_type` with fallback metadata/type hints.
2. Direct draft URL mode is implemented end-to-end (draft id parsing, payload fetch, context hydration without league preselection).
3. Recommendation logic is tier-first and position-aware, limited to remaining top 3 tiers with max 3 players per tier.
4. Recommendation UI renders Tier -> Position grouping with stable ordering safeguards.
5. Recent picks show player names using a persisted player id -> full name map (id fallback retained).
6. Direct URLs are persisted in localStorage, shown in Draft context selection, and can be cleared with a dedicated action.


**Immediate Next 5 (Execution Queue)**
1. Add targeted tests for recommendation tier capping (top 3 remaining tiers, max 3 players per tier).
2. Add targeted tests for direct URL persistence and clear flow in Draft context selection.
3. Add targeted tests for recent pick player-name resolution with id fallback.
4. Improve draft selection UX with richer option metadata (type/status/teams/rounds/slot) while keeping grouped sources.
5. Implement adaptive polling cadence by draft status (`drafting`, `pre_draft`/paused, `complete`).


## Plan: Draft Recommendation Tier Capping

Update Draft recommendations so the panel only shows players from the remaining top 3 tiers, keeps Tier -> Position grouping, and enforces a maximum of 3 players per tier.

**Steps**
1. Update recommendation source filtering in `apps/draft-assistant/frontend/src/app/features/draft/draft.store.ts` inside `recommendations` computed signal: keep existing picked/position/rookie filters, then restrict to rows where `(positionalTier ?? overallTier)` is not null and within the top three remaining tier values.
2. Keep existing tier-first and position-second sorting in the same computed signal, then replace the flat cap with a per-tier cap pass so each tier contributes at most 3 players total.
3. Preserve current rendering structure in `apps/draft-assistant/frontend/src/app/features/draft/draft.component.html` (already Tier -> Position). Only adjust `apps/draft-assistant/frontend/src/app/features/draft/draft.component.ts` helper grouping if needed to ensure stable ordering after new capped output.
4. Verify that when one or more of tiers 1-3 are exhausted, the “remaining top 3 tiers” logic still selects the next three available tier levels (for example tiers 2, 3, and 4).
5. Run compile verification and spot-check in UI with rookies-only and position filters enabled to ensure no regression in recommendation visibility.

**Relevant files**
- `apps/draft-assistant/frontend/src/app/features/draft/draft.store.ts` — `recommendations` computed selector is the primary logic change.
- `apps/draft-assistant/frontend/src/app/features/draft/draft.component.ts` — `recommendationTierGroups` and `recommendationPositionGroups` may need minor ordering safeguards only.
- `apps/draft-assistant/frontend/src/app/features/draft/draft.component.html` — should remain as Tier -> Position grouped rendering.

**Verification**
1. For a populated draft pool, confirm output contains only 3 tier groups (the best remaining tiers available in data).
2. Confirm each tier group has no more than 3 total players across positions.
3. Confirm players inside each tier are grouped under position headers only.
4. Confirm picked players never appear and rookies-only filter still constrains recommendation pool.
5. Compile with `pnpm --dir apps/draft-assistant/frontend exec tsc -p tsconfig.app.json --noEmit`.

**Decisions**
- Scope includes recommendation data selection and ordering only.
- Scope excludes changes to available player list behavior and visual tier color mapping.
