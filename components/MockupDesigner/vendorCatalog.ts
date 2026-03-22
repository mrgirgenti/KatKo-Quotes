import { GarmentType } from './garmentData';

export interface ProductColor {
  name: string;
  hex: string;
  dark: boolean;
}

export interface ProductStyle {
  styleNumber: string;
  name: string;
  garmentType: GarmentType;
  isYouth?: boolean;
  colors: ProductColor[];
}

export interface Vendor {
  id: string;
  name: string;
  styles: ProductStyle[];
}

// ─── Shared Color Palettes ────────────────────────────────────────────────────

const GILDAN_CORE: ProductColor[] = [
  { name: 'White',              hex: '#FFFFFF', dark: false },
  { name: 'Black',              hex: '#1A1A1A', dark: true  },
  { name: 'Sport Grey',         hex: '#9E9E9E', dark: false },
  { name: 'Dark Heather',       hex: '#546E7A', dark: true  },
  { name: 'Ash',                hex: '#D0CEC8', dark: false },
  { name: 'Charcoal',           hex: '#455A64', dark: true  },
  { name: 'Navy',               hex: '#1B2A4A', dark: true  },
  { name: 'Royal',              hex: '#1560BD', dark: true  },
  { name: 'Sapphire',           hex: '#0F52BA', dark: true  },
  { name: 'Carolina Blue',      hex: '#56A0D3', dark: false },
  { name: 'Sky',                hex: '#87CEEB', dark: false },
  { name: 'Red',                hex: '#C8102E', dark: true  },
  { name: 'Cherry Red',         hex: '#D2042D', dark: true  },
  { name: 'Cardinal',           hex: '#9B2335', dark: true  },
  { name: 'Antique Cherry Red', hex: '#A52020', dark: true  },
  { name: 'Maroon',             hex: '#800000', dark: true  },
  { name: 'Irish Green',        hex: '#009A44', dark: true  },
  { name: 'Forest Green',       hex: '#1B5E20', dark: true  },
  { name: 'Military Green',     hex: '#4A5240', dark: true  },
  { name: 'Gold',               hex: '#FFC107', dark: false },
  { name: 'Daisy',              hex: '#FFD700', dark: false },
  { name: 'Orange',             hex: '#FF6B35', dark: false },
  { name: 'Tangerine',          hex: '#F28500', dark: false },
  { name: 'Purple',             hex: '#6A1B9A', dark: true  },
  { name: 'Heliconia',          hex: '#DF3178', dark: true  },
  { name: 'Azalea',             hex: '#F18BA0', dark: false },
  { name: 'Sand',               hex: '#C2A882', dark: false },
  { name: 'Natural',            hex: '#F5F0E8', dark: false },
];

const GILDAN_YOUTH: ProductColor[] = [
  { name: 'White',        hex: '#FFFFFF', dark: false },
  { name: 'Black',        hex: '#1A1A1A', dark: true  },
  { name: 'Sport Grey',   hex: '#9E9E9E', dark: false },
  { name: 'Dark Heather', hex: '#546E7A', dark: true  },
  { name: 'Ash',          hex: '#D0CEC8', dark: false },
  { name: 'Navy',         hex: '#1B2A4A', dark: true  },
  { name: 'Royal',        hex: '#1560BD', dark: true  },
  { name: 'Red',          hex: '#C8102E', dark: true  },
  { name: 'Cardinal',     hex: '#9B2335', dark: true  },
  { name: 'Maroon',       hex: '#800000', dark: true  },
  { name: 'Forest Green', hex: '#1B5E20', dark: true  },
  { name: 'Gold',         hex: '#FFC107', dark: false },
  { name: 'Orange',       hex: '#FF6B35', dark: false },
  { name: 'Purple',       hex: '#6A1B9A', dark: true  },
  { name: 'Heliconia',    hex: '#DF3178', dark: true  },
  { name: 'Azalea',       hex: '#F18BA0', dark: false },
  { name: 'Sand',         hex: '#C2A882', dark: false },
  { name: 'Natural',      hex: '#F5F0E8', dark: false },
];

const GILDAN_SWEATSHIRT: ProductColor[] = [
  { name: 'White',          hex: '#FFFFFF', dark: false },
  { name: 'Black',          hex: '#1A1A1A', dark: true  },
  { name: 'Sport Grey',     hex: '#9E9E9E', dark: false },
  { name: 'Dark Heather',   hex: '#546E7A', dark: true  },
  { name: 'Ash',            hex: '#D0CEC8', dark: false },
  { name: 'Charcoal',       hex: '#455A64', dark: true  },
  { name: 'Navy',           hex: '#1B2A4A', dark: true  },
  { name: 'Royal',          hex: '#1560BD', dark: true  },
  { name: 'Red',            hex: '#C8102E', dark: true  },
  { name: 'Cardinal',       hex: '#9B2335', dark: true  },
  { name: 'Maroon',         hex: '#800000', dark: true  },
  { name: 'Forest Green',   hex: '#1B5E20', dark: true  },
  { name: 'Military Green', hex: '#4A5240', dark: true  },
  { name: 'Gold',           hex: '#FFC107', dark: false },
  { name: 'Orange',         hex: '#FF6B35', dark: false },
  { name: 'Purple',         hex: '#6A1B9A', dark: true  },
  { name: 'Heliconia',      hex: '#DF3178', dark: true  },
  { name: 'Sand',           hex: '#C2A882', dark: false },
];

