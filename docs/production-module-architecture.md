# Katalyst Production — Module Architecture Plan

> **Status:** DESIGN ONLY — no code in this document. Prepared for the build phase.
> **Scope:** The Production module that turns a paid Project into a fulfilled order.
> **Anchored in:** the existing data layer (`Project.frontendStatus`, `lineItemsData` JSON,
> `QuotesContext`, the client portal, and the reports stack). This plan extends those
> patterns rather than replacing them.

---

## 0. Executive Summary

Production becomes the operational heart of Katalyst once a Project is **Paid**. Today the
app collapses all of production into a single `production_started` status with a simple
per-line-item "mark done" screen. This plan replaces that with a **two-level production
model**:

1. **Project-level production status** — a 13-stage pipeline (Art Needed → … → Completed)
   that answers "where is this whole order?" and drives the Kanban/List/Calendar board and
   the client-facing pipeline.
2. **Production tasks** — granular, assignable, method-aware work units (Design, Ordering,
   Printing, Embroidery, DTF, Finishing, Delivery) that answer "who is doing what, by when?"
   and feed the production KPIs.

The central design decision is that **Printing / Embroidery / DTF are parallel method
stages, not sequential steps**. A single order can require all three. The status pipeline
treats "Production" as one macro phase; the *method* is a property of each line item and is
tracked through method tasks and board swimlanes. The stored `productionStatus` reflects the
order's dominant/active state, while true parallelism lives in the task layer.

---

## 1. Where Production Fits — Macro Lifecycle

```
  QUOTE                PROJECT                 PRODUCTION                  DONE
  ┌──────────┐         ┌──────────┐            ┌──────────────────┐       ┌───────────┐
  │ draft    │         │ accepted │            │ 13-stage         │       │ completed │
  │ quoting  │  ──▶    │ paid     │   ──▶      │ production       │  ──▶  │ delivered │
  │ quoted   │         │ active   │            │ pipeline         │       │ archived  │
  │ invoice  │         │          │            │ (this module)    │       │           │
  └──────────┘         └──────────┘            └──────────────────┘       └───────────┘
   sales.tsx            projects.tsx            production board            reports.tsx
                                                (NEW)
```

- **Entry gate:** a Project enters Production when `frontendStatus` becomes `active` /
  `production_started` (today triggered by `startProduction()` in `QuotesContext` after
  Paid). On entry, the Project gets a `productionStatus` of **Art Needed** (or **Ready For
  Production** if art + garments are already settled — see auto-skip rules in §3.3).
- **Exit gate:** when `productionStatus` reaches **Completed**, the macro `frontendStatus`
  rolls up to `completed` (the existing `markProjectComplete()` behavior), and the order
  flows into Reports/History.

> **Why a separate `productionStatus` field instead of expanding `frontendStatus`:** the
> macro lifecycle (Quote→Project→Production→Done) is shared with Sales, the Projects board,
> and the client portal pipeline. Overloading `frontendStatus` with 13 new values would
> pollute every status pill, KPI, and filter across Sales/Projects. A dedicated
> `productionStatus` keeps the two concerns independent and lets the Production board own its
> own state machine.

---

## 2. The 13 Production Statuses — Grouped Into Phases

The required statuses map onto **6 phases**. Phases are how the board groups columns, how
the client pipeline is simplified, and how KPIs bucket time-in-stage.

| # | Production Status   | Phase          | Owner role (default) | Parallel? |
|---|---------------------|----------------|----------------------|-----------|
| 1 | Art Needed          | **Art**        | DESIGNER             | no        |
| 2 | Art Approved        | **Art**        | DESIGNER → SALES     | no        |
| 3 | Garments Ordered    | **Sourcing**   | PRODUCTION           | no        |
| 4 | Garments Received   | **Sourcing**   | PRODUCTION           | no        |
| 5 | Ready For Production | **Sourcing**   | PRODUCTION           | no        |
| 6 | Printing            | **Production** | PRODUCTION/applicator| **yes**   |
| 7 | Embroidery          | **Production** | applicator           | **yes**   |
| 8 | DTF                 | **Production** | PRODUCTION/applicator| **yes**   |
| 9 | Finishing           | **Production** | PRODUCTION           | no        |
| 10| Quality Control     | **QC**         | PRODUCTION           | no        |
| 11| Ready For Pickup    | **Fulfillment**| SALES/PRODUCTION     | no (xor 12)|
| 12| Delivered           | **Fulfillment**| SALES/PRODUCTION     | no (xor 11)|
| 13| Completed           | **Done**       | system               | no        |

