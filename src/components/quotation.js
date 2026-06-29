import { ALBION_DB } from '../data/albion_db.js';
import { BONUSES, SYSTEM_CITIES } from '../data/constants.js';
import { escapeHTML, formatSilver, parseNum } from '../utils/formatters.js';
import {
  calculateQuotation,
  getAlchemyRequirement
} from '../calculators/quotationCalculator.js';

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

function allRecipes() {
  let recipes = [];
  for (const category of Object.values(ALBION_DB)) {
    for (const branch of Object.values(category)) {
      if (branch?.items) recipes = recipes.concat(branch.items);
    }
  }
  return recipes;
}

const RECIPES = allRecipes();

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

function numberFrom(id) {
  return parseNum(byId(id)?.value || '0');
}

function selectedRecipe() {
  const selectedName = byId('quote-recipe')?.value;
  return RECIPES.find(recipe => recipe.name === selectedName) || RECIPES[0];
}

function selectedQuantity() {
  const quantity = numberFrom('quote-qty');
  return quantity > 0 ? quantity : 1;
}

function setDiscount(key, discount) {
  quoteDraft.discounts[key] = discount;
  renderQuotation();
}

function setQuoteTotal(total) {
  quoteDraft.quoteTotal = total;
  quoteDraft.editingQuote = 'total';
  const totalInput = byId('quote-custom-total');
  const unitInput = byId('quote-custom-unit');
  const quantity = selectedQuantity();
  if (totalInput) totalInput.value = Math.round(total).toString();
  if (unitInput) unitInput.value = quantity > 0 ? Math.round(total / quantity).toString() : '0';
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
  if (!quoteDraft.quality) {
    const hint = document.createElement('div');
    hint.innerText = '請選擇品質';
    hint.className = 'quote-hint';
    container.appendChild(hint);
  }
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
        renderQuotation();
      });
      rowEl.appendChild(button);
    });
    matrix.appendChild(rowEl);
  });
  container.appendChild(matrix);
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
  const quality = quoteDraft.quality || '4.0';
  const rows = [
    { key: `${recipe.main}_${quality}`, label: recipe.main, baseQty: recipe.mainBaseQty },
    { key: `${recipe.sub}_${quality}`, label: recipe.sub, baseQty: recipe.subBaseQty }
  ].filter(row => row.label && row.baseQty > 0);

  if (recipe.artifactName) rows.push({ key: 'artifact', label: recipe.artifactName, baseQty: recipe.artifactQty || 1, special: true });
  if (recipe.alchemyName) {
    const req = getAlchemyRequirement((quoteDraft.quality || '4.0').split('.')[0]);
    rows.push({ key: 'alchemy', label: `${req.tier} ${recipe.alchemyName}`, baseQty: req.qty, special: true });
  }

  const html = rows.map(row => {
    const inputId = getPriceKey(row.key);
    return `<div class="quote-material-row">
      <div>
        <strong>${escapeHTML(row.label)}</strong>
        <div class="quote-muted">${row.special ? `固定需求: ${row.baseQty}` : `Base: ${row.baseQty}`}</div>
      </div>
      <input type="text" class="format-num quote-price-input" id="${escapeHTML(inputId)}" data-quote-action="price" value="${escapeHTML(byId(inputId)?.value || '0')}">
      <div class="quote-discounts">${renderDiscountButtons(row.key)}</div>
      <div class="quote-muted" id="quote-line-${escapeHTML(row.key)}">-</div>
    </div>`;
  }).join('');

  setHTML('quote-material-inputs', html);
}

