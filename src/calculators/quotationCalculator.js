import { BASE_RRR, BONUSES, FOCUS_RRR_BONUS, TAX_RATE } from '../data/constants.js';

const DISCOUNTS = new Set([0, 5, 6, 7]);

function isFiniteNonNegative(value) {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0;
}

function pushError(errors, code) {
  if (!errors.includes(code)) errors.push(code);
}

function getEnchantAndTier(quality) {
  const [tierRaw, enchantRaw] = String(quality || '').split('.');
  return {
    tier: parseInt(tierRaw, 10) || 4,
    enchant: parseInt(enchantRaw, 10) || 0
  };
}

export function applyEstimateDiscount(price, discountPercent) {
  const errors = [];
  if (!isFiniteNonNegative(price)) pushError(errors, 'INVALID_PRICE');
  if (!DISCOUNTS.has(discountPercent)) pushError(errors, 'INVALID_DISCOUNT');

  return {
    ok: errors.length === 0,
    price: errors.length === 0 ? price * (1 - discountPercent / 100) : null,
    errors
  };
}

export function calculateQuoteForMargin(totalCost, marginRate) {
  const errors = [];
  if (!isFiniteNonNegative(totalCost)) pushError(errors, 'INVALID_COST');
  if (!isFiniteNonNegative(marginRate) || marginRate >= 1) pushError(errors, 'INVALID_MARGIN_RATE');

  return {
    ok: errors.length === 0,
    quotedSaleTotal: errors.length === 0 ? totalCost / (1 - marginRate) : null,
    errors
  };
}

export function getAlchemyRequirement(tier) {
  const parsedTier = parseInt(tier, 10);
  if (parsedTier === 4) return { tier: 'T3', qty: 1 };
  if (parsedTier === 5) return { tier: 'T5', qty: 1 };
  if (parsedTier === 6) return { tier: 'T5', qty: 2 };
  if (parsedTier === 7) return { tier: 'T7', qty: 1 };
  if (parsedTier === 8) return { tier: 'T7', qty: 2 };
  return { tier: 'T3', qty: 1 };
}

function getRRA(category, city, focus, customLocationSettings = null) {
  if (customLocationSettings?.active) {
    if (focus) return customLocationSettings.focusReturnRate;
    const bonus = customLocationSettings.mapBonus;
    return (18 + bonus) / (100 + 18 + bonus);
  }

  const bonusCity = BONUSES[category];
  const resourceCityBonus = (
    (category === '鋼條' && city === 'Thetford') ||
    (category === '布料' && city === 'Lymhurst') ||
    (category === '板材' && city === 'Fort Sterling')
  );
  const craftingCityBonus = bonusCity === city && !resourceCityBonus;

  if (focus) return (craftingCityBonus || resourceCityBonus) ? 0.479 : FOCUS_RRR_BONUS;
  if (craftingCityBonus || resourceCityBonus) return (18 + 15) / (100 + 18 + 15);
  return BASE_RRR;
}

function calculateMaterialConsumption(baseQty, quantity, rra) {
  const grossQty = baseQty * quantity;
  return {
    grossQty,
    expectedNetConsumption: grossQty - Math.floor(grossQty * rra)
  };
}

function calculateCraftingFee(recipe, quantity, quality, shopFeeRate) {
  const { tier, enchant } = getEnchantAndTier(quality);
  const multiplier = Math.pow(2, tier + enchant);
  const artifactValue = recipe.artifactVal > 0 ? recipe.artifactVal * Math.pow(2, tier - 4) * quantity : 0;
  const itemValue = (recipe.mainBaseQty * multiplier + (recipe.subBaseQty > 0 ? recipe.subBaseQty * multiplier : 0)) * quantity;
  return Math.round((itemValue + artifactValue) * TAX_RATE * shopFeeRate);
}

function buildPricedLine({ key, label, quantity, unitEstimate, discountPercent, noReturnRate }) {
  const discounted = applyEstimateDiscount(unitEstimate, discountPercent);
  return {
    key,
    label,
    quantity,
    originalEstimate: unitEstimate,
    discountPercent,
    appliedUnitPrice: discounted.price,
    estimatedCost: discounted.ok ? discounted.price * quantity : null,
    noReturnRate
  };
}

