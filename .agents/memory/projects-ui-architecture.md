---
name: Projects UI architecture (Global vs Org)
description: Two separate project experiences that must NOT share UI
---

# Two project experiences — keep them separate

There are two intentionally distinct project views. They must not converge.

## Global Projects — operational command center
- File: `app/(tabs)/projects.tsx` (sidebar → Projects).
- Company-wide. Desktop renders a dense data TABLE (`ProjectRow`) with columns
  (Status, Order Date, Due, Client, Project, Invoice#, Applicators, Services,
  PCS, Total, Markup, Actions/View) plus a metrics row, status filter pills,
  search, and sort controls. Mobile falls back to `ProjectCard`.
- This is the production/workflow tool. Future ops features (Production, Tasks,
  Reporting) belong HERE.

## Organization Projects — client relationship view
- File: `app/crm/[id].tsx` (Org Detail → Overview sections + Projects tab).
- Client-specific. Uses the compact `ProjectCard` everywhere — never the table.
- Three views share the same `ProjectCard` system and must stay identical:
  Overview "Active Projects", Overview "Submitted Quotes", and the dedicated
  Projects tab (sub-tabs: Active / All Quotes / Completed + search).

**Rule:** the Org Projects views must NOT inherit Global Projects' table layout,
sort controls, or bulk/workflow management UI. Card-based, relationship-focused.

**Why:** they serve different purposes (operations vs relationship). Both already
import `ProjectCard` from `@/components/ProjectCard`; CRM does not import anything
from the tabs Projects page. Don't refactor them into one shared screen.
