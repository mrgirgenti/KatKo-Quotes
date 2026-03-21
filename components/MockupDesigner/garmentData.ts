export const CANVAS_W = 500;
export const CANVAS_H = 600;

export type GarmentType = 'tshirt' | 'hoodie' | 'crewneck' | 'longsleeve' | 'hat';
export type GarmentView = 'front' | 'back';
export type PrintLocation =
  | 'Left Chest'
  | 'Right Chest'
  | 'Center Chest'
  | 'Full Front'
  | 'Upper Back'
  | 'Full Back'
  | 'Left Sleeve'
  | 'Right Sleeve'
  | 'Pocket (literal)';

export interface ZoneDefinition {
  id: PrintLocation;
  label: string;
  x: number;
  y: number;
  w: number;
  h: number;
  view: GarmentView;
}

export interface GarmentDefinition {
  label: string;
  frontPath: string;
  backPath: string;
  frontDetails?: string[];
  backDetails?: string[];
  defaultColor: string;
  zones: ZoneDefinition[];
}

const BODY_FRONT =
  'M 80,55 L 5,100 L 5,215 L 80,198 L 80,560 L 420,560 L 420,198 L 495,215 L 495,100 L 420,55 C 390,55 365,55 345,55 C 315,55 300,135 250,135 C 200,135 185,55 160,55 C 135,55 110,55 80,55 Z';

const BODY_BACK =
  'M 80,55 L 5,100 L 5,215 L 80,198 L 80,560 L 420,560 L 420,198 L 495,215 L 495,100 L 420,55 L 80,55 Z';

const SLEEVE_BODY_FRONT =
  'M 80,55 L 0,100 L 20,410 L 80,390 L 80,560 L 420,560 L 420,390 L 480,410 L 500,100 L 420,55 C 390,55 365,55 345,55 C 315,55 300,135 250,135 C 200,135 185,55 160,55 C 135,55 110,55 80,55 Z';

const SLEEVE_BODY_BACK =
  'M 80,55 L 0,100 L 20,410 L 80,390 L 80,560 L 420,560 L 420,390 L 480,410 L 500,100 L 420,55 L 80,55 Z';

const HOODIE_FRONT =
  'M 80,80 C 80,10 160,-20 250,-20 C 340,-20 420,10 420,80 L 495,115 L 495,230 L 420,210 L 420,560 L 80,560 L 80,210 L 5,230 L 5,115 Z';

const HOODIE_BACK =
  'M 80,55 L 5,100 L 5,215 L 80,198 L 80,560 L 420,560 L 420,198 L 495,215 L 495,100 L 420,55 C 390,10 310,-15 250,-15 C 190,-15 110,10 80,55 Z';

const HAT_FRONT =
  'M 100,260 C 80,200 80,80 250,60 C 420,80 420,200 400,260 L 460,275 Q 470,280 460,295 L 40,295 Q 30,280 40,275 Z';

const TSHIRT_ZONES: ZoneDefinition[] = [
  { id: 'Left Chest',   label: 'Left Chest\n2.5"–5" × 2.5"–5"',  x: 300, y: 195, w: 115, h: 90,  view: 'front' },
  { id: 'Right Chest',  label: 'Right Chest\n2.5"–5" × 2.5"–5"', x: 85,  y: 195, w: 115, h: 90,  view: 'front' },
  { id: 'Center Chest', label: 'Center Chest\n6"–10" × 6"–8"',   x: 165, y: 185, w: 170, h: 110, view: 'front' },
  { id: 'Full Front',   label: 'Full Front\n10"–12" × 10"–14"',  x: 85,  y: 175, w: 330, h: 285, view: 'front' },
  { id: 'Left Sleeve',  label: 'Left Sleeve\n1"–4" × 1"–4"',     x: 424, y: 105, w: 68,  h: 95,  view: 'front' },
  { id: 'Right Sleeve', label: 'Right Sleeve\n1"–4" × 1"–4"',    x: 8,   y: 105, w: 68,  h: 95,  view: 'front' },
  { id: 'Upper Back',   label: 'Upper Back\n10"–14" × 1"–6"',    x: 95,  y: 135, w: 310, h: 120, view: 'back'  },
  { id: 'Full Back',    label: 'Full Back\n10"–14" × 6"–15"',    x: 85,  y: 130, w: 330, h: 280, view: 'back'  },
];

const HOODIE_ZONES: ZoneDefinition[] = [
  { id: 'Left Chest',      label: 'Left Chest\n2.5"–5" × 2.5"–5"',  x: 295, y: 215, w: 115, h: 90,  view: 'front' },
  { id: 'Right Chest',     label: 'Right Chest\n2.5"–5" × 2.5"–5"', x: 90,  y: 215, w: 115, h: 90,  view: 'front' },
  { id: 'Center Chest',    label: 'Center Chest\n6"–10" × 6"–8"',   x: 170, y: 205, w: 160, h: 110, view: 'front' },
  { id: 'Full Front',      label: 'Full Front\n10"–12" × 10"–14"',  x: 90,  y: 200, w: 320, h: 280, view: 'front' },
  { id: 'Pocket (literal)',label: 'Pocket\n4"–8" wide',             x: 170, y: 450, w: 160, h: 90,  view: 'front' },
  { id: 'Left Sleeve',     label: 'Left Sleeve',                    x: 422, y: 120, w: 70,  h: 80,  view: 'front' },
  { id: 'Right Sleeve',    label: 'Right Sleeve',                   x: 8,   y: 120, w: 70,  h: 80,  view: 'front' },
  { id: 'Upper Back',      label: 'Upper Back\n10"–14" × 1"–6"',    x: 95,  y: 135, w: 310, h: 120, view: 'back'  },
  { id: 'Full Back',       label: 'Full Back\n10"–14" × 6"–15"',    x: 85,  y: 130, w: 330, h: 280, view: 'back'  },
];

