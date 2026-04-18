## Requirements:

Home
- the user can enter his sleeper name and based on the that the users leagues will be showing up. Alternatively you can enter the league id directly.
- the user can select his league.
  - all the other tabs are based on the selected league.
- **[implemented]** season selector in the username tab: user can choose which NFL season (2020–current year) to load leagues for; selection is persisted to localStorage and defaults to the current year.

Team View Tab:
- The user can view his team he has on sleeper.
- The user can view his rating on the team he has based on KeepTradeCut combined with the Sleeper Rating
- The user can see the starters, bench, ingured reserve and his picks

Players Tab:
- The user can see all players
- the user can filter players by different criterias
 - players positions (QB, RB, WR, TE)
 - Rookies only
- **[implemented]** real-time player name search/filter: a search field above the table filters displayed rows by name, combined with the existing position and rookie filters.
- Players can be sorterd by the player properties.
- if a draft is running its eighter a draft from the league or a mock draft you can enable that already picked players get striked out
- the default ordering of the players is based on the keeptradecut rankings and can be combined with the sleeper trankings
- in the players tab you can do a tier list (s,a,b,c,d) while s is the top tier and d the lowest tier
- the players will get a tag to quickly identify the tier
- **[implemented]** KTC staleness indicator: an amber banner is shown when the KTC asset data is more than 1 day old, displaying the age in days and the last-synced date. No banner when data is fresh or metadata is unavailable.

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
## 2. App Shell

- **[implemented]** Hybrid navigation: fixed left sidebar (240 px) on desktop (≥ 768 px) with icon + label nav items, league context block, and a settings footer.
- **[implemented]** Settings footer contains a dark mode toggle and a density icon button that opens a `mat-menu` overlay with radio buttons (Default, Compact −1 … −5).
- **[implemented]** Mobile (< 768 px): Material 3 styled bottom navigation bar with icon + pill indicator + label. The sidebar is hidden on mobile.
- **[implemented]** The top `mat-toolbar` has been removed. The logo and app title now live in the sidebar header.
- **[implemented]** `NAV_LINKS` constant (`app/shared/nav-links.constant.ts`) is the single source of truth for nav destinations (Home, Team, Players, Draft).
- **[implemented]** Density and dark-mode effects are owned by `AppNavComponent` (moved from `AppComponent`).

# Plan: Sleeper Live Draft Assistant
