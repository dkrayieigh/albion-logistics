import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  applyEstimateDiscount,
  calculateQuoteForMargin,
  calculateQuotation
} from '../src/calculators/quotationCalculator.js';
import { TAX_RATE } from '../src/data/constants.js';
import { resolveGeneralMaterialDisplayName } from '../src/presenters/materialDisplay.js';
import { formatSilver, parseNum } from '../src/utils/formatters.js';

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

test('quotation calculator audit fixture matches manual production quote arithmetic', () => {
  const quantity = 20;
  const quality = '6.3';
  const shopFeeRate = 690;
  const estimatedSaleTotal = 30000000;
  const customQuoteTotal = 22500000;
  const result = calculateQuotation({
    recipe: plainRecipe,
    quality,
    quantity,
    city: 'Thetford',
    focus: true,
    prices: {
      '鋼條_6.3': 105000,
      '布料_6.3': 22000
    },
    discounts: {
      '鋼條_6.3': 5,
      '布料_6.3': 0
    },
    shopFeeRate,
    estimatedSaleTotal,
    customQuoteTotal
  });

  const returnRate = 0.479;
  const mainGross = plainRecipe.mainBaseQty * quantity;
  const subGross = plainRecipe.subBaseQty * quantity;
  const mainNet = mainGross - Math.floor(mainGross * returnRate);
  const subNet = subGross - Math.floor(subGross * returnRate);
  const mainAppliedUnit = 105000 * 0.95;
  const subAppliedUnit = 22000;
  const mainCost = mainNet * mainAppliedUnit;
  const subCost = subNet * subAppliedUnit;
  const tierMultiplier = Math.pow(2, 6 + 3);
  const itemValue = (plainRecipe.mainBaseQty * tierMultiplier + plainRecipe.subBaseQty * tierMultiplier) * quantity;
  const shopFee = Math.round(itemValue * TAX_RATE * shopFeeRate);
  const totalCost = mainCost + subCost + shopFee;

  assert.equal(result.ok, true);
  assert.equal(result.quote.returnRate, returnRate);
  assert.equal(result.quote.materials[0].quantity, mainNet);
  assert.equal(result.quote.materials[0].appliedUnitPrice, mainAppliedUnit);
  assert.equal(result.quote.materials[0].estimatedCost, mainCost);
  assert.equal(result.quote.materials[1].quantity, subNet);
  assert.equal(result.quote.materials[1].appliedUnitPrice, subAppliedUnit);
  assert.equal(result.quote.materialCost, mainCost + subCost);
  assert.equal(result.quote.shopFee, shopFee);
  assert.equal(result.quote.totalCost, totalCost);
  assert.equal(result.quote.unitCost, totalCost / quantity);
  assert.equal(result.quote.references.estimate90, estimatedSaleTotal * 0.9);
  assert.equal(result.quote.references.estimate85, estimatedSaleTotal * 0.85);
  assert.equal(result.quote.references.margin8, totalCost / 0.92);
  assert.equal(result.quote.references.margin10, totalCost / 0.90);
  assert.equal(result.quote.customQuote.profit, customQuoteTotal - totalCost);
  assert.equal(result.quote.customQuote.marginRate, (customQuoteTotal - totalCost) / customQuoteTotal);
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
  assert.match(html, /🔍 Choose Target/);
  assert.match(html, /id="quote-recipe-display">Choose Target<\/span>/);
  assert.match(html, /Planner Results/);
  assert.match(source, /加入製作清單<br><span[^>]*>Add to Queue<\/span>/);
  assert.match(source, /from ['"]\.\/crafting\.js['"]/);
  assert.doesNotMatch(source, /from ['"]\.\/crafting\.js['"];\s*import/);
});

test('quotation uses shared recipe source and no native select renderer', () => {
  const source = readFileSync(new URL('../src/components/quotation.js', import.meta.url), 'utf8');

  assert.match(source, /import \{ RECIPES, enqueueCraftingPlan, getRecipeDisplayName, openItemSelector \} from ['"]\.\/crafting\.js['"]/);
  assert.match(source, /from ['"]\.\.\/presenters\/materialDisplay\.js['"]/);
  assert.doesNotMatch(source, /ALBION_DB|function allRecipes|Object\.values\(ALBION_DB\)|innerHTML = RECIPES\.map/);
  assert.doesNotMatch(source, /quote-recipe'\)\?\.addEventListener\('change'/);
});

test('quotation target picker starts blank and uses guarded placeholder flow', () => {
  const html = readFileSync(new URL('../src/index.html', import.meta.url), 'utf8');
  const source = readFileSync(new URL('../src/components/quotation.js', import.meta.url), 'utf8');
  const app = readFileSync(new URL('../src/app.js', import.meta.url), 'utf8');

  assert.match(html, /id="quote-recipe"[^>]*value=""/);
  assert.match(html, /<button id="btn-open-quote-item-selector"[\s\S]*🔍 Choose Target[\s\S]*id="quote-recipe-display">Choose Target<\/span>/);
  assert.match(source, /return RECIPES\.find\(recipe => recipe\.name === selectedName\) \|\| null/);
  assert.match(source, /🔍 Choose Target before calculating/);
  assert.doesNotMatch(source, /applyRecipeSelection\(RECIPES\[0\]\)/);
  assert.doesNotMatch(app, /document\.getElementById\('craft-recipe'\)\.value = Crafting\.RECIPES\[0\]\.name/);
});

test('quotation UI uses crafting-compatible quantity controls and tier labels', () => {
  const html = readFileSync(new URL('../src/index.html', import.meta.url), 'utf8');
  const source = readFileSync(new URL('../src/components/quotation.js', import.meta.url), 'utf8');

  assert.match(html, /id="quote-qty" value="20"/);
  ['sub-10', 'sub-1', 'add-1', 'add-10'].forEach(suffix => {
    assert.match(html, new RegExp(`id="btn-quote-qty-${suffix}"`));
  });
  assert.match(html, /id="btn-quote-qty-sub-10" data-val="-10">-10/);
  assert.match(html, /id="btn-quote-qty-sub-1" data-val="-1">-1/);
  assert.match(html, /id="btn-quote-qty-add-1" data-val="1">\+1/);
  assert.match(html, /id="btn-quote-qty-add-10" data-val="10">\+10/);
  assert.match(source, /btn-quote-qty-sub-10/);
  assert.match(html, /<div class="field-label-copy"><span>目標階級<\/span><small>Target Tier<\/small><\/div>\s*<span id="quote-tier-hint" class="field-inline-hint">Choose Target Tier<\/span>/);
  assert.match(html, /<span class="field-label-copy"><span>製作數量<\/span><small>Quantity<\/small><\/span><\/label>/);
  assert.match(html, /<span class="field-label-copy"><span>製作地點<\/span><small>Location<\/small><\/span><\/label>/);
  assert.match(html, /id="quote-rra-badge">RRR: --<\/span>/);
  assert.match(html, /Target Tier/);
  assert.match(html, /Material Tier/);
  assert.doesNotMatch(html, /Material Quality|Craft Amount|Crafting Location|Quote Result|Return rate|Current Return Rate/);
  assert.match(source, /Choose Target Tier/);
  assert.match(source, /quote-tier-hint/);
  assert.match(source, /hint\.style\.display = quoteDraft\.quality \? 'none' : ''/);
  assert.doesNotMatch(source, /quote-hint field-inline-hint|appendChild\(hint\)/);
  assert.match(source, /RRR: --/);
  assert.match(source, /quote\.returnRate/);
});

test('quotation planner cleanup uses intake wording display mapping and static result cards', () => {
  const html = readFileSync(new URL('../src/index.html', import.meta.url), 'utf8');
  const source = readFileSync(new URL('../src/components/quotation.js', import.meta.url), 'utf8');

  assert.match(html, /採購入庫<br><span[^>]*>Intake<\/span>/);
  assert.doesNotMatch(html, /採購入庫<br><span[^>]*>Purchase<\/span>/);
  assert.match(html, /<span>主料<br><small>Main<\/small><\/span><strong id="quote-main-label">-<\/strong><em id="quote-consumption-main">0<\/em>/);
  assert.match(html, /<span>副料<br><small>Sub<\/small><\/span><strong id="quote-sub-label">-<\/strong><em id="quote-consumption-sub">0<\/em>/);
  assert.match(html, /90% EMV/);
  assert.match(html, /85% EMV/);
  assert.match(html, /GP 8%/);
  assert.match(html, /GP 10%/);
  assert.match(html, /<button class="btn btn-secondary" id="quote-quick-90" data-quote-action="quick">90% EMV<\/button>/);
  assert.match(html, /<button class="btn btn-secondary" id="quote-quick-85" data-quote-action="quick">85% EMV<\/button>/);
  assert.match(html, /<button class="btn btn-secondary" id="quote-quick-margin-8" data-quote-action="quick">GP 8%<\/button>/);
  assert.match(html, /<button class="btn btn-secondary" id="quote-quick-margin-10" data-quote-action="quick">GP 10%<\/button>/);
  assert.match(html, /GP 8% reference/);
  assert.match(html, /GP 10% reference/);
  assert.doesNotMatch(html, /quote-quick-90-label|quote-quick-85-label/);
  assert.match(html, /<option value="鋼條">鋼條 \/ Bars<\/option>/);
  assert.match(html, /<option value="布料">布料 \/ Cloth<\/option>/);
  assert.match(html, /<option value="板材">板材 \/ Planks<\/option>/);
  assert.match(html, /<option value="皮革">皮革 \/ Leather<\/option>/);
  assert.match(source, /resolveGeneralMaterialDisplayName\(recipe\.main\)/);
  assert.match(source, /resolveGeneralMaterialDisplayName\(recipe\.sub\)/);
  assert.match(source, /resetQuoteOutputs/);
  assert.match(source, /setQuickQuoteValue/);
  assert.doesNotMatch(source, /quote-quick-90-label|quote-quick-85-label/);
  assert.doesNotMatch(source, /Choose Target to enter material estimates/);
  assert.doesNotMatch(source, /setHTML\('quote-result-box', `<div class="quote-summary-grid"/);
});

test('general material display presenter maps runtime material names without changing keys', () => {
  assert.equal(resolveGeneralMaterialDisplayName('鋼條'), 'Bars');
  assert.equal(resolveGeneralMaterialDisplayName('布料'), 'Cloth');
  assert.equal(resolveGeneralMaterialDisplayName('板材'), 'Planks');
  assert.equal(resolveGeneralMaterialDisplayName('皮革'), 'Leather');
  assert.equal(resolveGeneralMaterialDisplayName('Unknown Material'), 'Unknown Material');
});

test('quotation material estimate rows keep discounts only for normal materials', () => {
  const html = readFileSync(new URL('../src/index.html', import.meta.url), 'utf8');
  const source = readFileSync(new URL('../src/components/quotation.js', import.meta.url), 'utf8');

  assert.match(html, /Material Estimates/);
  assert.match(source, /const materialRows/);
  assert.match(source, /const specialRows/);
  assert.match(source, /<label class="form-label">特殊材料<br><span style="font-size: 0\.8em; opacity: 0\.7;">Special Materials<\/span><\/label>/);
  assert.match(source, /Special Materials/);
  assert.doesNotMatch(source, /quote-special-heading/);
  assert.match(source, /Fixed requirement/);
  assert.match(source, /renderMaterialEstimateRows[\s\S]*renderDiscountButtons\(row\.key\)/);
  assert.doesNotMatch(source, /renderSpecialEstimateRows[\s\S]*renderDiscountButtons\(row\.key\)/);
  assert.match(source, /data-special-key="\$\{escapeHTML\(row\.key\)\}"/);
  assert.match(source, /預估成本 \/ Estimated Cost/);
  assert.match(source, /prices\.artifact = materialPrice\('artifact'\)/);
  assert.match(source, /prices\.alchemy = materialPrice\('alchemy'\)/);
});

test('quotation special material costs still contribute to the total without discounts', () => {
  const recipe = {
    name: 'Special Test',
    category: 'plate',
    main: '鋼條',
    mainBaseQty: 16,
    sub: '',
    subBaseQty: 0,
    artifactName: 'Test Artifact',
    artifactQty: 2,
    artifactVal: 999999,
    alchemyName: 'Test Alchemy'
  };

  const result = calculateQuotation({
    recipe,
    quality: '6.0',
    quantity: 3,
    city: 'Bridgewatch',
    focus: false,
    prices: {
      '鋼條_6.0': 100,
      artifact: 1000,
      alchemy: 50
    },
    discounts: {
      '鋼條_6.0': 5
    },
    shopFeeRate: 0,
    estimatedSaleTotal: 0,
    customQuoteTotal: 0
  });

  assert.equal(result.ok, true);
  assert.equal(result.quote.specialMaterials.find(line => line.key === 'artifact').estimatedCost, 6000);
  assert.equal(result.quote.specialMaterials.find(line => line.key === 'alchemy').estimatedCost, 300);
  assert.equal(result.quote.totalCost, result.quote.materialCost + result.quote.specialCost + result.quote.shopFee);
  assert.equal(result.quote.specialCost, 6300);
});

test('quotation price edits refresh calculation without rebuilding material input rows', () => {
  const source = readFileSync(new URL('../src/components/quotation.js', import.meta.url), 'utf8');

  assert.match(source, /function refreshQuotationCalculation\(\)/);
  assert.match(source, /data-quote-action'\) === 'price'\) refreshQuotationCalculation\(\)/);
  assert.doesNotMatch(source, /data-quote-action'\) === 'price'\) renderQuotation\(\)/);
  assert.match(source, /setDiscount\(key, discount\)[\s\S]*refreshQuotationCalculation\(\)/);
  assert.match(source, /quote-price-\$\{lineKey\}/);
});

test('quotation money formatter displays grouped integers while parser keeps numeric inputs', () => {
  assert.equal(formatSilver(2140000), '2,140,000');
  assert.equal(formatSilver(1926000), '1,926,000');
  assert.equal(formatSilver(16987274), '16,987,274');
  assert.equal(formatSilver(-15061274), '-15,061,274');
  assert.equal(formatSilver(0), '0');
  assert.equal(parseNum('2140000'), 2140000);
  assert.equal(parseNum('2,140,000'), 2140000);
});

test('format-num input source formats on blur or change without input-time comma rewriting', () => {
  const app = readFileSync(new URL('../src/app.js', import.meta.url), 'utf8');

  assert.match(app, /cleanNumericInputValue/);
  assert.match(app, /formatNumericInput/);
  assert.match(app, /document\.addEventListener\('change'[\s\S]*formatNumericInput/);
  assert.match(app, /document\.addEventListener\('blur'[\s\S]*formatNumericInput/);
  assert.match(app, /formatSilver\(parseNum\(raw\)\)/);
  assert.doesNotMatch(app, /document\.addEventListener\('input'[\s\S]*toLocaleString\(\)/);
});

test('quotation margin presentation can show uncapped negative percentages with tone classes', () => {
  const source = readFileSync(new URL('../src/components/quotation.js', import.meta.url), 'utf8');
  const css = readFileSync(new URL('../src/style.css', import.meta.url), 'utf8');

  assert.equal(((-15061274 / 1926000) * 100).toFixed(1), '-782.0');
  assert.match(source, /formatPercent\(quote\.customQuote\.marginRate\)/);
  assert.match(source, /setToneClass\('quote-profit', quote\.customQuote\.profit\)/);
  assert.match(source, /setToneClass\('quote-margin', quote\.customQuote\.marginRate\)/);
  assert.match(css, /\.quote-tone-positive\s*\{[^}]*color:\s*var\(--accent-green\)/s);
  assert.match(css, /\.quote-tone-negative\s*\{[^}]*color:\s*var\(--accent-red\)/s);
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
  const source = readFileSync(new URL('../src/components/quotation.js', import.meta.url), 'utf8');

  assert.match(html, /Material Estimates/);
  assert.match(html, />Location<\/span><\/th>/);
  assert.match(html, /Planner Results/);
  assert.match(source, /data-quote-action="enqueue"/);
  assert.doesNotMatch(html, /Crafting City|>City<\/span><\/th>|Crafting Location|Quote Result/);
  assert.doesNotMatch(source, /Object\.entries\(SYSTEM_CITIES\)/);
});

test('quotation production source does not touch storage schema backup reset or migration', () => {
  const calculator = readFileSync(new URL('../src/calculators/quotationCalculator.js', import.meta.url), 'utf8');
  const component = readFileSync(new URL('../src/components/quotation.js', import.meta.url), 'utf8');
  const combined = `${calculator}\n${component}`;

  assert.doesNotMatch(combined, /albion_crafting|albion-logistics-v2-state|backup|migration|removeItem|clear\(/);
});
