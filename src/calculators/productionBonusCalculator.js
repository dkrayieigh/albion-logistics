const REGION_CATEGORIES = {
  SWAMP: [
    'MACE',
    'NATURE_STAFF',
    'FIRE_STAFF',
    'LEATHER_ARMOR',
    'CLOTH_HELMET'
  ],
  FOREST: [
    'SWORD',
    'BOW',
    'ARCANE_STAFF',
    'LEATHER_HELMET',
    'LEATHER_SHOES'
  ],
  MOUNTAIN: [
    'HAMMER',
    'SPEAR',
    'HOLY_STAFF',
    'PLATE_HELMET',
    'CLOTH_ARMOR'
  ],
  HIGHLAND: [
    'AXE',
    'QUARTERSTAFF',
    'FROST_STAFF',
    'PLATE_SHOES',
    'OFF_HAND'
  ],
  STEPPE: [
    'CROSSBOW',
    'DAGGER',
    'CURSED_STAFF',
    'PLATE_ARMOR',
    'CLOTH_SHOES'
  ],
  CENTER: [
    'WAR_GLOVES',
    'SHAPESHIFTER_STAFF'
  ],
  MISTS: [
    'CAPE'
  ]
};

const HIDEOUT_GENERAL_LPB = [0, 6, 11, 15, 18, 20, 22, 24, 26];

const HIDEOUT_SPECIALIZED_MATRIX = [
  [1, 10.75, 19.5, 27.25, 34, 39.75, 45.5, 51.25, 57],
  [6, 15.75, 24.5, 32.25, 39, 44.75, 50.5, 56.25, 62],
  [11, 20.75, 29.5, 37.25, 44, 49.75, 55.5, 61.25, 67],
  [16, 25.75, 34.5, 42.25, 49, 54.75, 60.5, 66.25, 72],
  [21, 30.75, 39.5, 47.25, 54, 59.75, 65.5, 71.25, 77],
  [26, 35.75, 44.5, 52.25, 59, 64.75, 70.5, 76.25, 82]
];

const VALID_DAILY_BONUS_PERCENT = [0, 10, 20];
const VALID_FACILITY_TYPES = ['royal-city', 'hideout'];

function failure(errorCode) {
  return {
    ok: false,
    status: 'invalid-production-bonus',
    components: null,
    totalLpbPercent: null,
    rrr: null,
    errors: [errorCode]
  };
}

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim() !== '';
}

function isValidRegion(region) {
  return Object.prototype.hasOwnProperty.call(REGION_CATEGORIES, region);
}

function validateProfile(profile) {
  if (!isPlainObject(profile)) {
    return false;
  }

  if (!isNonEmptyString(profile.locationId)) {
    return false;
  }

  if (!VALID_FACILITY_TYPES.includes(profile.facilityType)) {
    return false;
  }

  if (!isValidRegion(profile.region)) {
    return false;
  }

  if (profile.facilityType === 'royal-city') {
    return profile.regionQuality === null;
  }

  return (
    Number.isInteger(profile.regionQuality) &&
    profile.regionQuality >= 1 &&
    profile.regionQuality <= 6
  );
}

function validateRecipeCategory(recipeCategory) {
  if (!isNonEmptyString(recipeCategory)) {
    return false;
  }

  return Object.values(REGION_CATEGORIES).some((categories) =>
    categories.includes(recipeCategory)
  );
}

function validateEventParameters(profile, eventParameters) {
  if (!isPlainObject(eventParameters)) {
    return false;
  }

  if (!isNonEmptyString(eventParameters.locationId)) {
    return false;
  }

  if (typeof eventParameters.focusEnabled !== 'boolean') {
    return false;
  }

  if (!VALID_DAILY_BONUS_PERCENT.includes(eventParameters.dailyBonusPercent)) {
    return false;
  }

  if (profile.facilityType === 'royal-city') {
    return eventParameters.hideoutPowerLevel === null;
  }

  return (
    Number.isInteger(eventParameters.hideoutPowerLevel) &&
    eventParameters.hideoutPowerLevel >= 1 &&
    eventParameters.hideoutPowerLevel <= 9
  );
}

function recipeMatchesRegion(region, recipeCategory) {
  return REGION_CATEGORIES[region].includes(recipeCategory);
}

export function calculateProductionBonus({
  profile,
  recipeCategory,
  eventParameters
}) {
  if (!validateProfile(profile)) {
    return failure('INVALID_PROFILE');
  }

  if (!validateRecipeCategory(recipeCategory)) {
    return failure('INVALID_RECIPE_CATEGORY');
  }

  if (!validateEventParameters(profile, eventParameters)) {
    return failure('INVALID_EVENT_PARAMETERS');
  }

  if (profile.locationId !== eventParameters.locationId) {
    return failure('LOCATION_MISMATCH');
  }

  const matchesRegion = recipeMatchesRegion(profile.region, recipeCategory);
  let locationBaseLpb;
  let specializationProfileLpb;

  if (profile.facilityType === 'royal-city') {
    locationBaseLpb = 18;
    specializationProfileLpb = matchesRegion ? 15 : 0;
  } else {
    locationBaseLpb = HIDEOUT_GENERAL_LPB[eventParameters.hideoutPowerLevel - 1];
    if (matchesRegion) {
      const matrixValue =
        HIDEOUT_SPECIALIZED_MATRIX[profile.regionQuality - 1][
          eventParameters.hideoutPowerLevel - 1
        ];
      specializationProfileLpb = matrixValue - locationBaseLpb;
    } else {
      specializationProfileLpb = 0;
    }
  }

  const focusLpb = eventParameters.focusEnabled ? 59 : 0;
  const dailyLpb = eventParameters.dailyBonusPercent;
  const totalLpbPercent =
    locationBaseLpb + specializationProfileLpb + focusLpb + dailyLpb;
  const rrr = 1 - 1 / (1 + totalLpbPercent / 100);

  return {
    ok: true,
    status: 'calculated',
    components: {
      locationBaseLpb,
      specializationProfileLpb,
      focusLpb,
      dailyLpb
    },
    totalLpbPercent,
    rrr,
    errors: []
  };
}