const GILDAN_SWEATSHIRT_YOUTH: ProductColor[] = [
  { name: 'White',        hex: '#FFFFFF', dark: false },
  { name: 'Black',        hex: '#1A1A1A', dark: true  },
  { name: 'Sport Grey',   hex: '#9E9E9E', dark: false },
  { name: 'Dark Heather', hex: '#546E7A', dark: true  },
  { name: 'Navy',         hex: '#1B2A4A', dark: true  },
  { name: 'Royal',        hex: '#1560BD', dark: true  },
  { name: 'Red',          hex: '#C8102E', dark: true  },
  { name: 'Cardinal',     hex: '#9B2335', dark: true  },
  { name: 'Forest Green', hex: '#1B5E20', dark: true  },
  { name: 'Gold',         hex: '#FFC107', dark: false },
  { name: 'Purple',       hex: '#6A1B9A', dark: true  },
  { name: 'Charcoal',     hex: '#455A64', dark: true  },
];

const BC3001_COLORS: ProductColor[] = [
  { name: 'White',              hex: '#FFFFFF', dark: false },
  { name: 'Black',              hex: '#1A1A1A', dark: true  },
  { name: 'Dark Grey Heather',  hex: '#546E7A', dark: true  },
  { name: 'Athletic Heather',   hex: '#CFD8DC', dark: false },
  { name: 'Asphalt',            hex: '#37474F', dark: true  },
  { name: 'Heather Navy',       hex: '#2D3F6B', dark: true  },
  { name: 'True Royal',         hex: '#1560BD', dark: true  },
  { name: 'Heather True Royal', hex: '#4B72C2', dark: true  },
  { name: 'Red',                hex: '#C8102E', dark: true  },
  { name: 'Heather Red',        hex: '#C94040', dark: true  },
  { name: 'Heather Maroon',     hex: '#8A3040', dark: true  },
  { name: 'Mauve',              hex: '#C8A2A2', dark: false },
  { name: 'Pink',               hex: '#F48FB1', dark: false },
  { name: 'Forest',             hex: '#1B5E20', dark: true  },
  { name: 'Heather Forest',     hex: '#3D7A45', dark: true  },
  { name: 'Military Green',     hex: '#4A5240', dark: true  },
  { name: 'Teal',               hex: '#00897B', dark: true  },
  { name: 'Storm',              hex: '#7B8D9E', dark: false },
  { name: 'Team Purple',        hex: '#6A1B9A', dark: true  },
  { name: 'Soft Cream',         hex: '#FFF8DC', dark: false },
  { name: 'Tan',                hex: '#D2B48C', dark: false },
  { name: 'Heather Sage',       hex: '#8FAF8F', dark: false },
  { name: 'True Vintage Blue',  hex: '#5B7FA6', dark: true  },
  { name: 'Vintage White',      hex: '#FAF0E6', dark: false },
];

const BC3001Y_COLORS: ProductColor[] = [
  { name: 'White',             hex: '#FFFFFF', dark: false },
  { name: 'Black',             hex: '#1A1A1A', dark: true  },
  { name: 'Athletic Heather',  hex: '#CFD8DC', dark: false },
  { name: 'Dark Grey Heather', hex: '#546E7A', dark: true  },
  { name: 'Heather Navy',      hex: '#2D3F6B', dark: true  },
  { name: 'True Royal',        hex: '#1560BD', dark: true  },
  { name: 'Red',               hex: '#C8102E', dark: true  },
  { name: 'Forest',            hex: '#1B5E20', dark: true  },
  { name: 'Military Green',    hex: '#4A5240', dark: true  },
  { name: 'Team Purple',       hex: '#6A1B9A', dark: true  },
  { name: 'Tan',               hex: '#D2B48C', dark: false },
];

const NL6210_COLORS: ProductColor[] = [
  { name: 'White',          hex: '#F5F5F0', dark: false },
  { name: 'Black',          hex: '#2C2C2C', dark: true  },
  { name: 'Natural',        hex: '#F5EDD3', dark: false },
  { name: 'Vintage Navy',   hex: '#2A3F6A', dark: true  },
  { name: 'Vintage Red',    hex: '#B03030', dark: true  },
  { name: 'Vintage Royal',  hex: '#2A5AA0', dark: true  },
  { name: 'Vintage Purple', hex: '#5A2A7A', dark: true  },
  { name: 'Vintage Green',  hex: '#2A5A2A', dark: true  },
  { name: 'Charcoal',       hex: '#4A4A4A', dark: true  },
  { name: 'Tahoe Blue',     hex: '#3B6FA0', dark: true  },
  { name: 'Envy',           hex: '#5A8A5A', dark: false },
  { name: 'Vintage Gold',   hex: '#B89600', dark: false },
  { name: 'Berry',          hex: '#7A2A5A', dark: true  },
  { name: 'Vintage Pink',   hex: '#E8A0A0', dark: false },
];

const NL7200_COLORS: ProductColor[] = [
  { name: 'White',          hex: '#F5F5F0', dark: false },
  { name: 'Vintage Black',  hex: '#2C2C2C', dark: true  },
  { name: 'Natural',        hex: '#F5EDD3', dark: false },
  { name: 'Vintage Navy',   hex: '#2A3F6A', dark: true  },
  { name: 'Vintage Red',    hex: '#B03030', dark: true  },
  { name: 'Vintage Royal',  hex: '#2A5AA0', dark: true  },
  { name: 'Charcoal',       hex: '#4A4A4A', dark: true  },
  { name: 'Vintage Purple', hex: '#5A2A7A', dark: true  },
];

