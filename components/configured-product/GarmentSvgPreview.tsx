import React from 'react';
import Svg, { Path } from 'react-native-svg';
import {
  GARMENTS,
  CANVAS_W,
  CANVAS_H,
  type GarmentType,
  type GarmentView,
} from '@/components/MockupDesigner/garmentData';
import { isDarkHex } from '@/utils/garmentPreview';

interface GarmentSvgPreviewProps {
  garmentType: GarmentType;
  colorHex: string;
  view?: GarmentView;
  width?: number;
  height?: number;
}

/**
 * Renders a tinted SVG garment silhouette at any size.
 * Used as the garment preview inside ConfiguredProductEditor when no
 * catalog product image is available.
 */
export function GarmentSvgPreview({
  garmentType,
  colorHex,
  view = 'front',
  width = 200,
  height = 240,
}: GarmentSvgPreviewProps) {
  const def = GARMENTS[garmentType];
  const svgPath = view === 'front' ? def.frontPath : def.backPath;
  const dark = isDarkHex(colorHex);
  const strokeColor = dark ? 'rgba(255,255,255,0.25)' : 'rgba(0,0,0,0.18)';

  return (
    <Svg
      width={width}
      height={height}
      viewBox={`0 0 ${CANVAS_W} ${CANVAS_H}`}
      style={{ overflow: 'visible' }}
    >
      <Path
        d={svgPath}
        fill={colorHex}
        stroke={strokeColor}
        strokeWidth={8}
        strokeLinejoin="round"
      />
    </Svg>
  );
}