function renderResult(quoteResult) {
  if (!quoteResult.ok) {
    setHTML('quote-result-box', `<div class="suggestion-box">請完成有效輸入：${quoteResult.errors.join(', ')}</div>`);
    return;
  }

  const quote = quoteResult.quote;
  [...quote.materials, ...quote.specialMaterials].forEach(line => {
    setText(`quote-line-${line.key}`, `套用單價 ${formatSilver(line.appliedUnitPrice)} / 預估成本 ${formatSilver(line.estimatedCost)}`);
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

  setHTML('quote-result-box', `<div class="quote-summary-grid">
    <div><span>預估總成本</span><strong>${formatSilver(quote.totalCost)}</strong></div>
    <div><span>預估單件成本</span><strong>${formatSilver(quote.unitCost)}</strong></div>
    <div><span>自訂報價毛利</span><strong>${formatSilver(quote.customQuote.profit)}</strong></div>
    <div><span>毛利率</span><strong>${formatPercent(quote.customQuote.marginRate)}</strong></div>
  </div>`);
}

function syncEstimateInputs(source) {
  const quantity = selectedQuantity();
  const unit = byId('quote-est-unit');
  const total = byId('quote-est-total');
  if (!unit || !total || quantity <= 0) return;

  if (source === 'unit') total.value = Math.round(parseNum(unit.value) * quantity).toString();
  if (source === 'total') unit.value = Math.round(parseNum(total.value) / quantity).toString();
}

function syncQuoteInputs(source) {
  const quantity = selectedQuantity();
  const unit = byId('quote-custom-unit');
  const total = byId('quote-custom-total');
  if (!unit || !total || quantity <= 0) return;

  if (source === 'unit') {
    total.value = Math.round(parseNum(unit.value) * quantity).toString();
    quoteDraft.quoteTotal = parseNum(total.value);
  }
  if (source === 'total') {
    unit.value = Math.round(parseNum(total.value) / quantity).toString();
    quoteDraft.quoteTotal = parseNum(total.value);
  }
  quoteDraft.editingQuote = source;
}

export function renderQuotation() {
  const recipe = selectedRecipe();
  if (!recipe) return;

  renderQualityMatrix();
  setText('quote-main-label', recipe.main || '-');
  setText('quote-sub-label', recipe.subBaseQty > 0 ? recipe.sub : '無');
  const hideoutGroup = byId('quote-hideout-group');
  if (hideoutGroup) hideoutGroup.style.display = byId('quote-city')?.value === 'Hideout' ? 'flex' : 'none';
  renderMaterialRows(recipe);

  if (!quoteDraft.quality) {
    setHTML('quote-result-box', '<div class="suggestion-box">請先選擇品質。</div>');
    return;
  }

  renderResult(calculateQuotation(buildInputs(recipe)));
  updateQuickQuoteButtons();
}

export function initQuotationEvents() {
  const recipeSelect = byId('quote-recipe');
  if (recipeSelect) {
    recipeSelect.innerHTML = RECIPES.map(recipe => `<option value="${escapeHTML(recipe.name)}">${escapeHTML(recipe.name)}</option>`).join('');
    recipeSelect.value = RECIPES[0]?.name || '';
  }

  const citySelect = byId('quote-city');
  if (citySelect) {
    citySelect.innerHTML = Object.entries(SYSTEM_CITIES)
      .filter(([id]) => id !== 'LaborerIsland')
      .map(([id, city]) => `<option value="${escapeHTML(id)}">${escapeHTML(city.name || id)}</option>`)
      .join('');
  }

  byId('quote-recipe')?.addEventListener('change', () => {
    const recipe = selectedRecipe();
    const bonusCity = BONUSES[recipe?.category];
    if (bonusCity && byId('quote-city')) byId('quote-city').value = bonusCity;
    renderQuotation();
  });
  ['quote-qty', 'quote-city', 'quote-focus', 'quote-hideout-map-bonus', 'quote-hideout-focus-rrr', 'quote-shop-fee'].forEach(id => {
    byId(id)?.addEventListener('input', renderQuotation);
    byId(id)?.addEventListener('change', renderQuotation);
  });
  byId('quote-est-unit')?.addEventListener('input', () => { syncEstimateInputs('unit'); renderQuotation(); });
  byId('quote-est-total')?.addEventListener('input', () => { syncEstimateInputs('total'); renderQuotation(); });
  byId('quote-custom-unit')?.addEventListener('input', () => { syncQuoteInputs('unit'); renderQuotation(); });
  byId('quote-custom-total')?.addEventListener('input', () => { syncQuoteInputs('total'); renderQuotation(); });
  document.addEventListener('input', event => {
    if (event.target?.getAttribute?.('data-quote-action') === 'price') renderQuotation();
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
  });

  renderQuotation();
}

export function updateQuickQuoteButtons() {
  const result = calculateQuotation(buildInputs(selectedRecipe()));
  if (!result.ok) return;
  const refs = result.quote.references;
  [
    ['quote-quick-90', refs.estimate90],
    ['quote-quick-85', refs.estimate85],
    ['quote-quick-margin-8', refs.margin8],
    ['quote-quick-margin-10', refs.margin10]
  ].forEach(([id, value]) => {
    const button = byId(id);
    if (button) button.setAttribute('data-value', value);
  });
}
