export function normalizeLocationMap(input) {
  let sourceFormat = 'qtyByCity';
  let source = input;

  if (input && Object.hasOwn(input, 'qtyByLocation')) {
    sourceFormat = 'qtyByLocation';
    source = input.qtyByLocation;
  } else if (input && Object.hasOwn(input, 'qtyByCity')) {
    source = input.qtyByCity;
  }

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