const LONGSLEEVE_ZONES: ZoneDefinition[] = [
  { id: 'Left Chest',   label: 'Left Chest\n2.5"–5" × 2.5"–5"',  x: 300, y: 195, w: 115, h: 90,  view: 'front' },
  { id: 'Right Chest',  label: 'Right Chest\n2.5"–5" × 2.5"–5"', x: 85,  y: 195, w: 115, h: 90,  view: 'front' },
  { id: 'Center Chest', label: 'Center Chest\n6"–10" × 6"–8"',   x: 165, y: 185, w: 170, h: 110, view: 'front' },
  { id: 'Full Front',   label: 'Full Front\n10"–12" × 10"–14"',  x: 85,  y: 175, w: 330, h: 280, view: 'front' },
  { id: 'Left Sleeve',  label: 'Left Sleeve\n1"–4"',              x: 425, y: 150, w: 70,  h: 200, view: 'front' },
  { id: 'Right Sleeve', label: 'Right Sleeve\n1"–4"',             x: 5,   y: 150, w: 70,  h: 200, view: 'front' },
  { id: 'Upper Back',   label: 'Upper Back\n10"–14" × 1"–6"',    x: 95,  y: 135, w: 310, h: 120, view: 'back'  },
  { id: 'Full Back',    label: 'Full Back\n10"–14" × 6"–15"',    x: 85,  y: 130, w: 330, h: 280, view: 'back'  },
];

const HAT_ZONES: ZoneDefinition[] = [
  { id: 'Center Chest', label: 'Center Front\n2"–5" wide', x: 145, y: 110, w: 210, h: 140, view: 'front' },
  { id: 'Left Chest', label: 'Left Panel', x: 60, y: 130, w: 85, h: 100, view: 'front' },
];

export const GARMENTS: Record<GarmentType, GarmentDefinition> = {
  tshirt: {
    label: 'T-Shirt',
    frontPath: BODY_FRONT,
    backPath: BODY_BACK,
    defaultColor: '#FFFFFF',
    zones: TSHIRT_ZONES,
  },
  hoodie: {
    label: 'Hoodie',
    frontPath: HOODIE_FRONT,
    backPath: HOODIE_BACK,
    defaultColor: '#FFFFFF',
    zones: HOODIE_ZONES,
  },
  crewneck: {
    label: 'Crewneck',
    frontPath: BODY_FRONT,
    backPath: BODY_BACK,
    defaultColor: '#FFFFFF',
    zones: TSHIRT_ZONES,
  },
  longsleeve: {
    label: 'Long Sleeve',
    frontPath: SLEEVE_BODY_FRONT,
    backPath: SLEEVE_BODY_BACK,
    defaultColor: '#FFFFFF',
    zones: LONGSLEEVE_ZONES,
  },
  hat: {
    label: 'Hat',
    frontPath: HAT_FRONT,
    backPath: HAT_FRONT,
    defaultColor: '#FFFFFF',
    zones: HAT_ZONES,
  },
};

export const GARMENT_COLORS: { label: string; value: string; dark: boolean }[] = [
  { label: 'White', value: '#FFFFFF', dark: false },
  { label: 'Black', value: '#1A1A1A', dark: true },
  { label: 'Navy', value: '#1B2A4A', dark: true },
  { label: 'Royal Blue', value: '#1560BD', dark: true },
  { label: 'Red', value: '#C8102E', dark: true },
  { label: 'Forest Green', value: '#1B5E20', dark: true },
  { label: 'Gray', value: '#9E9E9E', dark: false },
  { label: 'Charcoal', value: '#455A64', dark: true },
  { label: 'Maroon', value: '#800000', dark: true },
  { label: 'Gold', value: '#FFC107', dark: false },
  { label: 'Orange', value: '#FF6B35', dark: false },
  { label: 'Purple', value: '#6A1B9A', dark: true },
  { label: 'Light Blue', value: '#90CAF9', dark: false },
  { label: 'Pink', value: '#F48FB1', dark: false },
  { label: 'Heather Gray', value: '#B0BEC5', dark: false },
  { label: 'Dark Heather', value: '#546E7A', dark: true },
  { label: 'Athletic Heather', value: '#CFD8DC', dark: false },
  { label: 'Tan', value: '#D2B48C', dark: false },
  { label: 'Olive', value: '#556B2F', dark: true },
  { label: 'Teal', value: '#00897B', dark: true },
];

export const BRANDS = [
  'Any Brand',
  'SanMar',
  'S&S Activewear',
  'McCreary\'s',
  'LA Apparel',
  'Next Level',
  'Bella+Canvas',
  'Gildan',
  'alphabroder',
];
