---
name: angular-store
description: Build feature-level Signal Stores in Angular v20+ with @ngrx/signals. Use for implementing signalStore-based state management with entity adapters, computed selectors, query-param driven filtering, paginated/sorted resources, and mutation methods that integrate API services plus UI side effects. Triggers on creating or refactoring stores similar to shuttles.store.ts. Avoid for lightweight component state that does not require a shared feature store.
---

# Angular Signal Store

## Purpose

Use this skill when implementing feature stores that:

- Coordinate backend resources and UI-facing derived state
- Normalize or collect entities for list/detail features
- Bind URL query params to filter/sort/pagination inputs
- Expose stable computed view models for smart components
- Keep components thin by moving orchestration into store methods

## Invoke This Skill When

- Creating a new feature store with signalStore
- Refactoring BehaviorSubject or ad hoc service state into @ngrx/signals
- Adding computed selectors for table state (count, page index, active sorts, filtered results)
- Introducing withEntities for collection handling
- Adding mutation methods that call APIs and emit user notifications
- Standardizing store structure across features

## Do Not Use This Skill When

- State is local to one component and not reused
- A plain signal and computed in the component is enough
- Complex async stream modeling is already correctly handled in RxJS pipelines and should remain transport-layer observables
- The change is primarily presentational and not state-orchestration related

## Required Conventions

- Angular:
  - Use Angular v20+ patterns
  - Use inject() for dependencies
  - Keep side effects deterministic and explicit

- Store composition:
  - Define explicit store state interface for writable internal state
  - Use withProps for injected services and resources
  - Use withComputed for derived read models only
  - Use withMethods for commands and mutations
  - Use withEntities when list operations or entity indexing is needed

- Query/filter behavior:
  - Parse query params once in deepComputed
  - Keep filter mapping typed and explicit
  - Preserve backward compatibility for known legacy query formats if needed

- Async and resources:
  - Keep HTTP and stream boundaries in services/resources
  - Prefer resource wrappers for loading/value/error lifecycle
  - Avoid duplicated writable sources of truth between resources and store state

- Side effects:
  - API mutations belong in methods
  - Notification/dialog side effects must be centralized in methods, not templates
  - Keep success/error messaging consistent and actionable

## Quality Checklist

- State shape is minimal and intentional
- Derived values are computed, not recalculated in templates
- Pagination/sort/filter inputs are fully typed
- No business logic in components that should live in the store
- API methods return observable/promise consistently per existing feature pattern
- Error paths surface user feedback through notifications
- Naming follows feature vocabulary (for example shuttleQueryParams, shuttlesPageResource)

## Suggested Store Skeleton

import { computed, inject } from "@angular/core";
import { signalStore, withState, withProps, withComputed, withMethods } from "@ngrx/signals";
import { deepComputed } from "@ngrx/signals";
import { feragRxResource, NotificationsStore, QueryParamStore } from "@feyb/ui-common";

interface FeatureStoreState {
\_currentDialogRef: unknown | null;
}

export const FeatureStore = signalStore(
{ providedIn: "root" },

withState<FeatureStoreState>({ \_currentDialogRef: null }),

withProps(() => ({
\_api: inject(SomeApiService),
\_notifications: inject(NotificationsStore),
\_queryParamStore: inject(QueryParamStore),
})),

withComputed((store) => ({
requestParams: deepComputed(() => {
const queryParams = store.\_queryParamStore.queryParamMap();
return {
Search: queryParams.get("search") ?? undefined,
} satisfies SomeRequestParams;
}),
})),

withProps((store) => ({
pageResource: feragRxResource({
params: () => ({ queryParams: store.requestParams() }),
stream: ({ params }) => store.\_api.getPage(params.queryParams),
}),
})),

withComputed((store) => ({
totalCount: computed(() => store.pageResource.value()?.count ?? 0),
rows: computed(() => store.pageResource.value()?.items ?? []),
})),

withMethods((store) => ({
reload: () => store.pageResource.reload(),
runMutation: (params: SomeMutationParams) =>
store.\_api.runMutation(params),
})),
);

## Anti-Patterns

- Storing duplicated copies of resource data in writable state without reason
- Performing template-driven transformations that should be computed selectors
- Hiding side effects inside computed blocks
- Broad untyped query param mapping
- Mixing feature orchestration into component classes when store already exists

## References In This Workspace

- Example feature store: shuttles.store.ts
- Angular rules: [ angular.instructions.md ](../../instructions/angular.instructions.md)
