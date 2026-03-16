---
name: angular-signals
description: Implement signal-based reactive state management in Angular v20+. Use for creating reactive state with signal(), derived state with computed(), dependent state with linkedSignal(), and side effects with effect(). Triggers on state management questions, converting from BehaviorSubject/Observable patterns to signals, or implementing reactive data flows.
---

# Angular Signals

Use this skill when implementing or refactoring reactive state in Angular v20+ code.

## Primary Goal

Adopt signal-based state that is:

- Predictable and explicit (`set`/`update`).
- Derived with `computed()` instead of duplicated writable state.
- Side-effect safe with narrow `effect()` usage.
- Compatible with Observable boundaries and existing APIs.

## Official References

- https://angular.dev/guide/signals
- https://angular.dev/guide/signals/linked-signal
- https://angular.dev/api/core/Signal
- https://angular.dev/api/core/linkedSignal
- https://angular.dev/api/core/rxjs-interop/toObservable
- https://angular.dev/guide/ecosystem/rxjs-interop

## Core Signal APIs

- `signal(initial)` for writable local state.
- `computed(() => ...)` for pure derived values.
- `effect(() => ...)` for side effects only.
- `linkedSignal(...)` when state is usually derived but must remain user-overridable.

Update rules:

- Use `.set(next)` for replacement semantics.
- Use `.update(prev => next)` when next depends on previous.
- Do not use `mutate()`.

## Choosing Between `computed` and `linkedSignal`

- Use `computed` if the value must always be derived from dependencies.
- Use `linkedSignal` if there is a computed default that users/workflow can override.
- For `linkedSignal`, prefer the `{ source, computation }` form when previous state matters.

## RxJS Interop Rules

- Keep Observables at async/transport boundaries (HTTP, route streams, websocket/event streams).
- Use `toSignal(observable)` once per stream and reuse the returned signal.
- Use `toObservable(signal)` when a signal-backed value must feed an RxJS pipeline.
- Use `takeUntilDestroyed(...)` for manual subscriptions.
- Keep conversion at boundary layers, not scattered across templates and deep helpers.

## Signal Store Patterns In This Repo

Skyfall uses `@ngrx/signals` heavily for feature stores.

Preferred structure:

- `signalStore(...)` with `withProps`, `withState`, `withComputed`, `withMethods`, `withHooks`.
- Query/filter state derived with `computed` or `deepComputed`.
- Async resources represented with `resource(...)` or `feragRxResource(...)`.
- UI consumes computed selectors/signals; components stay thin.

Representative examples:

- `apps/skyfall/frontend/src/app/transports/transports.store.ts`
- `apps/skyfall/frontend/src/app/maintenance/maintenance.store.ts`
- `apps/skyfall/frontend/src/app/messages/messages.store.ts`

## Component-Level Signal Patterns

- Use signals for local interaction state (selected rows, toggles, pending flags).
- Build enable/disable and visibility logic with `computed`.
- Keep template expressions simple and read signals directly.

Representative examples:

- `apps/skyfall/frontend/src/app/maintenance/components/maintenance-station/maintenance-station.component.ts`
- `apps/skyfall/frontend/src/app/shuttles/components/shuttle-actions/shuttle-actions.component.ts`
- `apps/skyfall/frontend/src/app/messages/components/message-actions/message-actions.component.ts`

## Migration Guidance

When migrating from RxJS-heavy or decorator-era code:

- Migrate incrementally.
- Keep service transport APIs stable first; migrate component-facing state before backend-facing contracts.
- Replace derived `BehaviorSubject` chains with `computed` where synchronous derivation is enough.
- Preserve behavior and contract names while changing internals.
- Add focused tests around derived selectors and side effects.

## Anti-Patterns To Avoid

- Multiple writable sources for the same conceptual state.
- Effects that both derive and mutate unrelated state.
- Creating `toSignal` repeatedly for the same Observable.
- Subscriptions without `takeUntilDestroyed` (or without clear cleanup ownership).
- Business logic in templates.

## Authoring Checklist

Before finishing signal-related changes, verify:

- Writable state uses `signal`.
- Derived state uses `computed` (or `linkedSignal` when override semantics are required).
- Side effects are isolated and deterministic.
- Observable interop points are minimal and intentional.
- Store/component APIs remain readable and typed.