**Method statuses (6/7/8)** are selected by each line item's `serviceStyle`:

| Line item `serviceStyle` (types/quote.ts) | Method status |
|-------------------------------------------|---------------|
| `Screen Printing`                         | Printing      |
| `Direct to Film`                          | DTF           |
| `Embroidery`                              | Embroidery    |
| `Promotional`                             | (Finishing — usually outsourced/assembled) |

---

## 3. Workflow Diagrams

### 3.1 Production State Machine (happy path + branches)

```
            ┌─────────────┐  art on file / re-order
            │ Art Needed  │ ─────────────────────────────┐
            └──────┬──────┘                               │
        revision  │  approve                              │
        ◀─────────┤                                       │
            ┌──────▼──────┐                               │
            │ Art Approved│                               │
            └──────┬──────┘                               │
                   │  (client garments? skip ▼)           │
            ┌──────▼────────┐  client-provided garments   │
            │Garments Ordered│ ──────────────────┐        │
            └──────┬─────────┘                    │        │
                   │ received                     │        │
            ┌──────▼─────────┐                    │        │
            │Garments Received│                   │        │
            └──────┬─────────┘                    │        │
                   ▼                              ▼        ▼
            ┌──────────────────────────────────────────────┐
            │            Ready For Production               │
            └───────────────────┬──────────────────────────┘
                                │  dispatch by method (PARALLEL)
        ┌───────────────────────┼───────────────────────────┐
        ▼                       ▼                            ▼
  ┌───────────┐          ┌────────────┐               ┌───────────┐
  │ Printing  │          │ Embroidery │               │   DTF     │
  └─────┬─────┘          └─────┬──────┘               └─────┬─────┘
        └───────────────────────┼───────────────────────────┘
                                ▼  all method tasks done
                         ┌─────────────┐
                         │  Finishing  │  (fold, tag, pack, promo assembly)
                         └──────┬──────┘
                                ▼
                         ┌──────────────┐   defect ──▶ back to Printing/Finishing
                         │Quality Control│ ◀───────────────┐
                         └──────┬───────┘                  │
                   pickup ┌─────┴─────┐ delivery           │
                          ▼           ▼                    │
                 ┌────────────────┐ ┌───────────┐          │
                 │Ready For Pickup│ │ Delivered │          │
                 └────────┬───────┘ └─────┬─────┘          │
                          └───────┬───────┘                │
                                  ▼                         │
                            ┌───────────┐                   │
                            │ Completed │───────────────────┘
                            └───────────┘   (rolls frontendStatus → completed)
```

### 3.2 Parallel multi-method order (the key case)

```
Order #1042  (Ready For Production)
  ├─ Line A: 100 tees   Screen Printing ──▶ [Printing task]   ──▶ done
  ├─ Line B: 100 tees   Embroidery      ──▶ [Embroidery task] ──▶ done   ──▶ Finishing
  └─ Line C: 50 hoodies DTF             ──▶ [DTF task]         ──▶ done

Rollup rule: project.productionStatus = least-advanced active method until ALL method
tasks are DONE, then advance to Finishing. Board shows the card in the "Production" group
with method chips [SP][EMB][DTF] and a progress ring (2/3 methods complete).
```

### 3.3 Auto-skip / fast-path rules (entry into production)

- **Art already approved** (re-order, or client-supplied print-ready file): start at
  **Garments Ordered** (or **Ready For Production** if garments are also handled).
- **Client-provided garments** (`apparelProvider === "** Client Provided"`): skip Garments
  Ordered/Received → **Ready For Production**.
- **Single-method order:** `productionStatus` can land directly on the concrete method
  status (Printing/Embroidery/DTF) instead of the generic Production group.

### 3.4 Task lifecycle

```
TODO ──▶ IN_PROGRESS ──▶ DONE
  │           │
  └──▶ BLOCKED◀┘   (blocked surfaces on queue + card; requires reason)
```

---

## 4. Schema Recommendations

