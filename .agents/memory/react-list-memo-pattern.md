---
name: React list memoization pattern
description: How to stop O(n) re-render cascades in list renders (LineItemCard, PortalLineItemCard) — stable ID-based handlers + React.memo
---

## The pattern

**Problem:** `list.map((item, index) => <Card onChange={(updated) => handler(index, updated)} />)` creates new inline arrow references on every render, defeating React.memo completely. Any parent state change re-renders ALL cards.

**Fix — three coordinated changes:**

### 1. Parent: ID-based handlers with functional updaters
```ts
// Handler takes ID, NOT index. Functional updater preserves unchanged object references.
const handleUpdate = useCallback((id: string, updated: T) => {
  setItems(prev => prev.map(li => li.id === id ? updated : li));
}, []); // empty deps — functional updater, no closure over items

const handleDelete = useCallback((id: string) => {
  setItems(prev => {
    if (prev.length === 1) { Alert.alert(...); return prev; }
    return prev.filter(li => li.id !== id);
  });
}, []); // empty deps — Alert doesn't need deps
```

### 2. Parent render: pass stable references (no inline arrows)
```tsx
<Card
  key={item.id}
  item={item}
  onChangeItem={handleUpdate}   // stable ref — no new arrow per render
  onDelete={handleDelete}       // stable ref
/>
```

### 3. Child: stable local bindings + React.memo
```tsx
// Prop interface takes id-aware signatures
interface CardProps {
  item: T;
  onChangeItem: (id: string, updated: T) => void;
  onDelete: (id: string) => void;
}

function CardFn({ item, onChangeItem, onDelete: onDeleteProp }: CardProps) {
  // Fresh item ref for use in effects/closures
  const itemRef = useRef(item);
  itemRef.current = item; // updated synchronously each render

  // Stable local onChange — binds this item's ID, hides 2-arg API from component internals
  const onChange = useCallback((updated: T) => onChangeItem(item.id, updated), [item.id, onChangeItem]);
  const handleDelete = useCallback(() => onDeleteProp(item.id), [item.id, onDeleteProp]);

  // ... all existing onChange(updated) calls remain unchanged ...
}
export const Card = React.memo(CardFn);
```

**Why:** React.memo uses shallow equality. After the fix, unchanged siblings keep the SAME `item` reference (functional updater returns original objects) AND the SAME `onChangeItem`/`onDelete` references (stable useCallback). So memo bails out and they don't re-render.

**How to apply:** any component that renders a list of interactive cards (quote line items, portal line items, etc.). The id-based handler pattern is the prerequisite — without it, inline arrows defeat memo.

## useEffect dep cleanup

When a useEffect needs a fresh callback (to avoid stale closure), use the latest-ref pattern instead of adding the callback to deps:
```tsx
const itemRef = useRef(item);
itemRef.current = item; // sync update, no effect needed

useEffect(() => {
  // ... uses itemRef.current (always fresh) and onChange (stable via useCallback) ...
}, []); // empty — onChange is stable, itemRef is a ref (not reactive)
```
Do NOT use `useRef(onChange)` initialized with a 2-arg prop and then updated to a 1-arg local — TypeScript infers the type from initialization and will error when calling with 1 arg.
