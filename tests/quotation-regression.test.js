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

  assert.match(source, /RECIPES,\s*enqueueCraftingPlan,\s*getRecipeDisplayName,\s*openItemSelector,\s*renderCraftingQueue,\s*updateShoppingListTotal\s*\}\s*from ['"]\.\/crafting\.js['"]/);
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

class FakeElement {
  constructor(id = '') {
    this.id = id;
    this.value = '';
    this.checked = false;
    this.children = [];
    this.handlers = {};
    this.attributes = new Map();
    this.style = {};
    this.className = '';
    this.textContent = '';
    this.innerHTMLSetCount = 0;
    this.classList = {
      add: () => {},
      remove: () => {},
      toggle: () => {}
    };
  }

  set innerHTML(value) {
    this.innerHTMLSetCount++;
    this._innerHTML = value;
    if (value === '') this.children = [];
  }

  get innerHTML() {
    return this._innerHTML || '';
  }

  set innerText(value) {
    this._innerText = value;
  }

  get innerText() {
    return this._innerText || '';
  }

  addEventListener(type, handler) {
    if (!this.handlers[type]) this.handlers[type] = [];
    this.handlers[type].push(handler);
  }

  appendChild(child) {
    this.children.push(child);
    return child;
  }

  setAttribute(name, value) {
    this.attributes.set(name, String(value));
  }

  getAttribute(name) {
    return this.attributes.get(name) ?? null;
  }

  removeAttribute(name) {
    this.attributes.delete(name);
  }

  closest(selector) {
    if (selector === '[data-quote-action]' && this.attributes.has('data-quote-action')) return this;
    return null;
  }

  click() {
    this.handlers.click?.forEach(handler => handler({ target: this }));
  }

  trigger(type) {
    this.handlers[type]?.forEach(handler => handler({ target: this }));
  }
}

let appFocusImportId = 0;

async function setupAppFocusHarness() {
  const handlers = {};
  globalThis.document = {
    addEventListener(type, handler) {
      if (!handlers[type]) handlers[type] = [];
      handlers[type].push(handler);
    },
    querySelectorAll() {
      return [];
    },
    getElementById() {
      return null;
    },
    createElement() {
      return new FakeElement();
    }
  };
  globalThis.window = {};
  globalThis.localStorage = {
    getItem() { return null; },
    setItem() {},
    removeItem() {}
  };
  globalThis.alert = () => {};
  globalThis.confirm = () => true;
  await import(`../src/app.js?focus-regression=${appFocusImportId++}`);
  return {
    handlers,
    focus(target) {
      handlers.focusin?.forEach(handler => handler({ target }));
    },
    trigger(type, target) {
      handlers[type]?.forEach(handler => handler({ target }));
    }
  };
}

function makeFocusTarget(overrides = {}) {
  const classes = new Set((overrides.className || '').split(/\s+/).filter(Boolean));
  const target = {
    tagName: overrides.tagName ?? 'INPUT',
    type: overrides.type ?? 'text',
    inputMode: overrides.inputMode ?? '',
    disabled: Boolean(overrides.disabled),
    readOnly: Boolean(overrides.readOnly),
    value: overrides.value ?? '12345678',
    selectCalls: 0,
    classList: {
      contains(className) {
        return classes.has(className);
      }
    },
    select() {
      this.selectCalls++;
    }
  };
  if (overrides.select === null) delete target.select;
  return target;
}

test('numeric entry focus selects format-num inputs once without changing value or dispatching input/change', async () => {
  const harness = await setupAppFocusHarness();
  const target = makeFocusTarget({ className: 'format-num', value: '12,345,678' });
  let inputEvents = 0;
  let changeEvents = 0;
  harness.handlers.input?.push(() => { inputEvents++; });
  harness.handlers.change?.push(() => { changeEvents++; });

  harness.focus(target);
  harness.trigger('click', target);

  assert.equal(target.selectCalls, 1);
  assert.equal(target.value, '12,345,678');
  assert.equal(inputEvents, 0);
  assert.equal(changeEvents, 0);
});

test('numeric entry focus selects inputmode numeric decimal and queue format-num inputs', async () => {
  const harness = await setupAppFocusHarness();
  const numeric = makeFocusTarget({ inputMode: 'numeric' });
  const decimal = makeFocusTarget({ inputMode: 'decimal' });
  const queue = makeFocusTarget({ className: 'format-num queue-art-price' });

  harness.focus(numeric);
  harness.focus(decimal);
  harness.focus(queue);

  assert.equal(numeric.selectCalls, 1);
  assert.equal(decimal.selectCalls, 1);
  assert.equal(queue.selectCalls, 1);
});

test('numeric entry focus excludes readonly disabled plain text and non-input targets', async () => {
  const harness = await setupAppFocusHarness();
  const readOnly = makeFocusTarget({ className: 'format-num', readOnly: true });
  const disabled = makeFocusTarget({ className: 'format-num', disabled: true });
  const plainText = makeFocusTarget({});
  const nonInput = makeFocusTarget({ tagName: 'TEXTAREA', className: 'format-num' });

  harness.focus(readOnly);
  harness.focus(disabled);
  harness.focus(plainText);
  harness.focus(nonInput);

  assert.equal(readOnly.selectCalls, 0);
  assert.equal(disabled.selectCalls, 0);
  assert.equal(plainText.selectCalls, 0);
  assert.equal(nonInput.selectCalls, 0);
});

test('numeric entry focus excludes hidden button checkbox radio file submit reset and missing select', async () => {
  const harness = await setupAppFocusHarness();
  const excluded = ['hidden', 'button', 'checkbox', 'radio', 'file', 'submit', 'reset']
    .map(type => makeFocusTarget({ type, className: 'format-num' }));
  const missingSelect = makeFocusTarget({ className: 'format-num', select: null });

  excluded.forEach(target => harness.focus(target));
  harness.focus(missingSelect);

  excluded.forEach(target => assert.equal(target.selectCalls, 0));
  assert.equal(missingSelect.selectCalls, 0);
  assert.equal(typeof missingSelect.select, 'undefined');
});

function makeFakeQuotationDocument() {
  const elements = new Map();
  const documentHandlers = {};
  const doc = {
    getElementById(id) {
      if (!elements.has(id)) elements.set(id, new FakeElement(id));
      return elements.get(id);
    },
    createElement(tagName) {
      const element = new FakeElement();
      element.tagName = tagName.toUpperCase();
      return element;
    },
    querySelectorAll() {
      return [];
    },
    addEventListener(type, handler) {
      if (!documentHandlers[type]) documentHandlers[type] = [];
      documentHandlers[type].push(handler);
    },
    trigger(type, target) {
      documentHandlers[type]?.forEach(handler => handler({ target }));
    }
  };
  return { document: doc, elements };
}

function findElementByText(root, text) {
  if (root.textContent === text) return root;
  for (const child of root.children) {
    const found = findElementByText(child, text);
    if (found) return found;
  }
  return null;
}

async function setupQuotationHarness() {
  const harness = makeFakeQuotationDocument();
  globalThis.document = harness.document;
  globalThis.window = {
    showToast(message, tone) {
      harness.toasts.push({ message, tone });
    }
  };
  harness.toasts = [];

  const { RECIPES } = await import('../src/components/crafting.js');
  const { craftingQueue } = await import('../src/core/state.js');
  const quotation = await import('../src/components/quotation.js');
  craftingQueue.splice(0, craftingQueue.length);

  [
    'quote-recipe',
    'quote-recipe-display',
    'quote-qty',
    'quote-city',
    'quote-focus',
    'quote-hideout-map-bonus',
    'quote-hideout-focus-rrr',
    'quote-shop-fee',
    'quote-est-unit',
    'quote-est-total',
    'quote-custom-unit',
    'quote-custom-total',
    'btn-quote-qty-sub-10',
    'btn-quote-qty-sub-1',
    'btn-quote-qty-add-1',
    'btn-quote-qty-add-10',
    'quote-quality-pill-group',
    'quote-tier-hint',
    'quote-main-label',
    'quote-sub-label',
    'quote-hideout-group',
    'quote-material-inputs',
    'quote-result-box',
    'quote-rra-badge',
    'quote-consumption-main',
    'quote-consumption-sub',
    'quote-total-cost',
    'quote-unit-cost',
    'quote-shop-fee-result',
    'quote-est-total-display',
    'quote-ref-90',
    'quote-ref-85',
    'quote-ref-margin-8',
    'quote-ref-margin-10',
    'quote-profit',
    'quote-margin',
    'quote-quick-90',
    'quote-quick-85',
    'quote-quick-margin-8',
    'quote-quick-margin-10',
    'nav-tab-crafting',
    'global-shopfee',
    'crafting-queue-tbody',
    'shopping-list-content',
    'queue-total-cost',
    'hideout-focus-rrr',
    'hideout-map-bonus'
  ].forEach(id => harness.document.getElementById(id));

  harness.document.getElementById('quote-recipe').value = RECIPES[0].name;
  harness.document.getElementById('quote-qty').value = '3';
  harness.document.getElementById('quote-city').value = 'Thetford';
  harness.document.getElementById('quote-shop-fee').value = '0';
  harness.document.getElementById('global-shopfee').value = '0';
  harness.document.getElementById('quote-focus').checked = false;
  quotation.initQuotationEvents();

  return { ...harness, quotation, craftingQueue };
}

async function setupReadyQuotationHarness() {
  const harness = await setupQuotationHarness();
  const qualityButton = findElementByText(harness.document.getElementById('quote-quality-pill-group'), '4.0');
  assert.ok(qualityButton);
  qualityButton.click();
  return harness;
}

test('quotation programmatic estimate unit to total uses formatSilver result', async () => {
  const { document } = await setupQuotationHarness();
  document.getElementById('quote-est-unit').value = '12345678';

  document.getElementById('quote-est-unit').trigger('input');

  assert.equal(document.getElementById('quote-est-unit').value, '12345678');
  assert.equal(document.getElementById('quote-est-total').value, formatSilver(12345678 * 3));
});

test('quotation programmatic estimate total to unit uses formatSilver result', async () => {
  const { document } = await setupQuotationHarness();
  document.getElementById('quote-est-total').value = '12345678';

  document.getElementById('quote-est-total').trigger('input');

  assert.equal(document.getElementById('quote-est-total').value, '12345678');
  assert.equal(document.getElementById('quote-est-unit').value, formatSilver(12345678 / 3));
});

test('quotation programmatic custom unit to total uses formatSilver result', async () => {
  const { document } = await setupQuotationHarness();
  document.getElementById('quote-custom-unit').value = '12345678';

  document.getElementById('quote-custom-unit').trigger('input');

  assert.equal(document.getElementById('quote-custom-unit').value, '12345678');
  assert.equal(document.getElementById('quote-custom-total').value, formatSilver(12345678 * 3));
});

test('quotation programmatic custom total to unit uses formatSilver result', async () => {
  const { document } = await setupQuotationHarness();
  document.getElementById('quote-custom-total').value = '12345678';

  document.getElementById('quote-custom-total').trigger('input');

  assert.equal(document.getElementById('quote-custom-total').value, '12345678');
  assert.equal(document.getElementById('quote-custom-unit').value, formatSilver(12345678 / 3));
});

test('quotation quick quote setQuoteTotal formats both unit and total inputs', async () => {
  const { document } = await setupReadyQuotationHarness();
  const button = document.getElementById('quote-quick-90');
  button.setAttribute('data-quote-action', 'quick');
  button.setAttribute('data-value', '12345678');

  document.trigger('click', button);

  assert.equal(document.getElementById('quote-custom-total').value, formatSilver(12345678));
  assert.equal(document.getElementById('quote-custom-unit').value, formatSilver(12345678 / 3));
});

test('quotation input sync preserves the actively edited source field', async () => {
  const { document } = await setupQuotationHarness();
  document.getElementById('quote-est-unit').value = '12345678';
  document.getElementById('quote-custom-total').value = '12345678';

  document.getElementById('quote-est-unit').trigger('input');
  document.getElementById('quote-custom-total').trigger('input');

  assert.equal(document.getElementById('quote-est-unit').value, '12345678');
  assert.equal(document.getElementById('quote-custom-total').value, '12345678');
  assert.equal(document.getElementById('quote-est-total').value, formatSilver(12345678 * 3));
  assert.equal(document.getElementById('quote-custom-unit').value, formatSilver(12345678 / 3));
});

test('quotation enqueue success immediately renders queue and shopping list once without duplicate enqueue', async () => {
  const { document, craftingQueue } = await setupReadyQuotationHarness();
  const enqueueButton = new FakeElement('quote-add-to-queue');
  enqueueButton.setAttribute('data-quote-action', 'enqueue');
  const queueBody = document.getElementById('crafting-queue-tbody');
  const shoppingList = document.getElementById('shopping-list-content');
  const queueTotal = document.getElementById('queue-total-cost');
  const nav = document.getElementById('nav-tab-crafting');
  let navClicks = 0;
  nav.addEventListener('click', () => { navClicks++; });
  queueBody.innerHTMLSetCount = 0;
  shoppingList.innerHTMLSetCount = 0;
  queueTotal.innerHTMLSetCount = 0;

  document.trigger('click', enqueueButton);

  assert.equal(craftingQueue.length, 1);
  assert.equal(queueBody.innerHTMLSetCount, 1);
  assert.equal(queueBody.children.length, 1);
  assert.equal(shoppingList.innerHTMLSetCount, 1);
  assert.equal(queueTotal.innerHTMLSetCount, 1);
  assert.equal(navClicks, 1);
});

test('quotation enqueue failure does not render queue shopping list or switch tabs', async () => {
  const { document, craftingQueue } = await setupReadyQuotationHarness();
  document.getElementById('quote-recipe').value = '';
  const enqueueButton = new FakeElement('quote-add-to-queue');
  enqueueButton.setAttribute('data-quote-action', 'enqueue');
  const queueBody = document.getElementById('crafting-queue-tbody');
  const shoppingList = document.getElementById('shopping-list-content');
  const queueTotal = document.getElementById('queue-total-cost');
  const nav = document.getElementById('nav-tab-crafting');
  let navClicks = 0;
  nav.addEventListener('click', () => { navClicks++; });
  queueBody.innerHTMLSetCount = 0;
  shoppingList.innerHTMLSetCount = 0;
  queueTotal.innerHTMLSetCount = 0;

  document.trigger('click', enqueueButton);

  assert.equal(craftingQueue.length, 0);
  assert.equal(queueBody.innerHTMLSetCount, 0);
  assert.equal(shoppingList.innerHTMLSetCount, 0);
  assert.equal(queueTotal.innerHTMLSetCount, 0);
  assert.equal(navClicks, 0);
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
