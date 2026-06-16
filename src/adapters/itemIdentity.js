export function resolveItemIdentity(input) {
  if (input?.stableId && input?.itemLevel) {
    return {
      sourceFormat: 'future',
      stableId: input.stableId,
      itemLevel: input.itemLevel,
      legacyItemKey: input.legacyItemKey ?? null,
      raw: input
    };
  }

  const legacyItemKey = input?.legacyItemKey ?? input?.itemKey ?? null;
  if (!legacyItemKey) {
    throw new Error('Missing item identity input.');
  }

  const mapping = input?.mappingTable?.[legacyItemKey];
  if (!mapping) {
    throw new Error(`Missing Stable ID mapping for legacy item key: ${legacyItemKey}`);
  }

  return {
    sourceFormat: 'legacy',
    stableId: mapping.stableId,
    itemLevel: mapping.itemLevel,
    legacyItemKey,
    raw: input
  };
}