const CC1717_COLORS: ProductColor[] = [
  { name: 'White',         hex: '#FEFEFE', dark: false },
  { name: 'Black',         hex: '#2B2B2B', dark: true  },
  { name: 'Grey',          hex: '#9E9E9E', dark: false },
  { name: 'Ivory',         hex: '#FFFFF0', dark: false },
  { name: 'Butter',        hex: '#FFF3A8', dark: false },
  { name: 'Chalky Mint',   hex: '#B2E8C8', dark: false },
  { name: 'Crunchberry',   hex: '#E86090', dark: true  },
  { name: 'Washed Denim',  hex: '#7B9EB5', dark: false },
  { name: 'Watermelon',    hex: '#FC6C85', dark: false },
  { name: 'Blossom',       hex: '#E8A0B0', dark: false },
  { name: 'Violet',        hex: '#8B72BE', dark: true  },
  { name: 'Moss',          hex: '#7A8E62', dark: true  },
  { name: 'Seafoam',       hex: '#78D4A0', dark: false },
  { name: 'Blue Jean',     hex: '#6B98BB', dark: true  },
  { name: 'Caribbean Blue',hex: '#00B4D8', dark: true  },
  { name: 'Granite',       hex: '#7A7A7A', dark: true  },
  { name: 'Pepper',        hex: '#3D3D3D', dark: true  },
  { name: 'Mystic Blue',   hex: '#4D7BA8', dark: true  },
  { name: 'Lagoon Blue',   hex: '#2E86AB', dark: true  },
  { name: 'True Navy',     hex: '#1B2A4A', dark: true  },
  { name: 'Chambray',      hex: '#9FAABC', dark: false },
  { name: 'Bay',           hex: '#5B7FA6', dark: true  },
  { name: 'Hemp',          hex: '#C4A882', dark: false },
  { name: 'Smoke',         hex: '#878787', dark: true  },
  { name: 'Artichoke',     hex: '#8B9E6E', dark: false },
  { name: 'Yam',           hex: '#C07850', dark: true  },
  { name: 'Salmon',        hex: '#FA8072', dark: false },
  { name: 'Paprika',       hex: '#C84B38', dark: true  },
  { name: 'Crimson',       hex: '#DC143C', dark: true  },
  { name: 'Mustard',       hex: '#FFDB58', dark: false },
  { name: 'Honey',         hex: '#FFB300', dark: false },
  { name: 'Terra Cotta',   hex: '#C07050', dark: true  },
  { name: 'Flo Blue',      hex: '#6495ED', dark: false },
  { name: 'Sandstone',     hex: '#C2A882', dark: false },
  { name: 'Thyme',         hex: '#5A7A5A', dark: true  },
];

const CC9018_COLORS: ProductColor[] = [
  { name: 'White',        hex: '#FEFEFE', dark: false },
  { name: 'Black',        hex: '#2B2B2B', dark: true  },
  { name: 'Grey',         hex: '#9E9E9E', dark: false },
  { name: 'Ivory',        hex: '#FFFFF0', dark: false },
  { name: 'Butter',       hex: '#FFF3A8', dark: false },
  { name: 'Blossom',      hex: '#E8A0B0', dark: false },
  { name: 'Seafoam',      hex: '#78D4A0', dark: false },
  { name: 'True Navy',    hex: '#1B2A4A', dark: true  },
  { name: 'Washed Denim', hex: '#7B9EB5', dark: false },
  { name: 'Granite',      hex: '#7A7A7A', dark: true  },
  { name: 'Watermelon',   hex: '#FC6C85', dark: false },
];

const SHMSS_COLORS: ProductColor[] = [
  { name: 'White',          hex: '#FFFFFF', dark: false },
  { name: 'Black',          hex: '#1A1A1A', dark: true  },
  { name: 'Charcoal',       hex: '#455A64', dark: true  },
  { name: 'Dark Heather',   hex: '#546E7A', dark: true  },
  { name: 'Ash',            hex: '#D0CEC8', dark: false },
  { name: 'Navy',           hex: '#1B2A4A', dark: true  },
  { name: 'Royal',          hex: '#1560BD', dark: true  },
  { name: 'Red',            hex: '#C8102E', dark: true  },
  { name: 'Cardinal',       hex: '#9B2335', dark: true  },
  { name: 'Maroon',         hex: '#800000', dark: true  },
  { name: 'Forest Green',   hex: '#1B5E20', dark: true  },
  { name: 'Military Green', hex: '#4A5240', dark: true  },
  { name: 'Gold',           hex: '#FFC107', dark: false },
  { name: 'Purple',         hex: '#6A1B9A', dark: true  },
  { name: 'Sand',           hex: '#C2B280', dark: false },
];

const ITC_SS4500_COLORS: ProductColor[] = [
  { name: 'White',        hex: '#FFFFFF', dark: false },
  { name: 'Black',        hex: '#1A1A1A', dark: true  },
  { name: 'Charcoal',     hex: '#455A64', dark: true  },
  { name: 'Slate',        hex: '#7B8D9E', dark: false },
  { name: 'Light Grey',   hex: '#D3D3D3', dark: false },
  { name: 'True Navy',    hex: '#1B2A4A', dark: true  },
  { name: 'Cobalt',       hex: '#0047AB', dark: true  },
  { name: 'Red',          hex: '#C8102E', dark: true  },
  { name: 'Maroon',       hex: '#800000', dark: true  },
  { name: 'Cardinal',     hex: '#9B2335', dark: true  },
  { name: 'Hunter Green', hex: '#355E3B', dark: true  },
  { name: 'Army',         hex: '#4A5240', dark: true  },
  { name: 'Bone',         hex: '#E8E4DA', dark: false },
  { name: 'Sand',         hex: '#C2B280', dark: false },
  { name: 'Gold',         hex: '#FFD700', dark: false },
  { name: 'Purple',       hex: '#6A1B9A', dark: true  },
];

