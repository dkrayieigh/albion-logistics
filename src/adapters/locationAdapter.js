export function normalizeLocationMap(input) {
  const sourceFormat = input?.qtyByLocation ? 'qtyByLocation' : 'qtyByCity';
  const source = sourceFormat === 'qtyByLocation' ? input.qtyByLocation : input;
  const quantities = {};
  const unresolvedLocations = [];

  for (const [location, quantity] of Object.entries(source || {})) {
    if (typeof quantity !== 'number' || !Number.isFinite(quantity)) unresolvedLocations.push(location);
    else quantities[location] = quantity;
  }

  return {
    sourceFormat,
    quantities,
    unresolvedLocations
  };
}
