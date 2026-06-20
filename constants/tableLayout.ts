import { ViewStyle } from 'react-native';

/**
 * GLOBAL TABLE LAYOUT STANDARD (Katalyst OS)
 * ------------------------------------------------------------------
 * One reusable column-sizing system for every data table in the app
 * (Organizations, Contacts, Quotes, Projects, Production, Client Hub).
 *
 * Tables should NOT size columns ad-hoc. Pick a category token per
 * column and (optionally) compose an alignment helper:
 *
 *   colStatus: { ...TABLE_COL.status, ...TABLE_CELL.center }
 *   colProject: { ...TABLE_COL.textPrimary, ...TABLE_CELL.left }
 *
 * COLUMN CATEGORIES
 *  - textPrimary : the main identifier (Project / Organization / Contact).
 *                  Flexible, but anchored with a min + max so it never
 *                  balloons or collapses. Left aligned, truncates.
 *  - text        : secondary text (Client / Service / Email / Role).
 *                  Flexible with min + max. Left aligned, truncates.
 *  - status      : Status / Client Hub / Workflow Status. Fixed, centered.
 *  - date        : Submitted / Order Date / Due Date / Last Login.
 *                  Fixed, centered.
 *  - numeric     : counts (PCS / Orders). Fixed, centered.
 *  - numericWide : money (Total / Revenue / Profit / Per PCS / Markup).
 *                  Fixed, centered.
 *  - action      : View / Track / Actions. Min width so a button + an
 *                  overflow menu always fit without crowding. Centered.
 *
 * RESPONSIVE: fixed columns never shrink; flexible columns shrink only
 * to their min. When the row is wider than the viewport, the table
 * scrolls horizontally rather than compressing columns to unreadable.
 */
export const TABLE_COL = {
  textPrimary: { flexGrow: 1, flexShrink: 1, flexBasis: 320, minWidth: 260, maxWidth: 420 },
  text:        { flexGrow: 1, flexShrink: 1, flexBasis: 170, minWidth: 150, maxWidth: 320 },
  status:      { width: 150 },
  date:        { width: 140 },
  numeric:     { width: 110 },
  numericWide: { width: 120 },
  action:      { minWidth: 170 },
} satisfies Record<string, ViewStyle>;

/**
 * Cell alignment helpers. `justifyContent` + `alignItems` are both set so
 * the same helper centers content whether the cell is a column (default)
 * or a row (flexDirection: 'row') container.
 */
export const TABLE_CELL: Record<'left' | 'center' | 'right', ViewStyle> = {
  left:   { justifyContent: 'center', alignItems: 'flex-start' },
  center: { justifyContent: 'center', alignItems: 'center' },
  right:  { justifyContent: 'center', alignItems: 'flex-end' },
};
