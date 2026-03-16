---
name: angular-forms
description: Build Angular forms with a reactive, typed-first approach in Angular v20+. Use for form creation, validation, dynamic controls, and component/store integration. Triggers on form implementation, adding validators, multi-step workflows, and conditional form UX.
---

# Angular Forms

Use this skill when implementing or refactoring forms in Angular v20+ code.

## Primary Goal

Build forms that are:

- Reactive and maintainable.
- Strongly typed where practical.
- Validation-driven in TypeScript (not template-heavy logic).
- Aligned with Skyfall usage patterns and Angular official guidance.

## Official References

- https://angular.dev/guide/forms
- https://angular.dev/guide/forms/reactive-forms
- https://angular.dev/guide/forms/form-validation

## Repo Default Approach

- Prefer Reactive Forms for non-trivial forms.
- Keep form creation and validators in TypeScript.
- Use Angular Material form controls consistently with existing feature code.
- Keep form submission and side effects in methods/services/stores, not templates.

## Reactive Forms Rules

- Model controls with `FormGroup`, `FormControl`, and `FormArray`.
- Keep validation in validator functions (built-in + custom).
- Use cross-field validators at the group level when business rules span fields.
- Update control validators based on business mode changes when needed.

## Skyfall Patterns To Mirror

- Dynamic validator switching based on selected mode/workflow state.
- Signal-backed view state around form data (for editable tables, staged edits, etc.).
- Form interaction with stores/services via explicit submit/update handlers.

Representative examples:

- `apps/skyfall/frontend/src/app/tools/syf-utils/order-generator/generator-form/generator-form.component.ts`
- `apps/skyfall/frontend/src/app/tools/syf-utils/order-generator/create-customer-extension/create-customer-extension.component.ts`
- `apps/skyfall/frontend/src/app/tools/syf-utils/profile/profile-create-dialog/profile-create-dialog.component.ts`

## Validation Guidance

- Use built-in validators first (`required`, `min`, etc.).
- Keep custom validators in shared validator services/helpers when reused.
- Show validation errors based on control interaction state and submission flow.
- Avoid duplicating the same validation rule in multiple places.

## Signals + Forms Interop

- Keep the form model in Reactive Forms primitives.
- Use signals for surrounding UI state (edit modes, selected rows, filtered lists, pending states).
- Convert between forms and signals only at explicit boundaries.

## Migration Guidance

When touching legacy or untyped forms:

- Migrate incrementally.
- Start by tightening the most error-prone controls first.
- Preserve existing UX behavior and validation messages.
- Add tests around validators and submission branching.

## Anti-Patterns To Avoid

- Business logic embedded in template expressions.
- Form rules split inconsistently across template and TS.
- Untyped `any` form payload plumbing when clear types are possible.
- Subscriptions without teardown when listening to value/status streams.

## Authoring Checklist

Before finishing form-related changes, verify:

- Form model is clear and reactive.
- Validators are centralized and testable.
- Submission/update handlers are explicit.
- UI state around forms is isolated and readable.
- Error messages and disabled states match business intent.
