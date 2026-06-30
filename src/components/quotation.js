import { BONUSES } from '../data/constants.js';
import { escapeHTML, formatSilver, parseNum } from '../utils/formatters.js';
import {
  calculateQuotation,
  getAlchemyRequirement
} from '../calculators/quotationCalculator.js';
import { resolveGeneralMaterialDisplayName } from '../presenters/materialDisplay.js';
import {
  RECIPES,
  enqueueCraftingPlan,
  getRecipeDisplayName,
  openItemSelector,
  renderCraftingQueue,
  updateShoppingListTotal
} from './crafting.js';

const QUOTE_QUALITY_ROWS = [
  ['4.0', '4.1', '4.2', '4.3', '4.4'],
  ['5.0', '5.1', '5.2', '5.3', '5.4'],
  ['6.0', '6.1', '6.2', '6.3', '6.4'],
  ['7.0', '7.1', '7.2', '7.3', '7.4'],
  ['8.0', '8.1', '8.2', '8.3', '8.4']
];
const DISCOUNTS = [0, 5, 6, 7];
const quoteDraft = {
  quality: '',
  discounts: {},
  quoteTotal: null,
  editingQuote: null
};

function byId(id) {
  return document.getElementById(id);
}

function setText(id, text) {
  const element = byId(id);
  if (element) element.innerText = text;
}

function setHTML(id, html) {
  const element = byId(id);
  if (element) element.innerHTML = html;
}

function setToneClass(id, value) {
  const element = byId(id);
  if (!element) return;
  element.classList.remove('quote-tone-positive', 'quote-tone-negative');
  if (value > 0) element.classList.add('quote-tone-positive');
  if (value < 0) element.classList.add('quote-tone-negative');
}

function numberFrom(id) {
  return parseNum(byId(id)?.value || '0');
}

function setCalculatedNumericValue(input, value) {
  if (!input) return;
  input.value = formatSilver(Math.round(value));
}

function selectedRecipe() {
  const selectedName = byId('quote-recipe')?.value;
  return RECIPES.find(recipe => recipe.name === selectedName) || null;
}

function selectedQuantity() {
  const quantity = numberFrom('quote-qty');
  return quantity > 0 ? quantity : 1;
}

function selectedPlanInput() {
  const city = byId('quote-city')?.value || 'Thetford';
  return {
    recipeName: selectedRecipe()?.name,
    quality: quoteDraft.quality,
    quantity: selectedQuantity(),
    city,
    focus: Boolean(byId('quote-focus')?.checked),
    customLocationSettings: city === 'Hideout'
      ? {
          active: true,
          mapBonus: numberFrom('quote-hideout-map-bonus'),
          focusReturnRate: numberFrom('quote-hideout-focus-rrr') / 100
        }
      : null
  };
}

function setDiscount(key, discount) {
  quoteDraft.discounts[key] = discount;
  document.querySelectorAll?.('[data-quote-action="discount"]').forEach(button => {
    if (button.getAttribute('data-key') === key) {
      button.classList.toggle('active', Number(button.getAttribute('data-discount')) === discount);
    }
  });
  refreshQuotationCalculation();
}

function setQuoteTotal(total) {
  quoteDraft.quoteTotal = total;
  quoteDraft.editingQuote = 'total';
  const totalInput = byId('quote-custom-total');
  const unitInput = byId('quote-custom-unit');
  const quantity = selectedQuantity();
  setCalculatedNumericValue(totalInput, total);
  setCalculatedNumericValue(unitInput, quantity > 0 ? total / quantity : 0);
  renderQuotation();
}

function formatPercent(value) {
  if (value === null || value === undefined || Number.isNaN(value)) return '-';
  return `${(value * 100).toFixed(1)}%`;
}

function getPriceKey(lineKey) {
  return `quote-price-${lineKey}`;
}

function materialPrice(lineKey) {
  return numberFrom(getPriceKey(lineKey));
}

function setQuickQuoteValue(buttonId, value) {
  const button = byId(buttonId);
  if (button) {
    if (value === null || value === undefined) button.removeAttribute('data-value');
    else button.setAttribute('data-value', value);
  }
}

function resetQuoteOutputs() {
  setText('quote-rra-badge', 'RRR: --');
  setText('quote-consumption-main', '0');
  setText('quote-consumption-sub', '0');
  setText('quote-total-cost', '0');
  setText('quote-unit-cost', '0');
  setText('quote-shop-fee-result', '0');
  setText('quote-est-total-display', '0');
  setText('quote-ref-90', '0');
  setText('quote-ref-85', '0');
  setText('quote-ref-margin-8', '0');
  setText('quote-ref-margin-10', '0');
  setText('quote-profit', '0');
  setText('quote-margin', '-');
  setToneClass('quote-profit', 0);
  setToneClass('quote-margin', null);
  setQuickQuoteValue('quote-quick-90', null);
  setQuickQuoteValue('quote-quick-85', null);
  setQuickQuoteValue('quote-quick-margin-8', null);
  setQuickQuoteValue('quote-quick-margin-10', null);
}

