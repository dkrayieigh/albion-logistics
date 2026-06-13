export const TAX_RATE = 0.1125 / 100;
export const BASE_RRR = 0.152;
export const FOCUS_RRR_BONUS = 0.435;

export const SYSTEM_CITIES = { 
  'Thetford': { name: 'Thetford (紫城)' }, 
  'Martlock': { name: 'Martlock (藍城)' }, 
  'Bridgewatch': { name: 'Bridgewatch (黃城)' }, 
  'Lymhurst': { name: 'Lymhurst (綠城)' }, 
  'Fort Sterling': { name: 'Fort Sterling (白城)' }, 
  'Hideout': { name: '黑區地堡' }, 
  'LaborerIsland': { name: '工人島倉庫' },
  'Caerleon': { name: 'Caerleon (紅城)' },
  'Brecilien': { name: 'Brecilien (迷霧城)' },
};

// 皇家城市與其對應的加成項目 (完全對照官方圖表)
export const CITY_BONUSES = {
  'Martlock': {
    refine: ['Leather'], // 雖然圖上寫 Hide (獸皮)，但在成品端我們通常記為 Leather (皮革)
    weapons: ['Axe', 'Quarterstaff', 'Frost Staff'],
    armor: ['Plate Shoes'],
    other: ['Off-Hand']
  },
  'Bridgewatch': {
    refine: ['Stone'],
    weapons: ['Crossbow', 'Dagger', 'Cursed Staff'],
    armor: ['Plate Armor', 'Cloth Shoes'],
    other: []
  },
  'Lymhurst': {
    refine: ['Cloth'], // 圖上寫 Fiber (纖維)，對應精煉產物 Cloth (布料)
    weapons: ['Sword', 'Bow', 'Arcane Staff'],
    armor: ['Leather Helmet', 'Leather Shoes'],
    other: []
  },
  'Fort Sterling': {
    refine: ['Planks'], // 圖上寫 Wood (木材)，對應精煉產物 Planks (板材)
    weapons: ['Hammer', 'Spear', 'Holy Staff'],
    armor: ['Plate Helmet', 'Cloth Armor'],
    other: []
  },
  'Thetford': {
    refine: ['Bars'], // 圖上寫 Ore (礦石)，對應精煉產物 Bars (鋼條)
    weapons: ['Mace', 'Nature Staff', 'Fire Staff'],
    armor: ['Leather Armor', 'Cloth Helmet'],
    other: []
  },
  'Caerleon': {
    refine: [], 
    weapons: ['War Gloves', 'Shapeshifter Staff'], // 精準對應 albion_db.js 的 category
    armor: [],
    other: []
  },
  'Brecilien': {
    refine: [],
    weapons: [],
    armor: [],
    other: ['披風'] // 為未來的披風類別預留 Bridge Protocol
  }
};

export const EN_MAT = {
  '鋼條': 'Bars', '板材': 'Planks', '布料': 'Cloth', '皮革': 'Leather'
};

export const QUAL_GROUPS = [
  { label: 'T7', items: ['4.3', '5.2', '6.1', '7.0'] },
  { label: 'T8', items: ['4.4', '5.3', '6.2', '7.1', '8.0'] },
  { label: 'T9', items: ['5.4', '6.3', '7.2', '8.1'] },
  { label: 'Other', items: ['6.4', '7.3', '8.2', '7.4', '8.3', '8.4'] }
];