const ITC_IND4000_COLORS: ProductColor[] = [
  { name: 'White',        hex: '#FFFFFF', dark: false },
  { name: 'Black',        hex: '#1A1A1A', dark: true  },
  { name: 'Gunmetal',     hex: '#2C3539', dark: true  },
  { name: 'Slate',        hex: '#7B8D9E', dark: false },
  { name: 'Light Grey',   hex: '#D3D3D3', dark: false },
  { name: 'True Navy',    hex: '#1B2A4A', dark: true  },
  { name: 'Cobalt',       hex: '#0047AB', dark: true  },
  { name: 'Red',          hex: '#C8102E', dark: true  },
  { name: 'Maroon',       hex: '#800000', dark: true  },
  { name: 'Cardinal',     hex: '#9B2335', dark: true  },
  { name: 'Hunter Green', hex: '#355E3B', dark: true  },
  { name: 'Army',         hex: '#4A5240', dark: true  },
  { name: 'Bone',         hex: '#E8E4DA', dark: false },
  { name: 'Sand',         hex: '#C2B280', dark: false },
  { name: 'Gold',         hex: '#FFD700', dark: false },
  { name: 'Purple',       hex: '#6A1B9A', dark: true  },
];

const LANE_SEVEN_LS14001_COLORS: ProductColor[] = [
  { name: 'White',          hex: '#FFFFFF', dark: false },
  { name: 'Black',          hex: '#1A1A1A', dark: true  },
  { name: 'Charcoal',       hex: '#455A64', dark: true  },
  { name: 'Athletic Grey',  hex: '#9E9E9E', dark: false },
  { name: 'Navy',           hex: '#1B2A4A', dark: true  },
  { name: 'Vintage Navy',   hex: '#2A3F6A', dark: true  },
  { name: 'Natural',        hex: '#F5F0E8', dark: false },
  { name: 'Vintage White',  hex: '#FAF0E6', dark: false },
  { name: 'Clay',           hex: '#C07850', dark: true  },
];

const LANE_SEVEN_LS14004_COLORS: ProductColor[] = [
  { name: 'White',         hex: '#FFFFFF', dark: false },
  { name: 'Black',         hex: '#1A1A1A', dark: true  },
  { name: 'Charcoal',      hex: '#455A64', dark: true  },
  { name: 'Athletic Grey', hex: '#9E9E9E', dark: false },
  { name: 'Navy',          hex: '#1B2A4A', dark: true  },
  { name: 'Vintage Navy',  hex: '#2A3F6A', dark: true  },
  { name: 'Natural',       hex: '#F5F0E8', dark: false },
  { name: 'Vintage White', hex: '#FAF0E6', dark: false },
  { name: 'Clay',          hex: '#C07850', dark: true  },
];

const JERZEES_COLORS: ProductColor[] = [
  { name: 'White',              hex: '#FFFFFF', dark: false },
  { name: 'Black',              hex: '#1A1A1A', dark: true  },
  { name: 'Charcoal Grey',      hex: '#455A64', dark: true  },
  { name: 'Oxford',             hex: '#D0CEC8', dark: false },
  { name: 'Navy',               hex: '#1B2A4A', dark: true  },
  { name: 'Royal',              hex: '#1560BD', dark: true  },
  { name: 'Red',                hex: '#C8102E', dark: true  },
  { name: 'Maroon',             hex: '#800000', dark: true  },
  { name: 'Forest Green',       hex: '#1B5E20', dark: true  },
  { name: 'Gold',               hex: '#FFC107', dark: false },
  { name: 'Purple',             hex: '#6A1B9A', dark: true  },
  { name: 'Vintage Heather Navy',hex: '#2D3F6B', dark: true  },
];

const ITC_SS3000_COLORS: ProductColor[] = [
  { name: 'White',        hex: '#FFFFFF', dark: false },
  { name: 'Black',        hex: '#1A1A1A', dark: true  },
  { name: 'Charcoal',     hex: '#455A64', dark: true  },
  { name: 'Slate',        hex: '#7B8D9E', dark: false },
  { name: 'True Navy',    hex: '#1B2A4A', dark: true  },
  { name: 'Red',          hex: '#C8102E', dark: true  },
  { name: 'Hunter Green', hex: '#355E3B', dark: true  },
  { name: 'Army',         hex: '#4A5240', dark: true  },
  { name: 'Sand',         hex: '#C2B280', dark: false },
  { name: 'Bone',         hex: '#E8E4DA', dark: false },
  { name: 'Gold',         hex: '#FFD700', dark: false },
  { name: 'Purple',       hex: '#6A1B9A', dark: true  },
];

const ITC_SS4500Z_COLORS: ProductColor[] = [
  { name: 'White',        hex: '#FFFFFF', dark: false },
  { name: 'Black',        hex: '#1A1A1A', dark: true  },
  { name: 'Charcoal',     hex: '#455A64', dark: true  },
  { name: 'True Navy',    hex: '#1B2A4A', dark: true  },
  { name: 'Red',          hex: '#C8102E', dark: true  },
  { name: 'Hunter Green', hex: '#355E3B', dark: true  },
  { name: 'Army',         hex: '#4A5240', dark: true  },
  { name: 'Sand',         hex: '#C2B280', dark: false },
];

const ITC_EXP30PZ_COLORS: ProductColor[] = [
  { name: 'Black',        hex: '#1A1A1A', dark: true  },
  { name: 'Slate',        hex: '#7B8D9E', dark: false },
  { name: 'True Navy',    hex: '#1B2A4A', dark: true  },
  { name: 'Red',          hex: '#C8102E', dark: true  },
  { name: 'Hunter Green', hex: '#355E3B', dark: true  },
  { name: 'Silver',       hex: '#C0C0C0', dark: false },
];


const SPORTTEK_ST550_COLORS: ProductColor[] = [
  { name: 'White',         hex: '#FFFFFF', dark: false },
  { name: 'Black',         hex: '#1A1A1A', dark: true  },
  { name: 'True Navy',     hex: '#0D1B3E', dark: true  },
  { name: 'True Royal',    hex: '#1560BD', dark: true  },
  { name: 'True Red',      hex: '#C8102E', dark: true  },
  { name: 'Forest Green',  hex: '#1B5E20', dark: true  },
  { name: 'Gold',          hex: '#FFC107', dark: false },
  { name: 'True Purple',   hex: '#6A1B9A', dark: true  },
  { name: 'Graphite Grey', hex: '#546E7A', dark: true  },
  { name: 'Silver',        hex: '#C0C0C0', dark: false },
];

