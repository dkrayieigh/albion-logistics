function invalidTransfer(item, errorCode) {
  return {
    ok: false,
    status: 'invalid-transfer',
    item,
    errors: [errorCode]
  };
}

export function applyInventoryTransfer({ item, quantity, fromLocation, toLocation }) {
  if (quantity <= 0) return invalidTransfer(item, 'INVALID_QUANTITY');
  if (fromLocation === toLocation) return invalidTransfer(item, 'SAME_LOCATION');
  if (!item) return invalidTransfer(item, 'ITEM_NOT_FOUND');
  if (item.qtyByCity[fromLocation] < quantity) {
    return invalidTransfer(item, 'INSUFFICIENT_SOURCE_QUANTITY');
  }

  const qtyByCity = {
    ...item.qtyByCity,
    [fromLocation]: item.qtyByCity[fromLocation] - quantity,
    [toLocation]: item.qtyByCity[toLocation] + quantity
  };

  return {
    ok: true,
    status: 'transferred',
    item: {
      ...item,
      qtyByCity
    },
    errors: []
  };
}
