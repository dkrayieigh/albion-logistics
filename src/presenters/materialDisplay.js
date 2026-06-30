const GENERAL_MATERIAL_DISPLAY_NAMES = new Map([
  ['鋼條', 'Bars'],
  ['布料', 'Cloth'],
  ['板材', 'Planks'],
  ['皮革', 'Leather'],
  ['?潭?', 'Bars'],
  ['撣?', 'Cloth'],
  ['?踵?', 'Planks'],
  ['?桅', 'Leather']
]);

export function resolveGeneralMaterialDisplayName(materialName) {
  if (typeof materialName !== 'string' || materialName.length === 0) return materialName;
  return GENERAL_MATERIAL_DISPLAY_NAMES.get(materialName) || materialName;
}
