export const TAX_RATE = 0.1125 / 100;
export const BASE_RRR = 0.152;
export const FOCUS_RRR_BONUS = 0.435;

export const SYSTEM_CITIES = { 
  'Thetford': { name: 'Thetford (紫城)' }, 
  'Martlock': { name: 'Martlock (藍城)' }, 
  'Bridgewatch': { name: 'Bridgewatch (沙城)' }, 
  'Lymhurst': { name: 'Lymhurst (綠城)' }, 
  'Fort Sterling': { name: 'Fort Sterling (白城)' }, 
  'Hideout': { name: '黑區地堡' }, 
  'LaborerIsland': { name: '工人島倉庫' } 
};

export const BONUSES = { 
  '錘矛': 'Thetford', '金屬長靴': 'Martlock', '副手武器': 'Martlock', 
  '金屬護甲': 'Bridgewatch', '鋼條': 'Thetford', '布料': 'Lymhurst', 
  '板材': 'Fort Sterling', '金屬頭盔': 'Fort Sterling', '鎚子': 'Fort Sterling' 
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