> **Pattern to honor:** the runtime reads via a raw `pg` Pool, and the operational status
> is the **string** `Project.frontendStatus`, not the Prisma `ProjectStatus` enum. Line
> items live in `Project.lineItemsData` (JSON), not normalized `ProjectItem` rows. To stay
> consistent and avoid the "DB column mismatch" gotcha, new production status uses a
> **plain String column + a TypeScript union** (mirroring `QuoteStatus`), and tasks
> reference line items by their **JSON line-item id (string)**, not a `ProjectItem` FK.

### 4.1 New columns on `Project`

```prisma
model Project {
  // ... existing fields ...
  productionStatus      String?    // TS union: 'art_needed' | 'art_approved' | ... | 'completed'
  productionStartedAt   DateTime?  // stamped when entering production (turnaround clock start)
  productionCompletedAt DateTime?  // stamped at Completed (turnaround clock stop)
  productionDueDate     DateTime?  // production target; defaults from inHandsDate
  isRush                Boolean    @default(false) // mirror/raise from priority == RUSH
  productionAssigneeId  String?    // lead producer; FK to User (PRODUCTION role)

  productionTasks       ProductionTask[]
  productionEvents      ProductionStatusEvent[]

  @@index([productionStatus])
  @@index([productionDueDate])
}
```

> `priority PriorityLevel (LOW/NORMAL/RUSH)` already exists — `isRush` is a denormalized
> convenience for fast board/queue filtering and sorting; keep `priority` as source of truth
> and derive `isRush` on write.

### 4.2 `ProductionTask` (heart of Task Integration)

```prisma
enum ProductionTaskType {
  ART          // design / proof
  ORDERING     // source garments
  PRINTING     // screen print run
  EMBROIDERY   // embroidery run
  DTF          // direct-to-film run
  FINISHING    // fold, tag, pack, promo assembly
  QC           // quality control
  DELIVERY     // ship / hand-off / pickup prep
  OTHER
}

enum ProductionTaskStatus { TODO  IN_PROGRESS  BLOCKED  DONE }

model ProductionTask {
  id              String   @id @default(uuid())
  projectId       String
  lineItemId      String?  // id of an entry inside Project.lineItemsData (string, NOT a FK)
  type            ProductionTaskType
  status          ProductionTaskStatus @default(TODO)
  title           String
  description     String?
  assignedToUserId String?            // FK User
  applicator      String?             // from APPLICATORS list (e.g. "Show & Tell Tees")
  quantity        Int?                // pieces this task covers (for "Pieces Produced" KPI)
  dueDate         DateTime?
  startedAt       DateTime?
  completedAt     DateTime?
  blockedReason   String?
  sortOrder       Int      @default(0)
  isRush          Boolean  @default(false)
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  project         Project  @relation(fields: [projectId], references: [id], onDelete: Cascade)
  assignedToUser  User?    @relation(fields: [assignedToUserId], references: [id], onDelete: SetNull)

  @@index([projectId])
  @@index([assignedToUserId])
  @@index([status])
  @@index([type])
  @@index([dueDate])
}
```

### 4.3 `ProductionStatusEvent` (for turnaround / on-time / time-in-stage KPIs)

```prisma
model ProductionStatusEvent {
  id           String   @id @default(uuid())
  projectId    String
  fromStatus   String?
  toStatus     String
  changedByUserId String?
  createdAt    DateTime @default(now())

  project      Project  @relation(fields: [projectId], references: [id], onDelete: Cascade)

  @@index([projectId])
  @@index([toStatus])
  @@index([createdAt])
}
```

> Could instead be derived from the existing `ActivityLog` (with `actionType =
> 'production_status_changed'` and `metadata { from, to }`). **Recommendation:** write to
> *both* — `ActivityLog` for the human-readable timeline already shown across the app, and
> the dedicated `ProductionStatusEvent` table for cheap, indexable KPI queries (time per
> stage, on-time, turnaround) without parsing JSON metadata at scale.

### 4.4 Migration note

Schema changes are applied with `npx prisma db push` (per the repo's Prisma-for-migrations
convention) followed by verifying the live columns — the documented gotcha is that missing
columns cause silent 500s. New `productionStatus`/timestamps are nullable and backfilled:
existing `production_started` projects → `productionStatus = 'ready_for_production'`;
existing `completed` projects → `productionStatus = 'completed'` with
`productionCompletedAt = updatedAt`.

---

## 5. UI Wireframes

### 5.1 Production Board — Kanban View (desktop, default)

