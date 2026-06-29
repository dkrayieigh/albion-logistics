import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  applyEstimateDiscount,
  calculateQuoteForMargin,
  calculateQuotation
} from '../src/calculators/quotationCalculator.js';

const plainRecipe = {
  name: 'Plain Item',
  category: '錘矛',
  main: '鋼條',
  sub: '布料',
  mainBaseQty: 16,
  subBaseQty: 8,
  artifactName: null,
  artifactVal: 0,
  artifactQty: 0,
  alchemyName: null
};

const artifactRecipe = {
  ...plainRecipe,
  name: 'Artifact Item',
  artifactName: '血鑄之刃 Bloodforged Blade',
  artifactVal: 999999,
  artifactQty: 2
};

const alchemyRecipe = {
  ...plainRecipe,
  name: 'Alchemy Item',
  artifactName: '狼人遺骸 Werewolf Remnant',
  artifactVal: 888888,
  artifactQty: 1,
  alchemyName: '狼人獠牙 Werewolf Fangs'
};

test('quotation discount accepts only 0 5 6 7 percent and preserves decimals', () => {
  assert.equal(applyEstimateDiscount(123.45, 0).price, 123.45);
  assert.equal(applyEstimateDiscount(100, 5).price, 95);
  assert.equal(applyEstimateDiscount(100, 6).price, 94);
  assert.equal(applyEstimateDiscount(100, 7).price, 93);
  assert.deepEqual(applyEstimateDiscount(100, 8), {
    ok: false,
    price: null,
    errors: ['INVALID_DISCOUNT']
  });
});

test('quotation calculator prices expected returned materials without display rounding', () => {
  const result = calculateQuotation({
    recipe: plainRecipe,
    quality: '6.1',
    quantity: 10,
    city: 'Thetford',
    focus: false,
    prices: {
      '鋼條_6.1': 10.5,
      '布料_6.1': 20
    },
    discounts: {
      '鋼條_6.1': 5,
      '布料_6.1': 0
    },
    shopFeeRate: 0,
    estimatedSaleTotal: 10000,
    customQuoteTotal: 9000
  });

  assert.equal(result.ok, true);
  assert.equal(result.quote.materials[0].quantity, 121);
  assert.equal(result.quote.materials[0].appliedUnitPrice, 9.975);
  assert.equal(result.quote.materials[0].estimatedCost, 1206.975);
  assert.equal(result.quote.materials[1].quantity, 61);
  assert.equal(result.quote.materialCost, 2426.975);
});

test('quotation calculator includes artifact fixed cost and never uses artifactVal as purchase cost', () => {
  const result = calculateQuotation({
    recipe: artifactRecipe,
    quality: '6.1',
    quantity: 3,
    city: 'Martlock',
    focus: false,
    prices: {
      '鋼條_6.1': 0,
      '布料_6.1': 0,
      artifact: 1000
    },
    discounts: {
      artifact: 6
    },
    shopFeeRate: 0,
    estimatedSaleTotal: 0
  });

  assert.equal(result.ok, true);
  assert.equal(result.quote.specialMaterials[0].quantity, 6);
  assert.equal(result.quote.specialMaterials[0].appliedUnitPrice, 940);
  assert.equal(result.quote.specialMaterials[0].estimatedCost, 5640);
  assert.equal(result.quote.specialCost, 5640);
  assert.notEqual(result.quote.specialCost, artifactRecipe.artifactVal);
});

test('quotation calculator includes alchemy fixed tier cost without return rate', () => {
  const result = calculateQuotation({
    recipe: alchemyRecipe,
    quality: '6.3',
    quantity: 4,
    city: 'Bridgewatch',
    focus: true,
    prices: {
      '鋼條_6.3': 0,
      '布料_6.3': 0,
      artifact: 100,
      alchemy: 250
    },
    discounts: {
      artifact: 0,
      alchemy: 7
    },
    shopFeeRate: 0,
    estimatedSaleTotal: 0
  });
  const alchemy = result.quote.specialMaterials.find(line => line.key === 'alchemy');

  assert.equal(result.ok, true);
  assert.equal(alchemy.tier, 'T5');
  assert.equal(alchemy.fixedRequirement, 2);
  assert.equal(alchemy.quantity, 8);
  assert.equal(alchemy.noReturnRate, true);
  assert.ok(Math.abs(alchemy.appliedUnitPrice - 232.5) < 0.000001);
  assert.ok(Math.abs(alchemy.estimatedCost - 1860) < 0.000001);
});

