import React, { useRef, useState, useCallback } from 'react';
import {
  View,
  Modal,
  Pressable,
  StyleSheet,
  useWindowDimensions,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import Colors from '@/constants/colors';

type Anchor = { x: number; y: number; width: number; height: number };

interface OverlayMenuProps {
  /** Render the trigger. `open` opens the menu; `isOpen` reflects state. */
  trigger: (api: { open: () => void; isOpen: boolean }) => React.ReactNode;
  /** Render menu contents. `close` dismisses the menu. */
  children: (api: { close: () => void }) => React.ReactNode;
  menuWidth?: number;
  /** Horizontal alignment of the menu relative to the trigger. */
  align?: 'left' | 'right';
  /** Optional style override merged onto the menu container (e.g. dark theme). */
  menuStyle?: StyleProp<ViewStyle>;
}

/**
 * Portal-based anchored popover. Renders menu contents inside a `Modal` so they
 * ALWAYS float above page content — this is the root-cause fix for dropdowns/
 * action menus being clipped by ancestor ScrollViews or `overflow: 'hidden'`
 * containers. Stacking order is guaranteed: Modal (this) > page content.
 *
 * Standardize all inline action menus / popovers on this component instead of
 * absolutely-positioned siblings of the trigger.
 */
export default function OverlayMenu({
  trigger,
  children,
  menuWidth = 220,
  align = 'right',
  menuStyle,
}: OverlayMenuProps) {
  const [open, setOpen] = useState(false);
  const [anchor, setAnchor] = useState<Anchor | null>(null);
  const [menuHeight, setMenuHeight] = useState(0);
  const triggerRef = useRef<View>(null);
  const { width: winW, height: winH } = useWindowDimensions();

  const openMenu = useCallback(() => {
    const node = triggerRef.current;
    if (node && typeof node.measureInWindow === 'function') {
      node.measureInWindow((x, y, width, height) => {
        setAnchor({ x, y, width, height });
        setMenuHeight(0);
        setOpen(true);
      });
    } else {
      setOpen(true);
    }
  }, []);

  const close = useCallback(() => setOpen(false), []);

  let left = 0;
  let top = 0;
  if (anchor) {
    left = align === 'right' ? anchor.x + anchor.width - menuWidth : anchor.x;
    // Clamp horizontally within viewport with an 8px margin.
    left = Math.max(8, Math.min(left, winW - menuWidth - 8));

    const below = anchor.y + anchor.height + 4;
    // Flip above the trigger if the measured menu would overflow the bottom.
    if (menuHeight > 0 && below + menuHeight > winH - 8) {
      top = Math.max(8, anchor.y - menuHeight - 4);
    } else {
      top = below;
    }
  }

  return (
    <>
      <View ref={triggerRef} collapsable={false}>
        {trigger({ open: openMenu, isOpen: open })}
      </View>
      <Modal
        visible={open}
        transparent
        animationType="fade"
        onRequestClose={close}
      >
        <Pressable style={styles.backdrop} onPress={close}>
          <View
            style={[styles.menu, { top, left, width: menuWidth }, menuStyle]}
            onStartShouldSetResponder={() => true}
            onLayout={(e) => {
              const h = e.nativeEvent.layout.height;
              if (h && Math.abs(h - menuHeight) > 1) setMenuHeight(h);
            }}
          >
            {children({ close })}
          </View>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  menu: {
    position: 'absolute',
    backgroundColor: Colors.light.surface,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.light.border,
    paddingVertical: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
});