```
┌───────────────────────────────────────────────────────────────────────────────────────┐
│ Production                                            [Kanban] [List] [Calendar]  + Task │
│ ┌─KPIs──────────────────────────────────────────────────────────────────────────────┐  │
│ │ 1,240 Pcs Today  │  92% On-Time  │  4.2d Avg Turnaround │ 6 Rush │ 11 Due This Week │  │
│ └──────────────────────────────────────────────────────────────────────────────────┘  │
│ Search ▢ ____________   Filter: [Applicator ▾][Assignee ▾][Method ▾][Rush]   Sort:Due▾  │
├──────────┬──────────┬──────────┬──────────┬─────────────────────┬──────────┬───────────┤
│ ART      │ SOURCING │ READY    │ PRODUCTION (SP/EMB/DTF)        │ QC       │FULFILLMENT │
│ (3)      │ (5)      │ (4)      │ (8)                            │ (2)      │ (3)        │
│ ┌──────┐ │ ┌──────┐ │ ┌──────┐ │ ┌──────────────────────────┐  │ ┌──────┐ │ ┌────────┐ │
│ │#1031 │ │ │#1028 │ │ │#1044 │ │ │ #1042  Acme Co     ⏱2d   │  │ │#1009 │ │ │#1001   │ │
│ │Acme  │ │ │Globex│ │ │Initec│ │ │ [SP]✓ [EMB]● [DTF]○ 2/3  │  │ │Wonka │ │ │Stark   │ │
│ │Art ● │ │ │Ord.  │ │ │      │ │ │ 250 pcs · Due Fri · RUSH │  │ │QC    │ │ │Pickup  │ │
│ │@Dana │ │ │@Lee  │ │ │@Sam  │ │ │ @Sam · Show&Tell         │  │ │@Ana  │ │ │@Lee    │ │
│ └──────┘ │ └──────┘ │ └──────┘ │ └──────────────────────────┘  │ └──────┘ │ └────────┘ │
│  …       │  …       │  …       │  (swimlane toggle: by Method) │  …       │  …         │
└──────────┴──────────┴──────────┴─────────────────────────────┴──────────┴────────────┘
   drag card across columns → updates productionStatus + logs event
```

- Columns are **phases** (Art, Sourcing, Ready, Production, QC, Fulfillment) to keep the
  board readable; the granular 13 statuses live inside the card and in List view.
- The **Production** column has a swimlane toggle that splits cards by method
  (Printing / Embroidery / DTF) for the print floor.
- Card shows: order #, client, method chips with per-method progress, pieces, due date,
  rush flag, assignee, applicator, and a turnaround clock.

### 5.2 Production Board — List View

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│ ▢ │STATUS         │DUE    │RUSH│CLIENT   │PROJECT      │METHOD     │PCS │ASSIGNEE│APPLIC. │
├────────────────────────────────────────────────────────────────────────────────────────┤
│ ▢ │● Printing     │Fri    │ 🔥 │Acme Co  │Spring Tees  │SP·EMB·DTF │250 │Sam     │Show&Tell│
│ ▢ │● Art Needed   │Mon    │    │Globex   │Staff Polos  │EMB        │ 60 │Dana    │Anna     │
│ ▢ │● Ready For QC │Wed    │    │Wonka    │Event Hoods  │DTF        │ 75 │Ana     │Katalyst │
└────────────────────────────────────────────────────────────────────────────────────────┘
  Reuses the Projects/Quotes operational-table pattern (black header, sortable cols,
  status pills, bulk bar, mobile card fallback). Granular 13 statuses shown here as pills.
```

> Reuse the established **operational-table pattern** (`projects.tsx` / `sales.tsx`): black
> `#000` sortable header, status-count KPI tiles, filter pills, search, bulk action bar,
> measure-anchored row menu, mobile card fallback. This keeps Production visually part of
> the same system.

### 5.3 Production Board — Calendar View

```
┌─ June 2026 ─────────────────────────────────────────── [Month][Week] By: Due Date ▾ ─┐
│  Mon       Tue        Wed        Thu        Fri        Sat       Sun                   │
│  1         2          3          4          5          6         7                     │
│           ┌───────┐             ┌───────┐  ┌───────┐                                  │
│           │#1028 ●│             │#1009 ●│  │#1042🔥│   ← rush highlighted              │
│           │Globex │             │Wonka  │  │Acme   │                                   │
│           └───────┘             └───────┘  └───────┘                                  │
│  Capacity bar per day: ███░░ 3/5 jobs  (warn when over applicator capacity)           │
└────────────────────────────────────────────────────────────────────────────────────┘
  Toggle anchor: Due Date | Order Date | Production Start. Click a day → filtered queue.
```