test('quotation calculator includes shop fee exactly once', () => {
  const withFee = calculateQuotation({
    recipe: plainRecipe,
    quality: '4.0',
    quantity: 2,
    city: 'Thetford',
    focus: false,
    prices: { '鋼條_4.0': 1, '布料_4.0': 1 },
    discounts: {},
    shopFeeRate: 500,
    estimatedSaleTotal: 0
  });
  const noFee = calculateQuotation({
    recipe: plainRecipe,
    quality: '4.0',
    quantity: 2,
    city: 'Thetford',
    focus: false,
    prices: { '鋼條_4.0': 1, '布料_4.0': 1 },
    discounts: {},
    shopFeeRate: 0,
    estimatedSaleTotal: 0
  });

  assert.equal(withFee.ok, true);
  assert.equal(withFee.quote.totalCost - noFee.quote.totalCost, withFee.quote.shopFee);
  assert.ok(withFee.quote.shopFee > 0);
});

test('quotation calculator returns estimate references and true margin quotes', () => {
  const totalCost = 9200;
  const result = calculateQuotation({
    recipe: plainRecipe,
    quality: '4.0',
    quantity: 1,
    city: 'Martlock',
    focus: false,
    prices: { '鋼條_4.0': 0, '布料_4.0': 0 },
    discounts: {},
    shopFeeRate: 0,
    estimatedSaleTotal: 10000,
    customQuoteTotal: totalCost
  });

  assert.equal(result.quote.references.estimate90, 9000);
  assert.equal(result.quote.references.estimate85, 8500);
  assert.equal(calculateQuoteForMargin(9200, 0.08).quotedSaleTotal, 10000);
  assert.equal(calculateQuoteForMargin(9000, 0.10).quotedSaleTotal, 10000);
  assert.equal(result.quote.customQuote.profit, result.quote.customQuote.total - result.quote.totalCost);
});

test('quotation calculator supports negative profit and null margin for zero quote', () => {
  const negative = calculateQuotation({
    recipe: plainRecipe,
    quality: '4.0',
    quantity: 1,
    city: 'Martlock',
    focus: false,
    prices: { '鋼條_4.0': 100, '布料_4.0': 100 },
    discounts: {},
    shopFeeRate: 0,
    estimatedSaleTotal: 0,
    customQuoteTotal: 1
  });
  const zero = calculateQuotation({
    recipe: plainRecipe,
    quality: '4.0',
    quantity: 1,
    city: 'Martlock',
    focus: false,
    prices: { '鋼條_4.0': 100, '布料_4.0': 100 },
    discounts: {},
    shopFeeRate: 0,
    estimatedSaleTotal: 0,
    customQuoteTotal: 0
  });

  assert.ok(negative.quote.customQuote.profit < 0);
  assert.equal(zero.quote.customQuote.marginRate, null);
});

test('quotation calculator handles recipes without artifact or alchemy', () => {
  const result = calculateQuotation({
    recipe: plainRecipe,
    quality: '4.0',
    quantity: 1,
    city: 'Thetford',
    focus: false,
    prices: { '鋼條_4.0': 1, '布料_4.0': 1 },
    discounts: {},
    shopFeeRate: 0,
    estimatedSaleTotal: 0
  });

  assert.equal(result.ok, true);
  assert.deepEqual(result.quote.specialMaterials, []);
});

test('quotation calculator returns controlled errors for invalid input', () => {
  const result = calculateQuotation({
    recipe: plainRecipe,
    quality: '',
    quantity: -1,
    city: 'Thetford',
    prices: { '鋼條_4.0': -1 },
    discounts: { '鋼條_4.0': 9 },
    shopFeeRate: -1,
    customQuoteTotal: -1
  });

  assert.equal(result.ok, false);
  assert.equal(result.quote, null);
  assert.deepEqual(result.errors, ['INVALID_QUALITY', 'INVALID_QUANTITY', 'INVALID_SHOP_FEE', 'INVALID_QUOTE']);
});