const NIKE_POLO_COLORS: ProductColor[] = [
  { name: 'White',         hex: '#FFFFFF', dark: false },
  { name: 'Black',         hex: '#1A1A1A', dark: true  },
  { name: 'Midnight Navy', hex: '#0D1B3E', dark: true  },
  { name: 'Dark Grey',     hex: '#546E7A', dark: true  },
  { name: 'University Red',hex: '#C8102E', dark: true  },
  { name: 'Team Royal',    hex: '#1560BD', dark: true  },
  { name: 'Team Scarlet',  hex: '#CC0000', dark: true  },
  { name: 'Forest Green',  hex: '#1B5E20', dark: true  },
  { name: 'Cool Grey',     hex: '#9E9E9E', dark: false },
];

const OGIO_OG101_COLORS: ProductColor[] = [
  { name: 'White',      hex: '#FFFFFF', dark: false },
  { name: 'Black',      hex: '#1A1A1A', dark: true  },
  { name: 'Navy',       hex: '#1B2A4A', dark: true  },
  { name: 'True Royal', hex: '#1560BD', dark: true  },
  { name: 'Red',        hex: '#C8102E', dark: true  },
  { name: 'Gear Grey',  hex: '#7B8D9E', dark: false },
];

const SPORTTEK_ST357_COLORS: ProductColor[] = [
  { name: 'Black',        hex: '#1A1A1A', dark: true  },
  { name: 'Dark Grey',    hex: '#546E7A', dark: true  },
  { name: 'True Navy',    hex: '#0D1B3E', dark: true  },
  { name: 'True Royal',   hex: '#1560BD', dark: true  },
  { name: 'True Red',     hex: '#C8102E', dark: true  },
  { name: 'Forest Green', hex: '#1B5E20', dark: true  },
  { name: 'True Purple',  hex: '#6A1B9A', dark: true  },
  { name: 'Silver',       hex: '#C0C0C0', dark: false },
];

const YP6506_COLORS: ProductColor[] = [
  { name: 'Black',            hex: '#1A1A1A', dark: true  },
  { name: 'Navy',             hex: '#1B2A4A', dark: true  },
  { name: 'White',            hex: '#FFFFFF', dark: false },
  { name: 'Khaki',            hex: '#C2A882', dark: false },
  { name: 'Royal',            hex: '#1560BD', dark: true  },
  { name: 'Red',              hex: '#C8102E', dark: true  },
  { name: 'Charcoal',         hex: '#455A64', dark: true  },
  { name: 'Black / White',    hex: '#1A1A1A', dark: true  },
  { name: 'Navy / White',     hex: '#1B2A4A', dark: true  },
  { name: 'Camo / Black',     hex: '#4A5240', dark: true  },
];

const YP6606_COLORS: ProductColor[] = [
  { name: 'Black',         hex: '#1A1A1A', dark: true  },
  { name: 'Navy',          hex: '#1B2A4A', dark: true  },
  { name: 'White',         hex: '#FFFFFF', dark: false },
  { name: 'Khaki / Navy',  hex: '#C2A882', dark: false },
  { name: 'Black / White', hex: '#1A1A1A', dark: true  },
  { name: 'Royal / White', hex: '#1560BD', dark: true  },
  { name: 'Red / White',   hex: '#C8102E', dark: true  },
];

const RICHARDSON122_COLORS: ProductColor[] = [
  { name: 'Black',         hex: '#1A1A1A', dark: true  },
  { name: 'Navy',          hex: '#1B2A4A', dark: true  },
  { name: 'White',         hex: '#FFFFFF', dark: false },
  { name: 'Columbia Blue', hex: '#56A0D3', dark: false },
  { name: 'Charcoal',      hex: '#455A64', dark: true  },
  { name: 'Kelly Green',   hex: '#4CBB17', dark: false },
  { name: 'Purple',        hex: '#6A1B9A', dark: true  },
  { name: 'Red',           hex: '#C8102E', dark: true  },
  { name: 'Maroon',        hex: '#800000', dark: true  },
  { name: 'Forest Green',  hex: '#1B5E20', dark: true  },
];

const OTTO31069_COLORS: ProductColor[] = [
  { name: 'Black',   hex: '#1A1A1A', dark: true  },
  { name: 'Navy',    hex: '#1B2A4A', dark: true  },
  { name: 'White',   hex: '#FFFFFF', dark: false },
  { name: 'Khaki',   hex: '#C2A882', dark: false },
  { name: 'Grey',    hex: '#9E9E9E', dark: false },
  { name: 'Red',     hex: '#C8102E', dark: true  },
  { name: 'Royal',   hex: '#1560BD', dark: true  },
  { name: 'Maroon',  hex: '#800000', dark: true  },
];

const SHGW_COLORS: ProductColor[] = [
  { name: 'White',         hex: '#F5F0E8', dark: false },
  { name: 'Black',         hex: '#1A1A1A', dark: true  },
  { name: 'Charcoal',      hex: '#455A64', dark: true  },
  { name: 'Slate',         hex: '#6B7D8A', dark: true  },
  { name: 'Navy',          hex: '#1B2A4A', dark: true  },
  { name: 'Royal',         hex: '#1560BD', dark: true  },
  { name: 'Red',           hex: '#C8102E', dark: true  },
  { name: 'Maroon',        hex: '#800000', dark: true  },
  { name: 'Forest',        hex: '#2D4A2D', dark: true  },
  { name: 'Army',          hex: '#4A5240', dark: true  },
  { name: 'Sand',          hex: '#C4A882', dark: false },
  { name: 'Bone',          hex: '#E8E0CE', dark: false },
  { name: 'Purple',        hex: '#6A1B9A', dark: true  },
  { name: 'Pink',          hex: '#E8A0B0', dark: false },
  { name: 'Sage',          hex: '#8FAF8F', dark: false },
  { name: 'Dusty Blue',    hex: '#7B9EB5', dark: false },
  { name: 'Vintage Brown', hex: '#8B6355', dark: true  },
  { name: 'Rust',          hex: '#B7410E', dark: true  },
];

