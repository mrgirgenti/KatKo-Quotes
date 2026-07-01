# Katalyst Ko Engineering Documentation

This folder contains the permanent engineering standards for the **Katalyst Ko Quote Tracker 5000** platform. These documents are not supplementary — they are considered part of the application itself and must evolve alongside the software. When behavior changes, when architecture shifts, or when a new module is introduced, the relevant document in this folder is updated as part of that implementation.

---

## Documents

### [ROADMAP.md](./ROADMAP.md)
The authoritative source for the long-term product direction of the platform. Documents the current development phase, approved future modules, deferred features, explicitly rejected ideas, and major architectural milestones. Any implementation that introduces a new module, changes product direction, or builds something listed as Deferred or Won't Build must reference this document first.

Covers: Current Project Status, Current Development Phase, Phased Roadmap (Phases 1–5), Approved Modules, Deferred Features, Won't Build, Architectural Milestones, and Roadmap Maintenance rules.

---

### [BUSINESS_RULES.md](./BUSINESS_RULES.md)
Defines how the business operates. This is the authoritative source for what the application is supposed to do and why. It contains business logic only — no implementation details, no code references. Implementation must conform to business rules. When a developer or AI agent needs to understand whether a behavior is correct, this document provides the answer.

Covers: Quotes, Line Items, Products, Pricing, Mockups, Client Hub, Organizations, Contacts, Settings, Files, and a library of general business rules distilled from development history.

---

### [ARCHITECTURE_PRINCIPLES.md](./ARCHITECTURE_PRINCIPLES.md)
Defines module ownership, system boundaries, approved data flows, and architectural rules. It establishes which system owns which data, what each module is and is not responsible for, and what patterns are explicitly forbidden. It also defines the application's approved terminology — the canonical names for every module, concept, and pricing bucket. Using alternative names for these concepts is an architectural violation.

Covers: Quote Builder, Mockup Builder, Cost Configuration, Pricing Engine (five-bucket model), Line Item and ConfiguredProduct ownership, Data Ownership for all entities, Settings, Forbidden Patterns, Approved Terminology, and Future Architecture.

---

### [UI_DESIGN_SYSTEM.md](./UI_DESIGN_SYSTEM.md)
Defines the application's visual language. All new UI must be built from the tokens and patterns in this document. It covers every layer of the visual stack — from color hex values and their semantic token names, through typography, spacing, and border radius systems, to component-level rules for buttons, forms, tables, cards, dialogs, and responsive behavior.

Covers: Color Palette, Typography, Border Radius, Header Hierarchy, Spacing, Buttons, Forms, Tables, Cards, Dialogs, Responsive Behavior, and Future Standards.

---

### [IMPLEMENTATION_DEFINITION_OF_DONE.md](./IMPLEMENTATION_DEFINITION_OF_DONE.md)
Defines what it means for a feature to be complete. Every implementation task is evaluated against this document before it is marked done. It begins with two mandatory rules that apply before any code is written — the Clarification Rule (stop and ask before inventing business decisions) and Feature Classification (identify the category and affected systems). It then provides system-level impact checklists, persistence and pricing verification checklists, testing requirements, and the required deliverable format every task must close with.

Covers: Clarification Rule, Feature Classification, Non-Goals, Feature Planning, System Impact Review (15 systems), Persistence Checklist, Pricing Checklist, UI Checklist, Testing Requirements, Architecture Review, Cross-Module Verification, and Required Deliverable.

---

## Engineering Workflow

Every implementation task follows this three-phase sequence.

**Phase 1 — Before writing code**
1. Identify the feature category (`IMPLEMENTATION_DEFINITION_OF_DONE.md` → Feature Classification).
2. Review the applicable documents from this folder.
3. Identify any conflicts between the request and the documented standards.
4. Surface conflicts before implementation begins — never implement silently against a standard.
5. Apply the Clarification Rule: if a business decision is unspecified, stop, present options, and wait for approval.

**Phase 2 — During implementation**
- Apply the Non-Goals discipline: make the smallest change that fully solves the stated problem.
- Verify applicable system impact checklists from `IMPLEMENTATION_DEFINITION_OF_DONE.md`.

**Phase 3 — Before marking done**
- Complete the Final Implementation Checklist in `IMPLEMENTATION_DEFINITION_OF_DONE.md`.
- Determine whether any document in this folder requires an update.
- Close every task with the Required Deliverable summary (Files Modified, Components Modified, Database Changes, API Changes, Tests Added, Documentation Updated, Remaining Work).

"Documentation Updated" must always be answered — either name what changed or explicitly state why no update was required. Silence on documentation is not acceptable.

---

## Reading Order

Developers and AI agents beginning work on this codebase should read these documents in the following order:

| # | Document | Why first |
|---|---|---|
| 1 | **BUSINESS_RULES.md** | Understand what the application is supposed to do before understanding how it does it |
| 2 | **ARCHITECTURE_PRINCIPLES.md** | Understand system boundaries, ownership, and approved terminology |
| 3 | **UI_DESIGN_SYSTEM.md** | Understand the visual language before touching any UI |
| 4 | **IMPLEMENTATION_DEFINITION_OF_DONE.md** | Understand the completion standard before starting any task |

---

## When to Update Documentation

Documentation must be updated as part of the implementation that changes it. It is not a post-task cleanup item.

Update the relevant document whenever:

- **Business rules change** — update `BUSINESS_RULES.md`
- **Architecture changes** — update `ARCHITECTURE_PRINCIPLES.md`
- **New modules are introduced** — update both `ARCHITECTURE_PRINCIPLES.md` and `BUSINESS_RULES.md`
- **UI standards change** — update `UI_DESIGN_SYSTEM.md`
- **Terminology changes** — update the Approved Terminology section of `ARCHITECTURE_PRINCIPLES.md` and all affected documents simultaneously
- **Engineering practices change** — update `IMPLEMENTATION_DEFINITION_OF_DONE.md`
- **New forbidden patterns are discovered** — add them to the Forbidden Patterns table in `ARCHITECTURE_PRINCIPLES.md`
- **New business rules are established** — add them to the General Business Rules section of `BUSINESS_RULES.md`

Documentation is part of implementation. A task that changes behavior without updating the relevant document is not done.

---

## Conflict Resolution

When an implementation decision conflicts with documentation, the conflict must be identified and resolved **before implementation begins** — not discovered after the fact. If you find yourself implementing something that contradicts a document, stop and surface the conflict.

Precedence order when documents appear to conflict with each other:

```
Business Rules
      ↓
Architecture Principles
      ↓
UI Design System
      ↓
Implementation Definition of Done
```

Business Rules take highest precedence because they define what is correct. Architecture Principles define how to implement correctly. The UI Design System defines how it looks. The Implementation Definition of Done defines the process for getting there. A lower-precedence document never overrides a higher-precedence one.
