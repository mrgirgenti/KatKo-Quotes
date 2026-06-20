'use client';
import { useEffect } from 'react';

export default function TestPage() {
  useEffect(() => {
    if (typeof document === 'undefined') return;

    const scan = () => {
      const all = document.querySelectorAll('*');
      const hits: string[] = [];
      all.forEach((el) => {
        const s = window.getComputedStyle(el);
        const outline = s.getPropertyValue('outline');
        const outlineWidth = s.getPropertyValue('outline-width');
        const boxShadow = s.getPropertyValue('box-shadow');
        const border = s.getPropertyValue('border-left');
        const rect = el.getBoundingClientRect();
        const isBlue = (v: string) => v && v !== 'none' && v !== '0px' && v.toLowerCase().includes('rgb') && !v.includes('rgba(0, 0, 0, 0)');
        const hasBlue = isBlue(outline) || isBlue(boxShadow) || isBlue(border);
        if (hasBlue && rect.width > 0 && rect.height > 0) {
          hits.push(`TAG=${el.tagName} class="${el.className}" id="${el.id}" outline="${outline}" shadow="${boxShadow}" border-left="${border}" rect=${JSON.stringify({ x: Math.round(rect.x), y: Math.round(rect.y), w: Math.round(rect.width), h: Math.round(rect.height) })}`);
        }
      });
      if (hits.length) {
        console.warn('[KK-SCAN] Blue elements found:', hits);
      } else {
        console.log('[KK-SCAN] active:', document.activeElement?.tagName, document.activeElement?.id, document.activeElement?.className);
        console.log('[KK-SCAN] No blue outline/shadow/border detected in computed styles');
      }
    };

    document.addEventListener('mouseenter', scan, true);
    document.addEventListener('focusin', scan, true);
    return () => {
      document.removeEventListener('mouseenter', scan, true);
      document.removeEventListener('focusin', scan, true);
    };
  }, []);

  return (
    <div style={{ height: '100vh', background: 'white' }}>
      Test Page
    </div>
  );
}