function renderDiscountButtons(key) {
  return DISCOUNTS.map(discount => {
    const active = (quoteDraft.discounts[key] ?? 0) === discount ? 'active' : '';
    return `<button class="pill-btn quote-discount ${active}" data-quote-action="discount" data-key="${escapeHTML(key)}" data-discount="${discount}">-${discount}%</button>`;
  }).join('');
}

function renderQualityMatrix() {
  const container = byId('quote-quality-pill-group');
  if (!container) return;
  container.innerHTML = '';
  const hint = byId('quote-tier-hint');
  if (hint) hint.style.display = quoteDraft.quality ? 'none' : '';
  const matrix = document.createElement('div');
  matrix.className = 'quality-matrix';
  QUOTE_QUALITY_ROWS.forEach(row => {
    const rowEl = document.createElement('div');
    rowEl.className = 'quality-matrix-row';
    row.forEach(quality => {
      const button = document.createElement('button');
      button.className = `pill-btn ${quality === quoteDraft.quality ? 'active' : ''}`;
      button.textContent = quality;
      button.addEventListener('click', () => {
        quoteDraft.quality = quality;
        quoteDraft.discounts = {};
        renderQuotation();
      });
      rowEl.appendChild(button);
    });
    matrix.appendChild(rowEl);
  });
  container.appendChild(matrix);
}

function applyRecipeSelection(recipe) {
  if (!recipe) return;
  const input = byId('quote-recipe');
  const display = byId('quote-recipe-display');
  if (input) input.value = recipe.name;
  if (display) display.innerText = getRecipeDisplayName(recipe);
  const bonusCity = BONUSES[recipe.category];
  if (bonusCity && byId('quote-city')) byId('quote-city').value = bonusCity;
  quoteDraft.discounts = {};
  renderQuotation();
}

function buildInputs(recipe) {
  const quality = quoteDraft.quality || '4.0';
  const quantity = selectedQuantity();
  const mainKey = `${recipe.main}_${quality}`;
  const subKey = `${recipe.sub}_${quality}`;
  const prices = {};
  const discounts = { ...quoteDraft.discounts };

  prices[mainKey] = materialPrice(mainKey);
  if (recipe.subBaseQty > 0) prices[subKey] = materialPrice(subKey);
  if (recipe.artifactName) prices.artifact = materialPrice('artifact');
  if (recipe.alchemyName) prices.alchemy = materialPrice('alchemy');

  const estimateTotal = numberFrom('quote-est-total') || numberFrom('quote-est-unit') * quantity;
  const customTotal = quoteDraft.quoteTotal ?? numberFrom('quote-custom-total');

  return {
    recipe,
    quality,
    quantity,
    city: byId('quote-city')?.value || 'Thetford',
    focus: Boolean(byId('quote-focus')?.checked),
    customLocationSettings: byId('quote-city')?.value === 'Hideout'
      ? {
          active: true,
          mapBonus: numberFrom('quote-hideout-map-bonus'),
          focusReturnRate: numberFrom('quote-hideout-focus-rrr') / 100
        }
      : null,
    prices,
    discounts,
    shopFeeRate: numberFrom('quote-shop-fee'),
    estimatedSaleTotal: estimateTotal,
    customQuoteTotal: customTotal
  };
}