export function calculateQuotation(input) {
  const errors = [];
  const recipe = input?.recipe;
  const quantity = input?.quantity;
  const quality = input?.quality;
  const prices = input?.prices || {};
  const discounts = input?.discounts || {};
  const shopFeeRate = input?.shopFeeRate ?? 0;
  const customQuoteTotal = input?.customQuoteTotal ?? null;

  if (!recipe || typeof recipe !== 'object') pushError(errors, 'INVALID_RECIPE');
  if (!quality) pushError(errors, 'INVALID_QUALITY');
  if (!isFiniteNonNegative(quantity) || quantity === 0) pushError(errors, 'INVALID_QUANTITY');
  if (!isFiniteNonNegative(shopFeeRate)) pushError(errors, 'INVALID_SHOP_FEE');
  if (customQuoteTotal !== null && !isFiniteNonNegative(customQuoteTotal)) pushError(errors, 'INVALID_QUOTE');

  if (errors.length > 0) return { ok: false, quote: null, errors };

  const rra = getRRA(recipe.category, input.city, Boolean(input.focus), input.customLocationSettings);
  const mainConsumption = calculateMaterialConsumption(recipe.mainBaseQty || 0, quantity, rra);
  const subConsumption = calculateMaterialConsumption(recipe.subBaseQty || 0, quantity, rra);
  const mainKey = `${recipe.main}_${quality}`;
  const subKey = `${recipe.sub}_${quality}`;
  const materialLines = [];

  for (const line of [
    { key: mainKey, label: recipe.main, quantity: mainConsumption.expectedNetConsumption, baseQty: recipe.mainBaseQty || 0 },
    { key: subKey, label: recipe.sub, quantity: subConsumption.expectedNetConsumption, baseQty: recipe.subBaseQty || 0 }
  ]) {
    if (!line.label || line.baseQty <= 0) continue;
    const unitEstimate = prices[line.key] ?? 0;
    const discountPercent = discounts[line.key] ?? 0;
    if (!isFiniteNonNegative(unitEstimate)) pushError(errors, 'INVALID_PRICE');
    if (!DISCOUNTS.has(discountPercent)) pushError(errors, 'INVALID_DISCOUNT');
    materialLines.push(buildPricedLine({
      key: line.key,
      label: line.label,
      quantity: line.quantity,
      unitEstimate,
      discountPercent,
      noReturnRate: false
    }));
  }

  const { tier } = getEnchantAndTier(quality);
  const specialLines = [];
  if (recipe.artifactName) {
    const artifactQty = (recipe.artifactQty || 1) * quantity;
    const unitEstimate = prices.artifact ?? 0;
    const discountPercent = discounts.artifact ?? 0;
    if (!isFiniteNonNegative(unitEstimate)) pushError(errors, 'INVALID_PRICE');
    if (!DISCOUNTS.has(discountPercent)) pushError(errors, 'INVALID_DISCOUNT');
    specialLines.push(buildPricedLine({
      key: 'artifact',
      label: recipe.artifactName,
      quantity: artifactQty,
      unitEstimate,
      discountPercent,
      noReturnRate: true
    }));
  }

  if (recipe.alchemyName) {
    const requirement = getAlchemyRequirement(tier);
    const alchemyQty = requirement.qty * quantity;
    const unitEstimate = prices.alchemy ?? 0;
    const discountPercent = discounts.alchemy ?? 0;
    if (!isFiniteNonNegative(unitEstimate)) pushError(errors, 'INVALID_PRICE');
    if (!DISCOUNTS.has(discountPercent)) pushError(errors, 'INVALID_DISCOUNT');
    specialLines.push({
      ...buildPricedLine({
        key: 'alchemy',
        label: recipe.alchemyName,
        quantity: alchemyQty,
        unitEstimate,
        discountPercent,
        noReturnRate: true
      }),
      tier: requirement.tier,
      fixedRequirement: requirement.qty
    });
  }

  if (errors.length > 0) return { ok: false, quote: null, errors };

  const materialCost = materialLines.reduce((sum, line) => sum + line.estimatedCost, 0);
  const specialCost = specialLines.reduce((sum, line) => sum + line.estimatedCost, 0);
  const shopFee = calculateCraftingFee(recipe, quantity, quality, shopFeeRate);
  const totalCost = materialCost + specialCost + shopFee;
  const estimatedSaleUnit = input.estimatedSaleUnit ?? null;
  const estimatedSaleTotal = input.estimatedSaleTotal ?? (
    isFiniteNonNegative(estimatedSaleUnit) ? estimatedSaleUnit * quantity : 0
  );
  const quote90 = estimatedSaleTotal * 0.9;
  const quote85 = estimatedSaleTotal * 0.85;
  const margin8 = calculateQuoteForMargin(totalCost, 0.08).quotedSaleTotal;
  const margin10 = calculateQuoteForMargin(totalCost, 0.10).quotedSaleTotal;
  const quotedSaleTotal = customQuoteTotal ?? 0;
  const profit = quotedSaleTotal - totalCost;
  const marginRate = quotedSaleTotal === 0 ? null : profit / quotedSaleTotal;

  return {
    ok: true,
    quote: {
      quantity,
      quality,
      returnRate: rra,
      materials: materialLines,
      specialMaterials: specialLines,
      materialCost,
      specialCost,
      shopFee,
      totalCost,
      unitCost: quantity === 0 ? null : totalCost / quantity,
      estimatedSaleTotal,
      references: {
        estimate90: quote90,
        estimate85: quote85,
        margin8,
        margin10
      },
      customQuote: {
        total: quotedSaleTotal,
        unit: quantity === 0 ? null : quotedSaleTotal / quantity,
        profit,
        marginRate
      }
    },
    errors: []
  };
}