const SHGWH_COLORS: ProductColor[] = [
  { name: 'White',      hex: '#F5F0E8', dark: false },
  { name: 'Black',      hex: '#1A1A1A', dark: true  },
  { name: 'Charcoal',   hex: '#455A64', dark: true  },
  { name: 'Slate',      hex: '#6B7D8A', dark: true  },
  { name: 'Navy',       hex: '#1B2A4A', dark: true  },
  { name: 'Red',        hex: '#C8102E', dark: true  },
  { name: 'Maroon',     hex: '#800000', dark: true  },
  { name: 'Forest',     hex: '#2D4A2D', dark: true  },
  { name: 'Army',       hex: '#4A5240', dark: true  },
  { name: 'Sand',       hex: '#C4A882', dark: false },
  { name: 'Bone',       hex: '#E8E0CE', dark: false },
  { name: 'Sage',       hex: '#8FAF8F', dark: false },
  { name: 'Dusty Blue', hex: '#7B9EB5', dark: false },
  { name: 'Rust',       hex: '#B7410E', dark: true  },
  { name: 'Purple',     hex: '#6A1B9A', dark: true  },
];

const LA_APPAREL_COLORS: ProductColor[] = [
  { name: 'White',      hex: '#FEFEFE', dark: false },
  { name: 'Black',      hex: '#1A1A1A', dark: true  },
  { name: 'Charcoal',   hex: '#455A64', dark: true  },
  { name: 'Slate',      hex: '#7B8D9E', dark: false },
  { name: 'Dusty Blue', hex: '#7B9EB5', dark: false },
  { name: 'Stone Blue', hex: '#5B7FA6', dark: true  },
  { name: 'Pine',       hex: '#2D4A2D', dark: true  },
  { name: 'Sage',       hex: '#8FAF8F', dark: false },
  { name: 'Army',       hex: '#4A5240', dark: true  },
  { name: 'Plum',       hex: '#5E2750', dark: true  },
  { name: 'Mauve',      hex: '#C8A2A2', dark: false },
  { name: 'Poppy',      hex: '#E8341C', dark: true  },
  { name: 'Clay',       hex: '#C07850', dark: true  },
  { name: 'Rust',       hex: '#B7410E', dark: true  },
  { name: 'Natural',    hex: '#F5F0E8', dark: false },
  { name: 'Butter',     hex: '#FFF3A8', dark: false },
  { name: 'Peach',      hex: '#FFCBA4', dark: false },
  { name: 'Lavender',   hex: '#D8B4E2', dark: false },
  { name: 'Pink',       hex: '#F48FB1', dark: false },
  { name: 'Red',        hex: '#C8102E', dark: true  },
  { name: 'Gold',       hex: '#C8A000', dark: false },
];

const GILDAN_8000: ProductColor[] = [
  { name: 'White',          hex: '#FFFFFF', dark: false },
  { name: 'Black',          hex: '#1A1A1A', dark: true  },
  { name: 'Sport Grey',     hex: '#9E9E9E', dark: false },
  { name: 'Dark Heather',   hex: '#546E7A', dark: true  },
  { name: 'Ash',            hex: '#D0CEC8', dark: false },
  { name: 'Charcoal',       hex: '#455A64', dark: true  },
  { name: 'Navy',           hex: '#1B2A4A', dark: true  },
  { name: 'Royal',          hex: '#1560BD', dark: true  },
  { name: 'Red',            hex: '#C8102E', dark: true  },
  { name: 'Cardinal',       hex: '#9B2335', dark: true  },
  { name: 'Maroon',         hex: '#800000', dark: true  },
  { name: 'Forest Green',   hex: '#1B5E20', dark: true  },
  { name: 'Military Green', hex: '#4A5240', dark: true  },
  { name: 'Gold',           hex: '#FFC107', dark: false },
  { name: 'Daisy',          hex: '#FFD700', dark: false },
  { name: 'Orange',         hex: '#FF6B35', dark: false },
  { name: 'Purple',         hex: '#6A1B9A', dark: true  },
  { name: 'Heliconia',      hex: '#DF3178', dark: true  },
  { name: 'Sand',           hex: '#C2A882', dark: false },
  { name: 'Irish Green',    hex: '#009A44', dark: true  },
];

const GILDAN_64000: ProductColor[] = [
  ...GILDAN_CORE,
  { name: 'Orchid',        hex: '#DA70D6', dark: false },
  { name: 'Pistachio',     hex: '#93C572', dark: false },
  { name: 'Lilac',         hex: '#C8A2C8', dark: false },
  { name: 'Cornsilk',      hex: '#FFF8DC', dark: false },
  { name: 'Midnight',      hex: '#0A0A2A', dark: true  },
  { name: 'Safety Green',  hex: '#AAFF00', dark: false },
  { name: 'Safety Orange', hex: '#FF6600', dark: false },
];

// ─── Vendor Catalog ───────────────────────────────────────────────────────────

