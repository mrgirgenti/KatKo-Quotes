export const CATEGORY_TREE: Record<string, Record<string, string[]>> = {
  Apparel: {
    'T-Shirt':  ['Short Sleeve', 'Long Sleeve', 'Baseball/Raglan', 'Performance'],
    'Hoodie':   ['Pullover', 'Zip-Up'],
    'Crewneck': ['Pullover'],
    'Polo':     ['Short Sleeve'],
    'Tank':     ['Tank Top'],
  },
  Headwear: {
    'Snapback': [],
    'Flexfit':  [],
    'Trucker':  [],
    'Dad Hat':  [],
    'Beanie':   [],
  },
  Bags: {
    'Tote':               [],
    'Backpack':           [],
    'Cinch / Drawstring': [],
  },
  Promotional:  {},
  Accessories:  {},
  Other:        {},
};

export const GENDER_OPTIONS = ['Unisex', "Men's", "Women's", 'Youth'];

interface TemplateRule {
  subcategory: string;
  productType?: string;
  templateKey: string;
}

const TEMPLATE_RULES: TemplateRule[] = [
  { subcategory: 'T-Shirt',  productType: 'Short Sleeve',    templateKey: 'STANDARD_TSHIRT' },
  { subcategory: 'T-Shirt',  productType: 'Long Sleeve',     templateKey: 'LONG_SLEEVE'     },
  { subcategory: 'T-Shirt',  productType: 'Baseball/Raglan', templateKey: 'STANDARD_TSHIRT' },
  { subcategory: 'T-Shirt',  productType: 'Performance',     templateKey: 'STANDARD_TSHIRT' },
  { subcategory: 'Hoodie',                                    templateKey: 'HOODIE'          },
  { subcategory: 'Crewneck',                                  templateKey: 'HOODIE'          },
  { subcategory: 'Polo',                                      templateKey: 'POLO'            },
  { subcategory: 'Tank',                                      templateKey: 'TANK'            },
];

export type TemplateResolutionSource =
  | 'auto-subcategory-producttype'
  | 'auto-subcategory'
  | 'unresolved';

export interface AutoResolution {
  templateKey: string | null;
  source: TemplateResolutionSource;
}

export function resolveTemplateKey(
  subcategory: string | null | undefined,
  productType: string | null | undefined,
): AutoResolution {
  if (!subcategory) return { templateKey: null, source: 'unresolved' };

  if (productType) {
    for (const rule of TEMPLATE_RULES) {
      if (rule.subcategory === subcategory && rule.productType === productType) {
        return { templateKey: rule.templateKey, source: 'auto-subcategory-producttype' };
      }
    }
  }

  for (const rule of TEMPLATE_RULES) {
    if (rule.subcategory === subcategory && !rule.productType) {
      return { templateKey: rule.templateKey, source: 'auto-subcategory' };
    }
  }

  return { templateKey: null, source: 'unresolved' };
}