### 5.4 Production Queue (operational worklist)

```
┌─ Production Queue ────────────────────────  Sort:[Due Date▾]  Group:[Applicator▾] ─────┐
│ Sort options: Order Date · Due Date · Rush · Client · Status · Applicator              │
│                                                                                        │
│ ▸ Show & Tell Tees (4 jobs · 410 pcs)                                                  │
│    🔥 #1042 Acme   Printing    Due Fri  250pcs  [Start][Done][Block]                   │
│       #1051 Hooli  Ready       Due Mon  120pcs  [Start]                                │
│ ▸ Anna (Embroidery) (2 jobs · 90 pcs)                                                  │
│       #1028 Globex Embroidery  Due Tue   60pcs  [Start]                                │
└────────────────────────────────────────────────────────────────────────────────────┘
```

The Queue is a **task-centric** flatten of the board: one row per actionable production
task, grouped/sorted for the floor. The six required sorts map to columns:
Order Date, Due Date, Rush, Client, Status, Applicator.

### 5.5 Order / Card Detail (with tasks)

```
┌─ #1042  Acme Co — Spring Tees ───────────────────────  Status: Printing ▾   RUSH 🔥 ──┐
│ Order 06/01 · Due 06/05 · In-Hands 06/05 · Lead: Sam · 250 pcs · $4,820 rev           │
│ ┌─ Production Tasks ──────────────────────────────────────────────────────────────┐  │
│ │ ☑ Art        Approve proof          Dana   done   05/30                          │  │
│ │ ☑ Ordering   Order 250 Bella 3001   Lee    done   05/31                          │  │
│ │ ◐ Printing   Run 100 SP fronts     Sam    in-progress  due 06/04  Show&Tell      │  │
│ │ ☐ Embroidery Run 100 left-chest     —      todo   due 06/04  Anna                 │  │
│ │ ☐ DTF        50 hoodie backs        Sam    todo   due 06/04                       │  │
│ │ ☐ QC         Inspect + count        Ana    todo                                  │  │
│ │ ☐ Delivery   Schedule pickup        Lee    todo                                  │  │
│ │                                                       [+ Add Task]                │  │
│ └──────────────────────────────────────────────────────────────────────────────┘  │
│ Files (artwork/mockups/proofs) · Activity timeline · Client-visible status preview    │
└────────────────────────────────────────────────────────────────────────────────────┘
```

### 5.6 Client Hub — production view (simplified)

```
┌─ Your Order: Spring Tees ─────────────────────────────────────────────┐
│  ●───────●───────●───────◉───────○───────○                            │
│  Design  Approved Materials In       Final   Ready                     │
│          ✓       Ordered   Production Checks  for Pickup               │
│                                                                        │
│  "Your order is on the press 🎉 — estimated ready 06/05."              │
└────────────────────────────────────────────────────────────────────┘
```

---

## 6. Task Integration — How Tasks Connect to Production

**Decision: Tasks ARE the production work units.** Rather than a generic standalone to-do
app (the `tasks.tsx` placeholder), the Task system is implemented as `ProductionTask`
records bound to a Project (and optionally a line item). This makes the empty Tasks tab the
"My Work" inbox across all projects.

| Example task | `type`     | Generated when…                     | Completing it advances… |
|--------------|-----------|--------------------------------------|--------------------------|
| Design Task  | ART       | enters Art Needed                    | → Art Approved           |
| Ordering Task| ORDERING  | Art Approved & garments not client   | → Garments Ordered/Received |
| Printing Task| PRINTING  | Ready For Production, line is SP      | method-complete → Finishing |
| Embroidery   | EMBROIDERY| Ready For Production, line is EMB     | method-complete → Finishing |
| Delivery Task| DELIVERY  | QC passed                            | → Delivered / Ready For Pickup |

**Auto-generation:** when a Project enters production, a **task template** seeds the right
tasks from its line items (one method task per distinct `serviceStyle`, plus Art/Ordering/
QC/Delivery as applicable per the skip rules). Templates are the glue between the macro
status pipeline and the granular work.