function renderMaterialRows(recipe) {
  if (!recipe) {
    setHTML('quote-material-inputs', '');
    return;
  }

  const quality = quoteDraft.quality || '4.0';
  const materialRows = [
    { key: `${recipe.main}_${quality}`, label: resolveGeneralMaterialDisplayName(recipe.main), baseQty: recipe.mainBaseQty },
    { key: `${recipe.sub}_${quality}`, label: resolveGeneralMaterialDisplayName(recipe.sub), baseQty: recipe.subBaseQty }
  ].filter(row => row.label && row.baseQty > 0);
  const specialRows = [];

  if (recipe.artifactName) specialRows.push({ key: 'artifact', label: recipe.artifactName, baseQty: recipe.artifactQty || 1, special: true });
  if (recipe.alchemyName) {
    const req = getAlchemyRequirement((quoteDraft.quality || '4.0').split('.')[0]);
    specialRows.push({ key: 'alchemy', label: `${req.tier} ${recipe.alchemyName}`, baseQty: req.qty, special: true });
  }

  const renderMaterialEstimateRows = rows => rows.map(row => {
    const inputId = getPriceKey(row.key);
    return `<div class="quote-material-row">
      <div>
        <strong>${escapeHTML(row.label)}</strong>
        <div class="quote-muted">Base: ${row.baseQty}</div>
      </div>
      <input type="text" class="format-num quote-price-input" id="${escapeHTML(inputId)}" data-quote-action="price" value="${escapeHTML(byId(inputId)?.value || '0')}" autocomplete="off" inputmode="decimal">
      <div class="quote-discounts">${renderDiscountButtons(row.key)}</div>
      <div class="quote-muted" id="quote-line-${escapeHTML(row.key)}">-</div>
    </div>`;
  }).join('');
  const renderSpecialEstimateRows = rows => rows.map(row => {
    const inputId = getPriceKey(row.key);
    return `<div class="quote-material-row quote-special-row" data-special-key="${escapeHTML(row.key)}">
      <div>
        <strong>${escapeHTML(row.label)}</strong>
        <div class="quote-muted">Fixed requirement: ${row.baseQty}</div>
      </div>
      <input type="text" class="format-num quote-price-input" id="${escapeHTML(inputId)}" data-quote-action="price" value="${escapeHTML(byId(inputId)?.value || '0')}" autocomplete="off" inputmode="decimal">
      <div class="quote-muted" id="quote-line-${escapeHTML(row.key)}">預估成本 / Estimated Cost -</div>
    </div>`;
  }).join('');
  const specialHtml = specialRows.length > 0
    ? `<label class="form-label">特殊材料<br><span style="font-size: 0.8em; opacity: 0.7;">Special Materials</span></label>${renderSpecialEstimateRows(specialRows)}`
    : '';

  setHTML('quote-material-inputs', `${renderMaterialEstimateRows(materialRows)}${specialHtml}`);
}

function renderResult(quoteResult) {
  if (!quoteResult.ok) {
    setHTML('quote-result-box', `<div class="suggestion-box">請完成有效輸入：${quoteResult.errors.join(', ')}</div>`);
    return;
  }

  const quote = quoteResult.quote;
  setText('quote-rra-badge', `RRR: ${(quote.returnRate * 100).toFixed(1)}%`);
  quote.materials.forEach(line => {
    setText(`quote-line-${line.key}`, `套用單價 ${formatSilver(line.appliedUnitPrice)} / 預估成本 ${formatSilver(line.estimatedCost)}`);
  });
  quote.specialMaterials.forEach(line => {
    setText(`quote-line-${line.key}`, `預估成本 / Estimated Cost ${formatSilver(line.estimatedCost)}`);
  });
  setText('quote-consumption-main', `${quote.materials[0]?.quantity ?? 0}`);
  setText('quote-consumption-sub', `${quote.materials[1]?.quantity ?? 0}`);
  setText('quote-total-cost', formatSilver(quote.totalCost));
  setText('quote-unit-cost', formatSilver(quote.unitCost));
  setText('quote-shop-fee-result', formatSilver(quote.shopFee));
  setText('quote-est-total-display', formatSilver(quote.estimatedSaleTotal));
  setText('quote-ref-90', formatSilver(quote.references.estimate90));
  setText('quote-ref-85', formatSilver(quote.references.estimate85));
  setText('quote-ref-margin-8', formatSilver(quote.references.margin8));
  setText('quote-ref-margin-10', formatSilver(quote.references.margin10));
  setText('quote-profit', formatSilver(quote.customQuote.profit));
  setText('quote-margin', formatPercent(quote.customQuote.marginRate));
  setToneClass('quote-profit', quote.customQuote.profit);
  setToneClass('quote-margin', quote.customQuote.marginRate);

  setHTML('quote-result-box', '<button class="btn btn-primary" id="quote-add-to-queue" data-quote-action="enqueue">加入製作清單<br><span style="font-size:0.8em;opacity:0.7;">Add to Queue</span></button>');
}

function enqueueCurrentPlan() {
  const result = enqueueCraftingPlan(selectedPlanInput());
  if (!result.ok) {
    window.showToast?.(result.errors.join(', '), 'error');
    return;
  }

  renderCraftingQueue();
  updateShoppingListTotal();
  window.showToast?.('已加入製作清單', 'success');
  document.getElementById('nav-tab-crafting')?.click?.();
}

function refreshQuotationCalculation() {
  const recipe = selectedRecipe();
  if (!recipe || !quoteDraft.quality) return;
  renderResult(calculateQuotation(buildInputs(recipe)));
  updateQuickQuoteButtons();
}
function syncEstimateInputs(source) {
  const quantity = selectedQuantity();
  const unit = byId('quote-est-unit');
  const total = byId('quote-est-total');
  if (!unit || !total || quantity <= 0) return;

  if (source === 'unit') setCalculatedNumericValue(total, parseNum(unit.value) * quantity);
  if (source === 'total') setCalculatedNumericValue(unit, parseNum(total.value) / quantity);
}