export const VENDOR_CATALOG: Vendor[] = [
  {
    id: 'ss-activewear',
    name: 'S&S Activewear',
    styles: [
      // ── T-Shirts ─────────────────────────────────────────────────────────
      { styleNumber: '2000',    name: 'Gildan Ultra Cotton Tee',            garmentType: 'tshirt',    colors: GILDAN_CORE },
      { styleNumber: '2000B',   name: 'Gildan Youth Ultra Cotton Tee',      garmentType: 'tshirt',    isYouth: true, colors: GILDAN_YOUTH },
      { styleNumber: '5000',    name: 'Gildan Heavy Cotton Tee',            garmentType: 'tshirt',    colors: GILDAN_CORE },
      { styleNumber: '5000B',   name: 'Gildan Youth Heavy Cotton Tee',      garmentType: 'tshirt',    isYouth: true, colors: GILDAN_YOUTH },
      { styleNumber: '8000',    name: 'Gildan DryBlend Tee',                garmentType: 'tshirt',    colors: GILDAN_8000 },
      { styleNumber: '8000B',   name: 'Gildan Youth DryBlend Tee',          garmentType: 'tshirt',    isYouth: true, colors: GILDAN_YOUTH },
      { styleNumber: '64000',   name: 'Gildan SoftStyle Tee',               garmentType: 'tshirt',    colors: GILDAN_64000 },
      { styleNumber: '64000B',  name: 'Gildan Youth SoftStyle Tee',         garmentType: 'tshirt',    isYouth: true, colors: GILDAN_YOUTH },
      { styleNumber: 'BC3001',  name: 'Bella+Canvas Unisex Jersey Tee',     garmentType: 'tshirt',    colors: BC3001_COLORS },
      { styleNumber: 'BC3001Y', name: 'Bella+Canvas Youth Jersey Tee',      garmentType: 'tshirt',    isYouth: true, colors: BC3001Y_COLORS },
      { styleNumber: 'NL6210',  name: 'Next Level CVC Crew',                garmentType: 'tshirt',    colors: NL6210_COLORS },
      { styleNumber: '1717',    name: 'Comfort Colors Garment Dyed Tee',    garmentType: 'tshirt',    colors: CC1717_COLORS },
      { styleNumber: '9018',    name: 'Comfort Colors Youth Garment Tee',   garmentType: 'tshirt',    isYouth: true, colors: CC9018_COLORS },
      { styleNumber: 'SHMSS',   name: 'Shaka Wear Max Heavyweight Tee',     garmentType: 'tshirt',    colors: SHMSS_COLORS },
      // ── Long Sleeve ──────────────────────────────────────────────────────
      { styleNumber: 'NL7200',  name: 'Next Level Tri-Blend Long Sleeve',   garmentType: 'longsleeve',colors: NL7200_COLORS },
      // ── Crewnecks ─────────────────────────────────────────────────────────
      { styleNumber: 'LS14004', name: 'Lane Seven Crewneck Sweatshirt',     garmentType: 'crewneck',  colors: LANE_SEVEN_LS14004_COLORS },
      { styleNumber: '562MR',   name: 'Jerzees Nublend Crewneck',           garmentType: 'crewneck',  colors: JERZEES_COLORS },
      { styleNumber: '18000',   name: 'Gildan Heavy Blend Crewneck',        garmentType: 'crewneck',  colors: GILDAN_SWEATSHIRT },
      { styleNumber: '18000B',  name: 'Gildan Youth Heavy Blend Crewneck',  garmentType: 'crewneck',  isYouth: true, colors: GILDAN_SWEATSHIRT_YOUTH },
      { styleNumber: 'SS3000',  name: 'Independent Midweight Crewneck',     garmentType: 'crewneck',  colors: ITC_SS3000_COLORS },
      // ── Hoodies ───────────────────────────────────────────────────────────
      { styleNumber: 'LS14001', name: 'Lane Seven Pullover Hoodie',         garmentType: 'hoodie',    colors: LANE_SEVEN_LS14001_COLORS },
      { styleNumber: '996MR',   name: 'Jerzees Nublend Pullover Hoodie',    garmentType: 'hoodie',    colors: JERZEES_COLORS },
      { styleNumber: '18500',   name: 'Gildan Heavy Blend Hoodie',          garmentType: 'hoodie',    colors: GILDAN_SWEATSHIRT },
      { styleNumber: '18500B',  name: 'Gildan Youth Heavy Blend Hoodie',    garmentType: 'hoodie',    isYouth: true, colors: GILDAN_SWEATSHIRT_YOUTH },
      { styleNumber: 'SS4500',  name: 'Independent Midweight Hoodie',       garmentType: 'hoodie',    colors: ITC_SS4500_COLORS },
      { styleNumber: 'IND4000', name: 'Independent Heavyweight Hoodie',     garmentType: 'hoodie',    colors: ITC_IND4000_COLORS },
      { styleNumber: 'SS4500Z', name: 'Independent Midweight Zip Hoodie',   garmentType: 'hoodie',    colors: ITC_SS4500Z_COLORS },
      { styleNumber: 'EXP30PZ', name: 'Independent Performance Zip Hoodie', garmentType: 'hoodie',   colors: ITC_EXP30PZ_COLORS },
      // ── Hats ──────────────────────────────────────────────────────────────
      { styleNumber: '6506',    name: 'YP Classics 5-Panel Cap',            garmentType: 'hat',       colors: YP6506_COLORS },
      { styleNumber: '6606',    name: 'YP Classics Retro Trucker Cap',      garmentType: 'hat',       colors: YP6606_COLORS },
      { styleNumber: 'R122',    name: 'Richardson 122 Fitted Cap',          garmentType: 'hat',       colors: RICHARDSON122_COLORS },
    ],
  },

  {
    id: 'sanmar',
    name: 'SanMar',
    styles: [
      // ── T-Shirts ─────────────────────────────────────────────────────────
      { styleNumber: '2000',    name: 'Gildan Ultra Cotton Tee',            garmentType: 'tshirt',    colors: GILDAN_CORE },
      { styleNumber: '2000B',   name: 'Gildan Youth Ultra Cotton Tee',      garmentType: 'tshirt',    isYouth: true, colors: GILDAN_YOUTH },
      { styleNumber: '5000',    name: 'Gildan Heavy Cotton Tee',            garmentType: 'tshirt',    colors: GILDAN_CORE },
      { styleNumber: '5000B',   name: 'Gildan Youth Heavy Cotton Tee',      garmentType: 'tshirt',    isYouth: true, colors: GILDAN_YOUTH },
      { styleNumber: '8000',    name: 'Gildan DryBlend Tee',                garmentType: 'tshirt',    colors: GILDAN_8000 },
      { styleNumber: '8000B',   name: 'Gildan Youth DryBlend Tee',          garmentType: 'tshirt',    isYouth: true, colors: GILDAN_YOUTH },
      { styleNumber: '64000',   name: 'Gildan SoftStyle Tee',               garmentType: 'tshirt',    colors: GILDAN_64000 },
      { styleNumber: '64000B',  name: 'Gildan Youth SoftStyle Tee',         garmentType: 'tshirt',    isYouth: true, colors: GILDAN_YOUTH },
      { styleNumber: 'BC3001',  name: 'Bella+Canvas Unisex Jersey Tee',     garmentType: 'tshirt',    colors: BC3001_COLORS },
      { styleNumber: 'BC3001Y', name: 'Bella+Canvas Youth Jersey Tee',      garmentType: 'tshirt',    isYouth: true, colors: BC3001Y_COLORS },
      { styleNumber: 'NL6210',  name: 'Next Level CVC Crew',                garmentType: 'tshirt',    colors: NL6210_COLORS },
      { styleNumber: '1717',    name: 'Comfort Colors Garment Dyed Tee',    garmentType: 'tshirt',    colors: CC1717_COLORS },
      // ── Polos ─────────────────────────────────────────────────────────────
      { styleNumber: 'ST550',     name: 'Sport-Tek Micropique Polo',          garmentType: 'polo',      colors: SPORTTEK_ST550_COLORS },
      { styleNumber: 'NKDC1963',  name: 'Nike Micro Pique 2.0 Polo',         garmentType: 'polo',      colors: NIKE_POLO_COLORS },
      { styleNumber: 'NKDC1991',  name: "Nike Women's Micro Pique 2.0 Polo", garmentType: 'polo',      colors: NIKE_POLO_COLORS },
      { styleNumber: 'OG101',     name: 'Ogio Caliber 2.0 Polo',             garmentType: 'polo',      colors: OGIO_OG101_COLORS },
      // ── Long Sleeve ──────────────────────────────────────────────────────
      { styleNumber: 'NL7200',  name: 'Next Level Tri-Blend Long Sleeve',   garmentType: 'longsleeve',colors: NL7200_COLORS },
      // ── Activewear ────────────────────────────────────────────────────────
      { styleNumber: 'ST357',   name: 'Sport-Tek 1/4-Zip Pullover',         garmentType: 'longsleeve',colors: SPORTTEK_ST357_COLORS },
      // ── Crewnecks ─────────────────────────────────────────────────────────
      { styleNumber: '562MR',   name: 'Jerzees Nublend Crewneck',           garmentType: 'crewneck',  colors: JERZEES_COLORS },
      { styleNumber: '18000',   name: 'Gildan Heavy Blend Crewneck',        garmentType: 'crewneck',  colors: GILDAN_SWEATSHIRT },
      { styleNumber: '18000B',  name: 'Gildan Youth Heavy Blend Crewneck',  garmentType: 'crewneck',  isYouth: true, colors: GILDAN_SWEATSHIRT_YOUTH },
      // ── Hoodies ───────────────────────────────────────────────────────────
      { styleNumber: '18500',   name: 'Gildan Heavy Blend Hoodie',          garmentType: 'hoodie',    colors: GILDAN_SWEATSHIRT },
      { styleNumber: '18500B',  name: 'Gildan Youth Heavy Blend Hoodie',    garmentType: 'hoodie',    isYouth: true, colors: GILDAN_SWEATSHIRT_YOUTH },
    ],
  },

  {
    id: 'shaka-wear',
    name: 'Shaka Wear',
    styles: [
      { styleNumber: 'SHGW',  name: 'Garment Washed Heavyweight Tee',     garmentType: 'tshirt',  colors: SHGW_COLORS },
      { styleNumber: 'SHSS',  name: 'Super Max Heavyweight Tee',           garmentType: 'tshirt',  colors: SHMSS_COLORS },
      { styleNumber: 'SHMSS', name: 'Max Heavyweight Tee',                 garmentType: 'tshirt',  colors: SHMSS_COLORS },
      { styleNumber: 'SHGWH', name: 'Garment Washed Heavyweight Hoodie',   garmentType: 'hoodie',  colors: SHGWH_COLORS },
    ],
  },

  {
    id: 'otto-caps',
    name: 'Otto Caps',
    styles: [
      { styleNumber: '31-069', name: 'Otto Caps Mid 5-Panel Hat',          garmentType: 'hat',     colors: OTTO31069_COLORS },
    ],
  },

  {
    id: 'la-apparel',
    name: 'LA Apparel',
    styles: [
      { styleNumber: '1801GD', name: 'Garment Dye T-Shirt',                garmentType: 'tshirt',    colors: LA_APPAREL_COLORS },
      { styleNumber: '8890W',  name: 'Heavy Cotton T-Shirt',               garmentType: 'tshirt',    colors: LA_APPAREL_COLORS },
      { styleNumber: 'F297',   name: 'Heavy Fleece Pullover Hoodie',       garmentType: 'hoodie',    colors: LA_APPAREL_COLORS },
      { styleNumber: 'CO93',   name: 'Flex Fleece Crewneck Sweatshirt',    garmentType: 'crewneck',  colors: LA_APPAREL_COLORS },
      { styleNumber: '5314W',  name: 'Flex Fleece Long Sleeve T-Shirt',    garmentType: 'longsleeve',colors: LA_APPAREL_COLORS },
    ],
  },
];