**Rollup vs. manual:** moving the Kanban card sets `productionStatus` directly (manual
override always allowed). In parallel, task completion **suggests/auto-advances** status via
rules (e.g., all method tasks DONE → propose Finishing). Manual and rule-based advancement
coexist; every change writes a `ProductionStatusEvent` + `ActivityLog` entry.

**Assignment & "My Work":** tasks carry `assignedToUserId` (+ `applicator` for outsourced
work). The Tasks tab becomes each user's cross-project queue filtered by assignee; the
Production Queue is the floor-wide view grouped by applicator.

---

## 7. Reporting — Production KPIs

| KPI                | Definition (period-scoped)                                            | Data source |
|--------------------|----------------------------------------------------------------------|-------------|
| Pieces Produced    | Σ `quantity` of DONE production/method tasks (or Σ line-item pcs of completed orders) in period | `ProductionTask.completedAt`, `lineItemsData` |
| Revenue            | Σ `salesData.amountCollected` (fallback `calculations.total`) of orders completed in period | existing `getSalesRevenue` |
| Profit             | Σ `getSalesProfit()` of orders completed in period                    | existing sales calc |
| Orders Completed   | count of projects reaching `productionStatus = completed` in period   | `ProductionStatusEvent` |
| On-Time %          | completed where `productionCompletedAt <= productionDueDate (or inHandsDate)` ÷ total completed | timestamps |
| Average Turnaround | mean(`productionCompletedAt − productionStartedAt`)                    | timestamps |

**Supporting analytics (recommended, cheap once `ProductionStatusEvent` exists):**
- Time-in-stage (bottleneck detection — e.g., avg days stuck in Art).
- Throughput by applicator / by method.
- Rush vs. standard on-time comparison.

**Reuse:** extend `app/(tabs)/reports.tsx` with a "Production" report alongside the existing
Quotes/Sales reports; reuse `utils/csvExport.ts` (add `generateProductionCSV`) and the
Google Sheets export. The existing **Work Order PDFs grouped by applicator**
(`generateWorkOrderPDFs`) become the print-floor output of the Queue.

---

## 8. Client Hub Impact — Status Visibility

Clients should see a **confidence-building, simplified** pipeline, not internal noise. The
13 internal statuses collapse to a **6-step client pipeline** (extending the existing
`PORTAL_STATUS_CONFIG` / `ProjectPipeline` in `app/portal/[orgId].tsx`).

| Internal production status | Client-visible? | Client label / step          |
|----------------------------|-----------------|------------------------------|
| Art Needed                 | ✅              | **In Design**                |
| Art Approved               | ✅              | **Design Approved** (often needs client approval action) |
| Garments Ordered           | ⚪ optional     | **Materials Ordered**        |
| Garments Received          | ❌ internal     | (rolled into Materials)      |
| Ready For Production        | ⚪ optional     | **Queued for Production**    |
| Printing / Embroidery / DTF| ✅ (merged)     | **In Production**            |
| Finishing                  | ❌ internal     | (still "In Production")      |
| Quality Control            | ✅              | **Final Checks**             |
| Ready For Pickup           | ✅ (actionable) | **Ready for Pickup** 🔔       |
| Delivered                  | ✅              | **Delivered**                |
| Completed                  | ✅              | **Completed**                |

Rules:
- Internal-only statuses (Garments Received, Finishing) map up to the nearest client step;
  never expose applicator names, costs, or internal assignees.
- **Ready For Pickup** triggers a client notification (reuse `EmailNotification`).
- Visibility is governed per status by a config map (single source of truth), so the team
  can tune what clients see without touching components.

---

## 9. Component & Data-Layer Plan (where things live)

| Concern                | Location (proposed)                                  | Pattern to follow |
|------------------------|------------------------------------------------------|-------------------|
| Production board page   | `app/(tabs)/production.tsx` (Kanban/List/Calendar)  | operational-table + new Kanban |
| Production queue        | section/tab within `production.tsx` or `app/production/queue.tsx` | Queue wireframe |
| Order detail + tasks    | extend `app/quote/production/[id].tsx`              | existing production screen |
| Tasks "My Work" inbox   | replace placeholder `app/(tabs)/tasks.tsx`         | filter ProductionTask by assignee |
| Data layer / mutations  | new `contexts/ProductionContext.tsx` (or extend `QuotesContext`) | React Query v5, `networkMode:'always'` |
| API routes              | `app/api/production/...+api.ts`, `app/api/tasks/...+api.ts` | raw `pg` Pool, `params ?? {}` guards |
| Status/visibility config| `constants/productionStatus.ts` + `types/production.ts` | mirror `types/quote.ts` STATUS_CONFIG |
| KPIs/report             | extend `app/(tabs)/reports.tsx`, `utils/csvExport.ts` | existing reports stack |

