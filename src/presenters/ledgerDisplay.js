import { ALBION_DB } from '../data/albion_db.js';

const CATEGORY_DISPLAY = new Map([
  ['買材料', 'Material Purchase'],
  ['製作入庫', 'Crafting Output'],
  ['賣成品', 'Product Sale'],
  ['庫存校正', 'Inventory Adjustment'],
  ['INVENTORY_ADJUSTMENT', 'Inventory Adjustment'],
  ['成本校正', 'Cost Adjustment'],
  ['庫存刪除', 'Inventory Removal'],
  ['現金流校正', 'Cash Balance Adjustment'],
  ['注資本金', 'Capital Injection'],
  ['提領利潤', 'Profit Withdrawal'],
  ['工人島出售', 'Laborer Output Sale']
]);

const MATERIAL_DISPLAY = new Map([
  ['鋼條', 'Bars'],
  ['板材', 'Planks'],
  ['布料', 'Cloth'],
  ['皮革', 'Leather']
]);

const LABORER_DISPLAY = new Map([
  ['滿日記本', 'Full Journal'],
  ['滿日誌', 'Full Journal']
]);

const recipeLookup = new Map();
const specialItemLookup = new Map();

function addLookup(key, value) {
  if (typeof key === 'string' && key.trim()) recipeLookup.set(key, value);
}

function addSpecialLookup(key) {
  if (typeof key === 'string' && key.trim()) specialItemLookup.set(key, extractEnglishName(key));
}

for (const category of Object.values(ALBION_DB)) {
  for (const branch of Object.values(category)) {
    if (!branch?.items) continue;
    for (const recipe of branch.items) {
      addLookup(recipe.id, recipe.enName);
      addLookup(recipe.name, recipe.enName);
      addLookup(recipe.enName, recipe.enName);
      addSpecialLookup(recipe.artifactName);
      addSpecialLookup(recipe.alchemyName);
    }
  }
}

function isEnglishLike(value) {
  return /^[\x20-\x7E]+$/.test(value) && /[A-Za-z]/.test(value);
}

function hasCjk(value) {
  return /[\u3400-\u9FFF]/.test(value);
}

function extractEnglishName(value) {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (isEnglishLike(trimmed)) return trimmed;
  const match = trimmed.match(/[A-Za-z][A-Za-z0-9 '&().:-]*(?: [A-Za-z0-9 '&().:-]+)*/);
  return match ? match[0].trim() : null;
}

function getRawType(transactionOrType) {
  if (typeof transactionOrType === 'string') return transactionOrType;
  return transactionOrType?.type
    ?? transactionOrType?.displayType
    ?? transactionOrType?.action
    ?? transactionOrType?.raw?.type
    ?? transactionOrType?.raw?.action
    ?? '';
}

function getRawItem(transaction) {
  return transaction?.itemRef
    ?? transaction?.item
    ?? transaction?.target
    ?? transaction?.raw?.item
    ?? transaction?.raw?.target
    ?? '-';
}

export function resolveLedgerCategoryDisplay(type) {
  const rawType = getRawType(type);
  if (CATEGORY_DISPLAY.has(rawType)) return CATEGORY_DISPLAY.get(rawType);
  if (typeof rawType === 'string' && isEnglishLike(rawType)) return rawType;
  return 'Unknown Transaction';
}

export function resolveLedgerItemDisplay(transaction) {
  const rawItem = getRawItem(transaction);
  if (rawItem === '-') return '-';
  if (typeof rawItem !== 'string' || !rawItem.trim()) return 'Unknown Item';
  if (recipeLookup.has(rawItem)) return recipeLookup.get(rawItem);
  if (MATERIAL_DISPLAY.has(rawItem)) return MATERIAL_DISPLAY.get(rawItem);
  if (specialItemLookup.has(rawItem)) return specialItemLookup.get(rawItem);
  if (LABORER_DISPLAY.has(rawItem)) return LABORER_DISPLAY.get(rawItem);
  const englishName = extractEnglishName(rawItem);
  if (englishName) return englishName;
  if (!hasCjk(rawItem) && isEnglishLike(rawItem)) return rawItem;
  return 'Unknown Item';
}

export function getDistinctLedgerDisplayCategories(transactions) {
  return [...new Set((transactions || []).map(transaction => resolveLedgerCategoryDisplay(transaction)))];
}
