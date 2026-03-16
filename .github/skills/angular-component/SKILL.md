---
name: angular-component
description: Create modern Angular standalone components following v20+ best practices. Use for building UI components with signal-based inputs/outputs, OnPush change detection, host bindings, content projection, and lifecycle hooks. Triggers on component creation, refactoring class-based inputs to signals, adding host bindings, or implementing accessible interactive components.
---

# Angular Component

Use this skill when creating or refactoring Angular components in this workspace.

## Primary Goal

Build Angular v20+ standalone components that are:

- Signal-first for UI state and derived values.
- OnPush by default.
- Cleanly separated into TypeScript, template, and style files.
- Aligned with official Angular docs and current Skyfall app patterns.

## Official References

- https://angular.dev/guide/components
- https://angular.dev/guide/components/inputs
- https://angular.dev/guide/components/outputs
- https://angular.dev/guide/components/host-elements
- https://angular.dev/guide/templates/control-flow
- https://angular.dev/style-guide

## Required Component Defaults

- Use standalone components.
- Do not add `standalone: true` unless compatibility requires it.
- Set `changeDetection: ChangeDetectionStrategy.OnPush` unless there is a documented reason not to.
- Prefer `inject()` over constructor injection.
- Keep templates declarative; move logic to TypeScript.

## Inputs, Outputs, and Two-Way APIs

Prefer the function-based APIs:

- `input()` and `input.required()` for incoming data.
- `output()` for custom events.
- `model()` when a two-way value is intentionally exposed.

Input guidance:

- Use defaults where possible (`input(defaultValue)`).
- Use transforms for coercion/parsing (for example boolean/number coercion).
- Use aliases only when required for compatibility.

Output guidance:

- Keep event names semantic and stable.
- Emit typed payloads (`output<MyPayload>()`) when events carry data.
- Avoid `EventEmitter` + decorators in new code.

## Signals and Derived State

- Use `signal()` for local writable UI state.
- Use `computed()` for derived values.
- Use `effect()` only for clearly scoped side effects.
- Avoid duplicate writable sources of truth.

When bridging to Observables:

- Keep Observables at transport boundaries (HTTP, route streams, long-lived async streams).
- Convert at the edge when needed; do not spread conversions throughout templates.

## Template Rules

- Use Angular control flow blocks: `@if`, `@for`, `@switch`.
- Always define a stable `track` expression in `@for`.
- Do not place arrow functions or object allocation logic in templates.
- Prefer class/style bindings over `ngClass`/`ngStyle` where practical.
- Use async pipe for Observable rendering.

## Host Bindings and Events

- Prefer the `host` property in component metadata for host bindings/listeners.
- Avoid new usage of `@HostBinding` and `@HostListener` except when migrating legacy code.

## Skyfall Patterns to Mirror

Use these patterns observed in Skyfall as the default implementation style:

- Signal-based inputs with transforms and required semantics.
- Computed view models for action enablement and filtered data.
- OnPush on the vast majority of components.
- Native control-flow blocks in templates.
- Service/data access in stores/services, not in dumb presentational components.

Representative examples:

- `apps/skyfall/frontend/src/app/shared/components/filters/filters.component.ts`
- `apps/skyfall/frontend/src/app/maintenance/components/maintenance-station/maintenance-station.component.ts`
- `apps/skyfall/frontend/src/app/tools/syf-utils/order-generator/customer-extension-list/customer-extension-list.component.ts`

## Legacy Interop and Migration

Some Skyfall components still use legacy APIs (`@Input`, `@Output`, `EventEmitter`, explicit `standalone: true`).

When touching these files:

- Prefer incremental migration over broad rewrites.
- Convert inputs/outputs first.
- Keep behavior and template contracts stable.
- Add focused tests for changed component contracts.

Representative legacy example:

- `apps/skyfall/frontend/src/app/tools/syf-utils/station-drop-down/station-drop-down.component.ts`

## Styling Guidance

- Keep component styles in dedicated stylesheet files for medium/large components.
- Follow workspace Tailwind rules: when a CSS block would require more than 5 utility classes inline, move repeated styling into component stylesheet classes and use `@apply`.

## Authoring Checklist

Before finishing a component change, verify:

- Component uses OnPush.
- Inputs/outputs use modern function APIs unless migration constraints block it.
- Derived state is computed, not duplicated.
- Template uses `@if/@for/@switch` and stable tracking.
- No complex imperative logic in template.
- Accessibility basics are covered (labels, keyboard flow, semantic actions).

If these are not possible, document why in the PR or adjacent code comments.
