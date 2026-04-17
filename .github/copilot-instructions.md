# Feyb Workspace - AI Coding Assistant Instructions

For Angular Instructions look at the angular.instructions.md file. It contains instructions for all Angular related skills. Below is a skill selection matrix to help you choose which skill to apply based on the type of edit.

## Project Focus

- Primary app target is the draft assistant under `apps/draft-assistant/frontend`.
- Prefer guidance that supports live Sleeper draft sync, ranking/tier logic, and resilient external data adapters.
- Treat legacy app instructions as secondary unless the edited files are inside those app folders.

## Skill Selection Matrix

Use project skills plus Angular skills based on edit type:

- Component or widget UI changes:
  - `angular-component`
  - `angular-signals`
- Service and dependency wiring:
  - `angular-di`
- Forms and widget config UIs:
  - `angular-forms`
- Routing and navigation:
  - `angular-routing`
- use context7 mcp for updated docuemntations not angular related

## App-Specific Instruction Files

- Additional app-specific instruction settings are located in `.github/instructions/*.instructions.md`.
- Draft Assistant rules are defined in the Draft Assistant instruction file.
- Skyfall rules are defined in the Skyfall instruction file.
- DoWarehouse rules are defined in the DoWarehouse instruction file.