> Follow documented gotchas: React Query `networkMode:'always'`; dynamic API `null` param
> guards; navigate with server-returned UUIDs; keep `prisma/schema.prisma` in lockstep with
> the live DB via `prisma db push`.

---

## 10. Implementation Roadmap

Sequenced so each phase ships something usable and de-risks the next. Dependencies noted.

| Phase | Deliverable | Depends on | Notes / risk |
|-------|-------------|-----------|--------------|
| **P0 — Schema & types** | `productionStatus` + timestamps on Project; `ProductionTask`, `ProductionStatusEvent`; `types/production.ts` union + `constants/productionStatus.ts` (labels/colors/phase/client-visibility). `prisma db push` + backfill. | — | Verify live columns (silent-500 gotcha). Backfill existing active/completed. |
| **P1 — Data layer** | `ProductionContext` + API routes: read board slice, update status (writes event+activity), CRUD tasks, task templates seeding on production entry. | P0 | Reuse QuotesContext patterns; React Query. |
| **P2 — List view** | Production board **List view** first (reuses operational-table pattern) + status pills + KPI tiles + filters/sort. | P1 | Fastest path to a working board; lowest UI risk. |
| **P3 — Kanban view** | Phase columns, drag-to-update status, method chips + per-method progress, swimlane-by-method toggle. | P2 | Drag-and-drop on RN-web is the main new UI risk; prototype on Canvas first. |
| **P4 — Production Queue** | Task-centric worklist grouped by applicator with the 6 sorts; Start/Done/Block actions; Work Order PDF output. | P1 | Leverages existing `generateWorkOrderPDFs`. |
| **P5 — Task integration / My Work** | Replace `tasks.tsx` placeholder with assignee inbox; auto-advance rules (all method tasks done → Finishing, etc.). | P1, P4 | Rules engine kept simple + override-able. |
| **P6 — Calendar view** | Month/week by due/order/start date; capacity bars; click-day → queue. | P2 | Nice-to-have; independent of P3/P4/P5. |
| **P7 — Reporting** | Production KPIs in reports.tsx (Pieces, Revenue, Profit, Orders Completed, On-Time %, Avg Turnaround) + `generateProductionCSV` + Sheets. | P0 events | On-Time/Turnaround need P0 timestamps live for a period first. |
| **P8 — Client Hub** | Extend portal pipeline to the 6-step client view via visibility config; Ready-For-Pickup notification. | P0, P1 | Reuse `PORTAL_STATUS_CONFIG`, `EmailNotification`. |

**Suggested build order:** P0 → P1 → P2 → (P4 ∥ P3) → P5 → P7 → P8 → P6. P3 (Kanban DnD)
and P6 (Calendar) are the most isolated and can be parallelized or deferred without blocking
the operational core (List + Queue + Tasks).

---

## 11. Open Questions for Sign-Off (before build)

1. **Kanban columns = phases (6) or every status (13)?** This plan recommends 6 phase
   columns with the 13 statuses inside cards/List, to keep the board legible with
   multi-method orders. Confirm.
2. **Status advancement: manual drag, auto-from-tasks, or both?** Plan recommends both
   (manual override + rule-based suggestions). Confirm appetite for the rules engine.
3. **Pieces Produced basis:** count at task completion (granular, supports partial-day
   throughput) vs. at order completion (simpler). Plan recommends task-level.
4. **Pickup vs. delivery:** treat as mutually exclusive fulfillment branches (recommended)
   or allow both per order?
5. **Promotional service style:** route through Finishing/Ordering (recommended) or give it
   its own method status?
6. **Tasks scope:** production-only now (recommended), or general-purpose tasks (sales
   follow-ups, admin) from day one? Affects whether `ProductionTask` stays specific or
   becomes a generic `Task` with a `context`.
7. **Capacity model:** is per-applicator/day capacity in scope for the Calendar (P6), or
   visualize-only without hard limits?
```