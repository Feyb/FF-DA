---
name: angular-routing
description: Implement routing in Angular v20+ applications with lazy loading, functional guards, resolvers, and route parameters. Use for navigation setup, protected routes, route-based data loading, and nested routing. Triggers on route configuration, adding authentication guards, implementing lazy loading, or reading route parameters with signals.
---

# Angular Routing

Use this skill when editing or creating routing in Angular v20+ apps in this repo.

Primary source of truth is Skyfall routing in `apps/skyfall/frontend`, with shared contracts from `libs/ui/common`.

## Official References

- https://angular.dev/guide/routing
- https://angular.dev/guide/routing/define-routes
- https://angular.dev/guide/routing/route-guards
- https://angular.dev/guide/routing/data-resolvers
- https://angular.dev/api/router/Route

## When To Use

- Add or refactor app route trees.
- Add or restructure feature route files.
- Add lazy feature boundaries.
- Add functional guards or resolvers.
- Implement tenant-specific route overrides.

## Invocation Contract

When this skill is invoked, collect these inputs first:

- Target app and feature scope.
- Route ownership location: app shell, feature, or tenant overlay.
- Guard and resolver requirements.
- Tenant impact and navigation metadata impact.

The skill must output:

- Concrete route config updates.
- Required navigation metadata updates.
- Guard and resolver placement notes.
- Verification checklist with tenant and direct-URL behavior.

Stop and ask for clarification when:

- Auth requirements are ambiguous.
- Tenant behavior is unclear.
- The same path appears in multiple route trees with conflicting ownership.

## Core Feyb Routing Model

Define routing with shared types from @feyb/ui-common:

- FeragRouting
- FeragRoute
- TenantRouting
- FeragNavigationItem

Model rules:

- FeragRouting.routes is the executable router tree.
- FeragRouting.navigationRail and toolMenu define navigation UI metadata.
- TenantRouting.pathPrefix defines tenant URL prefixes in development mode.
- TenantRouting.tenantRouting allows tenant-level overrides.

Reference:

- libs/ui/common/src/lib/routing/index.ts

## Primary Goal

Ship route changes that are:

- Lazy-loaded where appropriate.
- Guarded with functional guards at the right boundary.
- Resolver-safe and parameter-aware.
- Consistent with navigation metadata and tenant overlays.

## Skyfall Decision Matrix

Choose route edit location by intent:

- App shell route tree and primary navigation: apps/skyfall/frontend/src/app/app.routes.ts
- Feature-local route composition: apps/skyfall/frontend/src/app/\*\*/<feature>.routes.ts
- Tools subtree composition: apps/skyfall/frontend/src/app/tools/tools.routes.ts
- Development tenant entry/preview routes: apps/skyfall/frontend/src/environments/routing/development.routing.ts
- Tenant-specific override routes: apps/skyfall/frontend/src/environments/routing/<tenant>.routing.ts

Do not place tenant-only behavior in base app routes unless all tenants require it.

## Route Composition Patterns

Use Skyfall route layout as the default project pattern.

- Keep top-level feature boundaries lazy-loaded with loadChildren.
- Keep default redirect route at path "".
- Use nested children for sub-features.
- Use route-level providers only where feature-local state scoping is needed.

References:

- apps/skyfall/frontend/src/app/app.routes.ts
- apps/skyfall/frontend/src/app/tools/tools.routes.ts
- apps/skyfall/frontend/src/app/tools/generic-strategy/generic-strategy.routes.ts

## Guard Placement Rules

Use functional guards only.

- Use canMatch for feature visibility and route matching control.
- Use canActivateChild for broad protection of a child branch.
- Use canActivate for specific leaf/branch activation checks.
- Place guards at the highest sensible parent route to avoid duplication.
- Avoid repeating identical guard arrays across many leaf routes.

Authentication and feature-flag references:

- libs/ui/common/src/lib/auth/auth.guard.ts
- apps/skyfall/frontend/src/app/app.features.ts

## Resolver Rules

Use functional ResolveFn and explicit async boundaries.

Resolver acceptance criteria:

- Validate required route params before data access.
- Trigger data retrieval through store/service boundaries.
- Return explicit and stable resolver output types.
- Handle failure paths with clear fallback behavior.
- Keep resolver logic independent from component lifecycle code.

Skyfall reference:

- apps/skyfall/frontend/src/app/tools/generic-strategy/generic-strategy.routes.ts

## Navigation Consistency Rules

When adding user-visible routes:

- Review navigationRail and toolMenu for matching entries.
- Keep title, path, symbol, badge, and hierarchy consistent.
- Ensure tenant overrides intentionally diverge from base navigation, not accidentally.

Reference:

- apps/skyfall/frontend/src/app/app.routes.ts

## Tenant Routing Rules

Keep tenant routing in environment routing files.

- Start from base routing object.
- Add development-only routes in development routing.
- Add tenants array with pathPrefix and optional tenantRouting override.
- In tenant files, append only tenant-specific route and navigation deltas.
- Avoid full tree duplication when only partial overrides are needed.

References:

- apps/skyfall/frontend/src/environments/routing/development.routing.ts
- apps/skyfall/frontend/src/environments/routing/sephora.routing.ts

## Router Provisioning Rules

Routing provider behavior should remain centralized.

- Merge auth routes first when auth is enabled.
- Merge environment routes next.
- In development mode, generate tenant-prefixed wrappers.
- Always include catch-all not-found route.
- Keep router features:
  - withEnabledBlockingInitialNavigation
  - withComponentInputBinding
  - withRouterConfig({ paramsInheritanceStrategy: "always" })

References:

- libs/ui/common/src/lib/routing/index.ts
- libs/ui/common/src/lib/Feyb-application.provider.ng.ts

## Verification

Verify every routing change with both static and runtime checks.

Static checks:

- Lint and type-check affected app/package.
- Confirm no duplicate/conflicting paths in the same branch.

Manual checks:

- Direct URL navigation to new routes.
- Guard redirect behavior for unauthenticated and unauthorized users.
- Tenant-prefixed and non-tenant URLs in development mode.
- Not-found fallback path behavior.
- Title, breadcrumb, and navigation entry visibility.

## Common Failure Modes

- Route added but unreachable because parent lazy boundary is missing.
- canMatch guard applied too high and blocks unrelated routes.
- Tenant override unintentionally duplicates base tree and changes precedence.
- Navigation entry points to a route not present for that tenant.
- Resolver never emits a value because param validation or fetch trigger is incomplete.

## Scope Boundaries

This skill is focused on Skyfall + shared libs routing architecture.

Out of scope:

- DoWarehouse-specific implementation examples.
- Backend/auth provider redesign.
- Component-level state architecture changes beyond route guards/resolvers.

## Quick Skeletons

### App routing object

```ts
import { FeragRoute, FeragRouting } from "@feyb/ui-common";

export const appRoutes: FeragRoute[] = [
	{
		path: "feature",
		loadChildren: () => import("./feature/feature.routes").then((m) => m.featureRoutes),
	},
	{
		path: "",
		redirectTo: "feature",
		pathMatch: "full",
	},
];

export const appRouting = {
	routes: appRoutes,
	navigationRail: [{ path: "feature", title: "Feature", symbol: "view_module" }],
} satisfies FeragRouting;
```

### Tenant override routing

```ts
import { FeragRouting } from "@feyb/ui-common";
import { appRoutes, appRouting } from "../../app/app.routes";

export const tenantRouting: FeragRouting = {
	...appRouting,
	routes: [
		{
			path: "tools/custom",
			loadChildren: () => import("../../app/tools/custom/custom.routes").then((m) => m.customRoutes),
		},
		...appRoutes,
	],
};
```

## Authoring Checklist

Before finishing routing changes, verify:

- Route ownership location is correct (app, feature, or tenant overlay).
- Lazy boundary choice (`loadChildren`/`loadComponent`) is intentional.
- Guards are functional and placed at the minimal correct level.
- Resolver behavior is deterministic and handles missing params/failures.
- Navigation metadata is synchronized with user-visible route changes.
- Direct URL and tenant-prefixed URL navigation both work.
