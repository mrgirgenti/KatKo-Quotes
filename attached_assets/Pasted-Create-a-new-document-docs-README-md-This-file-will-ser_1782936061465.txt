Create a new document:

/docs/README.md

This file will serve as the entry point for all engineering documentation in this repository.

Do not create a placeholder.

Write a professional README that explains:

==========================================================
PURPOSE
==========================================================

Explain that the /docs folder contains the permanent engineering standards for the Katalyst KO platform.

These documents are considered part of the application and must evolve alongside the software.

==========================================================
DOCUMENT OVERVIEW
==========================================================

Document each file:

IMPLEMENTATION_DEFINITION_OF_DONE.md

Explain that it defines how every implementation is completed.

----------------------------------------------------------

ARCHITECTURE_PRINCIPLES.md

Explain that it defines module ownership, system boundaries, architectural rules, and approved terminology.

----------------------------------------------------------

BUSINESS_RULES.md

Explain that it defines how the business operates.

Business rules are authoritative.

Implementation must conform to business rules.

----------------------------------------------------------

UI_DESIGN_SYSTEM.md

Explain that it defines the application's visual language, component hierarchy, spacing, colors, typography, and UI behavior.

==========================================================
READING ORDER
==========================================================

Explain that developers and AI agents should review documents in this order:

1. BUSINESS_RULES.md

2. ARCHITECTURE_PRINCIPLES.md

3. UI_DESIGN_SYSTEM.md

4. IMPLEMENTATION_DEFINITION_OF_DONE.md

==========================================================
WHEN TO UPDATE DOCUMENTATION
==========================================================

Explain that documentation must be updated whenever:

• Business rules change

• Architecture changes

• New modules are introduced

• UI standards change

• Terminology changes

• Engineering practices change

Documentation is part of implementation.

==========================================================
CONFLICT RESOLUTION
==========================================================

Document this precedence order:

Business Rules

↓

Architecture Principles

↓

UI Design System

↓

Implementation Definition of Done

If implementation conflicts with documentation, the conflict should be identified before implementation begins.

==========================================================
OUTPUT
==========================================================

Commit the new README to source control.

Summarize the file after completion.