function syncQuoteInputs(source) {
  const quantity = selectedQuantity();
  const unit = byId('quote-custom-unit');
  const total = byId('quote-custom-total');
  if (!unit || !total || quantity <= 0) return;

  if (source === 'unit') {
    const totalValue = parseNum(unit.value) * quantity;
    setCalculatedNumericValue(total, totalValue);
    quoteDraft.quoteTotal = Math.round(totalValue);
  }
  if (source === 'total') {
    setCalculatedNumericValue(unit, parseNum(total.value) / quantity);
    quoteDraft.quoteTotal = parseNum(total.value);
  }
  quoteDraft.editingQuote = source;
}

export function renderQuotation() {
  const recipe = selectedRecipe();

  renderQualityMatrix();
  setText('quote-main-label', recipe ? resolveGeneralMaterialDisplayName(recipe.main) : '-');
  setText('quote-sub-label', recipe?.subBaseQty > 0 ? resolveGeneralMaterialDisplayName(recipe.sub) : '-');
  const hideoutGroup = byId('quote-hideout-group');
  if (hideoutGroup) hideoutGroup.style.display = byId('quote-city')?.value === 'Hideout' ? 'flex' : 'none';
  renderMaterialRows(recipe);

  if (!recipe) {
    resetQuoteOutputs();
    setHTML('quote-result-box', '<div class="suggestion-box">🔍 Choose Target before calculating.</div>');
    return;
  }

  if (!quoteDraft.quality) {
    resetQuoteOutputs();
    setHTML('quote-result-box', '<div class="suggestion-box">Choose Target Tier before calculating.</div>');
    return;
  }

  renderResult(calculateQuotation(buildInputs(recipe)));
  updateQuickQuoteButtons();
}

export function initQuotationEvents() {
  byId('btn-open-quote-item-selector')?.addEventListener('click', () => {
    openItemSelector('quotation', item => applyRecipeSelection(item));
  });
  ['quote-qty', 'quote-city', 'quote-focus', 'quote-hideout-map-bonus', 'quote-hideout-focus-rrr'].forEach(id => {
    byId(id)?.addEventListener('input', renderQuotation);
    byId(id)?.addEventListener('change', renderQuotation);
  });
  byId('quote-shop-fee')?.addEventListener('input', refreshQuotationCalculation);
  byId('quote-shop-fee')?.addEventListener('change', refreshQuotationCalculation);
  byId('quote-est-unit')?.addEventListener('input', () => { syncEstimateInputs('unit'); refreshQuotationCalculation(); });
  byId('quote-est-total')?.addEventListener('input', () => { syncEstimateInputs('total'); refreshQuotationCalculation(); });
  byId('quote-custom-unit')?.addEventListener('input', () => { syncQuoteInputs('unit'); refreshQuotationCalculation(); });
  byId('quote-custom-total')?.addEventListener('input', () => { syncQuoteInputs('total'); refreshQuotationCalculation(); });
  [
    ['btn-quote-qty-sub-10', -10],
    ['btn-quote-qty-sub-1', -1],
    ['btn-quote-qty-add-1', 1],
    ['btn-quote-qty-add-10', 10]
  ].forEach(([id, delta]) => {
    byId(id)?.addEventListener('click', () => {
      const qty = byId('quote-qty');
      if (!qty) return;
      qty.value = String(Math.max(1, (parseInt(qty.value, 10) || 1) + delta));
      syncEstimateInputs('unit');
      if (quoteDraft.editingQuote) syncQuoteInputs(quoteDraft.editingQuote);
      renderQuotation();
    });
  });
  document.addEventListener('input', event => {
    if (event.target?.getAttribute?.('data-quote-action') === 'price') refreshQuotationCalculation();
  });
  document.addEventListener('click', event => {
    const target = event.target?.closest?.('[data-quote-action]') || event.target;
    const action = target?.getAttribute?.('data-quote-action');
    if (action === 'discount') {
      setDiscount(target.getAttribute('data-key'), parseInt(target.getAttribute('data-discount'), 10));
    }
    if (action === 'quick') {
      const value = Number(target.getAttribute('data-value'));
      if (Number.isFinite(value)) setQuoteTotal(value);
    }
    if (action === 'enqueue') {
      enqueueCurrentPlan();
    }
  });

  renderQuotation();
}

export function updateQuickQuoteButtons() {
  const recipe = selectedRecipe();
  if (!recipe || !quoteDraft.quality) return;
  const result = calculateQuotation(buildInputs(recipe));
  if (!result.ok) return;
  const refs = result.quote.references;
  setQuickQuoteValue('quote-quick-90', refs.estimate90);
  setQuickQuoteValue('quote-quick-85', refs.estimate85);
  setQuickQuoteValue('quote-quick-margin-8', refs.margin8);
  setQuickQuoteValue('quote-quick-margin-10', refs.margin10);
}
