---
name: generateArchitectureReport
description: Generates a high-level architectural report of a codebase or project module.
argument-hint: "Please specify the project or module name for which you want to generate the architecture report."
agent: agent
---

Generate an architecture report for the specified project or module. The report should include an executive summary, a folder roadmap, a description of the core logic flow, identified architectural patterns, and an overview of the technical stack and dependencies. Use the following template for the report:

# Architecture Report: ${project_or_module_name}

## 1. Executive Summary

Provide a high-level summary of what this code does and its primary architectural style (3-5 sentences).

## 2. Folder Roadmap

| Directory      | Role          | Key Responsibility                                 |
| :------------- | :------------ | :------------------------------------------------- |
| `[path](link)` | {e.g. Domain} | {e.g. Contains pure business logic and interfaces} |

## 3. Core Logic Flow

Describe the lifecycle of a primary action, e.g., "A request enters via `/api`, is validated by `middleware`, and processed by the `service` layer."

## 4. Architectural Patterns Found

- **{Pattern Name}**: {How it is implemented in this specific repo}.

## 5. Technical Stack & Dependencies

- **Core**: {Framework/Language}
- **State/Data**: {Database/Store}
- **Communication**: {REST}
