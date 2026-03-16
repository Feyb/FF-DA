---
name: angular-di
description: Implement dependency injection in Angular v20+ using inject(), injection tokens, and provider configuration. Use for service architecture, providing dependencies at different levels, creating injectable tokens, and managing singleton vs scoped services. Triggers on service creation, configuring providers, using injection tokens, or understanding DI hierarchy.
---

# Angular Dependency Injection

Use this skill when implementing or refactoring dependency injection in Angular v20+ code.

## Primary Goal

Apply DI in a way that is:

- Explicit and type-safe.
- Scoped correctly (root vs feature vs route vs component).
- Consistent with the standalone/provider model used in this repo.
- Compatible with Skyfall and shared `@feyb/ui-common` wiring.

## Official References

- https://angular.dev/guide/di
- https://angular.dev/guide/di/defining-dependency-providers
- https://angular.dev/api/core/inject
- https://angular.dev/api/core/InjectionToken

## Core Rules

- Prefer `inject()` over constructor injection in new/updated code.
- Use `providedIn: "root"` for stateless/shared singleton services unless feature scoping is required.
- Use `InjectionToken<T>` for non-class dependencies (config objects, factories, primitive values).
- Use `multi: true` only when collecting multiple implementations under a token.

## Scoping Decisions

Choose provider scope by lifecycle intent:

- Root app-wide singleton: service with `providedIn: "root"`.
- App bootstrap provider composition: `app.config.ts` or app provider factory.
- Route subtree scope: route-level `providers`.
- Component-local scope: `@Component({ providers: [...] })` only when local state isolation is required.

## Skyfall Patterns To Mirror

- Bootstrap-level provider composition in app config.
- Route-level providers for feature-specific store isolation.
- Component-level providers for local side-sheet/dialog state where needed.
- Signal-store services and API services injected via `inject()`.

Representative examples:

- `apps/skyfall/frontend/src/app/app.config.ts`
- `apps/skyfall/frontend/src/app/tools/generic-strategy/generic-strategy.routes.ts`
- `apps/skyfall/frontend/src/app/transports/components/transports.component.ts`

## Injection Tokens and Config

- Use typed `InjectionToken<T>` for config and abstract dependencies.
- Prefer token factories for simple root defaults where appropriate.
- Avoid untyped tokens and string-based magic values.

## Route And Provider Composition

- Keep provider composition centralized when it affects platform-level behavior.
- Put feature-only providers as close as practical to the feature route/component.
- Avoid hidden singleton coupling by documenting non-obvious scopes.

## Migration Guidance

When touching legacy constructor/decorator-heavy code:

- Migrate incrementally to `inject()`.
- Keep public API and behavior stable.
- Do not broaden provider scope unintentionally during refactors.
- Add focused tests when scope/lifecycle behavior changes.

## Anti-Patterns To Avoid

- Providing stateful services at root when feature isolation is required.
- Re-providing root singletons in many components without reason.
- Injecting primitives without typed tokens.
- Creating circular dependencies instead of extracting interfaces/tokens.

## Authoring Checklist

Before finishing DI-related changes, verify:

- `inject()` is used for new injection points.
- Scope matches intended lifecycle.
- Tokens are strongly typed.
- Provider location is intentional and documented by structure.
- No accidental duplicate providers causing split instances.