test('quotation unit and total conversions are arithmetic only', () => {
  const quantity = 7;
  const estimateUnit = 1234.5;
  const quoteUnit = 1500;

  assert.equal(estimateUnit * quantity, 8641.5);
  assert.equal((estimateUnit * quantity) / quantity, estimateUnit);
  assert.equal(quoteUnit * quantity, 10500);
  assert.equal((quoteUnit * quantity) / quantity, quoteUnit);
});

test('quotation component source preserves estimates, quick quote, matrix, and read-only isolation', () => {
  const source = readFileSync(new URL('../src/components/quotation.js', import.meta.url), 'utf8');

  assert.match(source, /quality-matrix-row/);
  assert.match(source, /QUOTE_QUALITY_ROWS/);
  assert.match(source, /setQuoteTotal/);
  assert.match(source, /quoteDraft/);
  assert.match(source, /enqueueCraftingPlan/);
  assert.match(source, /openItemSelector/);
  assert.match(source, /data-quote-action="enqueue"/);
  assert.doesNotMatch(source, /from ['"].*core\/state\.js/);
  assert.doesNotMatch(source, /\bstate\b|saveState|localStorage|transactions|craftingQueue|dispatchEvent|submitPurchase|submitCraftAll|assets\.cash/);
});

test('quotation visible planner name and enqueue button use the bounded UI contract', () => {
  const html = readFileSync(new URL('../src/index.html', import.meta.url), 'utf8');
  const source = readFileSync(new URL('../src/components/quotation.js', import.meta.url), 'utf8');

  assert.match(html, /<span[^>]*>Planner<\/span>/);
  assert.match(html, /Planner/);
  assert.doesNotMatch(html, /接單試算|Quotation Planner/);
  assert.doesNotMatch(html, /<select id="quote-recipe"/);
  assert.match(html, /id="btn-open-quote-item-selector"/);
  assert.match(html, /id="quote-recipe"[^>]*type="hidden"|type="hidden"[^>]*id="quote-recipe"/);
  assert.match(html, /Choose Target/);
  assert.match(source, /加入製作清單/);
  assert.match(source, /from ['"]\.\/crafting\.js['"]/);
  assert.doesNotMatch(source, /from ['"]\.\/crafting\.js['"];\s*import/);
});

test('quotation uses shared recipe source and no native select renderer', () => {
  const source = readFileSync(new URL('../src/components/quotation.js', import.meta.url), 'utf8');

  assert.match(source, /import \{ RECIPES, enqueueCraftingPlan, getRecipeDisplayName, openItemSelector \} from ['"]\.\/crafting\.js['"]/);
  assert.doesNotMatch(source, /ALBION_DB|function allRecipes|Object\.values\(ALBION_DB\)|innerHTML = RECIPES\.map/);
  assert.doesNotMatch(source, /quote-recipe'\)\?\.addEventListener\('change'/);
});

test('quotation target picker starts blank and uses guarded placeholder flow', () => {
  const html = readFileSync(new URL('../src/index.html', import.meta.url), 'utf8');
  const source = readFileSync(new URL('../src/components/quotation.js', import.meta.url), 'utf8');
  const app = readFileSync(new URL('../src/app.js', import.meta.url), 'utf8');

  assert.match(html, /id="quote-recipe"[^>]*value=""/);
  assert.match(html, /id="quote-recipe-display">Choose Target<\/span>/);
  assert.match(source, /return RECIPES\.find\(recipe => recipe\.name === selectedName\) \|\| null/);
  assert.match(source, /Choose Target before calculating/);
  assert.doesNotMatch(source, /applyRecipeSelection\(RECIPES\[0\]\)/);
  assert.doesNotMatch(app, /document\.getElementById\('craft-recipe'\)\.value = Crafting\.RECIPES\[0\]\.name/);
});

test('quotation UI uses crafting-compatible quantity controls and tier labels', () => {
  const html = readFileSync(new URL('../src/index.html', import.meta.url), 'utf8');
  const source = readFileSync(new URL('../src/components/quotation.js', import.meta.url), 'utf8');

  ['sub-10', 'sub-1', 'add-1', 'add-10'].forEach(suffix => {
    assert.match(html, new RegExp(`id="btn-quote-qty-${suffix}"`));
  });
  assert.match(html, /id="btn-quote-qty-sub-10" data-val="-10">-10/);
  assert.match(html, /id="btn-quote-qty-sub-1" data-val="-1">-1/);
  assert.match(html, /id="btn-quote-qty-add-1" data-val="1">\+1/);
  assert.match(html, /id="btn-quote-qty-add-10" data-val="10">\+10/);
  assert.match(source, /btn-quote-qty-sub-10/);
  assert.match(html, /Target Tier/);
  assert.match(html, /Material Tier/);
  assert.doesNotMatch(html, /Material Quality/);
});

test('quotation material estimate rows keep discounts for normal and special materials', () => {
  const html = readFileSync(new URL('../src/index.html', import.meta.url), 'utf8');
  const source = readFileSync(new URL('../src/components/quotation.js', import.meta.url), 'utf8');

  assert.match(html, /Material Estimates/);
  assert.match(source, /const materialRows/);
  assert.match(source, /const specialRows/);
  assert.match(source, /Special Materials/);
  assert.match(source, /Fixed requirement/);
  assert.match(source, /renderDiscountButtons\(row\.key\)/);
  assert.match(source, /prices\.artifact = materialPrice\('artifact'\)/);
  assert.match(source, /prices\.alchemy = materialPrice\('alchemy'\)/);
});

test('quotation price edits refresh calculation without rebuilding material input rows', () => {
  const source = readFileSync(new URL('../src/components/quotation.js', import.meta.url), 'utf8');

  assert.match(source, /function refreshQuotationCalculation\(\)/);
  assert.match(source, /data-quote-action'\) === 'price'\) refreshQuotationCalculation\(\)/);
  assert.doesNotMatch(source, /data-quote-action'\) === 'price'\) renderQuotation\(\)/);
  assert.match(source, /setDiscount\(key, discount\)[\s\S]*refreshQuotationCalculation\(\)/);
  assert.match(source, /quote-price-\$\{lineKey\}/);
});

test('quotation autocomplete policy is present without app owned input history', () => {
  const html = readFileSync(new URL('../src/index.html', import.meta.url), 'utf8');
  const source = readFileSync(new URL('../src/components/quotation.js', import.meta.url), 'utf8');
  const app = readFileSync(new URL('../src/app.js', import.meta.url), 'utf8');

  ['quote-qty', 'quote-shop-fee', 'quote-est-unit', 'quote-est-total', 'quote-custom-unit', 'quote-custom-total'].forEach(id => {
    assert.match(html, new RegExp(`id="${id}"[^>]*autocomplete="off"`));
  });
  assert.match(source, /quote-price-input[\s\S]*autocomplete="off" inputmode="decimal"/);
  assert.match(app, /applyInputAutocompletePolicy/);
  assert.doesNotMatch(`${html}\n${source}\n${app}`, /autocomplete="new-password"|inputHistory|recentInputs|localStorage\.setItem\(['"][^'"]*history/i);
});

test('visible wording uses material estimates and location labels', () => {
  const html = readFileSync(new URL('../src/index.html', import.meta.url), 'utf8');

  assert.match(html, /Material Estimates/);
  assert.match(html, /Crafting Location/);
  assert.match(html, />Location<\/span><\/th>/);
  assert.doesNotMatch(html, /Crafting City|>City<\/span><\/th>/);
});

test('quotation production source does not touch storage schema backup reset or migration', () => {
  const calculator = readFileSync(new URL('../src/calculators/quotationCalculator.js', import.meta.url), 'utf8');
  const component = readFileSync(new URL('../src/components/quotation.js', import.meta.url), 'utf8');
  const combined = `${calculator}\n${component}`;

  assert.doesNotMatch(combined, /albion_crafting|albion-logistics-v2-state|backup|migration|removeItem|clear\(/);
});
