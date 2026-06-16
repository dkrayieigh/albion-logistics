export function readTransaction(transaction) {
  const sourceFormat = transaction?.action ? 'future' : 'legacy';
  const displayType = transaction?.type ?? transaction?.action ?? 'UNKNOWN_TRANSACTION';
  const itemRef = transaction?.item ?? transaction?.target ?? transaction?.itemKey ?? null;
  const quantity = typeof transaction?.qty === 'number' ? transaction.qty : null;
  const cashImpact = typeof transaction?.total === 'number'
    ? transaction.total
    : (typeof transaction?.cashChange === 'number' ? transaction.cashChange : null);
  const locationRef = transaction?.location ?? transaction?.locationId ?? null;

  return {
    sourceFormat,
    displayType,
    itemRef,
    quantity,
    cashImpact,
    locationRef,
    raw: transaction
  };
}
