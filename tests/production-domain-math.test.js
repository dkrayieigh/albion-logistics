import test from 'node:test';
import assert from 'node:assert/strict';

import * as productionBonusCalculator from '../src/calculators/productionBonusCalculator.js';
import {
  calculateProductionBonus
} from '../src/calculators/productionBonusCalculator.js';

import * as regionalMaterialConsumptionCalculator from '../src/calculators/regionalMaterialConsumptionCalculator.js';
import {
  calculateRegionalMaterialConsumption
} from '../src/calculators/regionalMaterialConsumptionCalculator.js';

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

const ROYAL_PROFILE = {
  locationId: 'thetford',
  facilityType: 'royal-city',
  region: 'SWAMP',
  regionQuality: null
};

const ROYAL_EVENT = {
  locationId: 'thetford',
  hideoutPowerLevel: null,
  focusEnabled: false,
  dailyBonusPercent: 0
};

const HIDEOUT_PROFILE = {
  locationId: 'custom:hideout-001',
  facilityType: 'hideout',
  region: 'SWAMP',
  regionQuality: 1
};

const HIDEOUT_EVENT = {
  locationId: 'custom:hideout-001',
  hideoutPowerLevel: 1,
  focusEnabled: false,
  dailyBonusPercent: 0
};

const HIDEOUT_GENERAL_TABLE = [
  [1, 0],
  [2, 6],
  [3, 11],
  [4, 15],
  [5, 18],
  [6, 20],
  [7, 22],
  [8, 24],
  [9, 26]
];

const HIDEOUT_SPECIALIZED_MATRIX = [
  [1, [1, 10.75, 19.5, 27.25, 34, 39.75, 45.5, 51.25, 57]],
  [2, [6, 15.75, 24.5, 32.25, 39, 44.75, 50.5, 56.25, 62]],
  [3, [11, 20.75, 29.5, 37.25, 44, 49.75, 55.5, 61.25, 67]],
  [4, [16, 25.75, 34.5, 42.25, 49, 54.75, 60.5, 66.25, 72]],
  [5, [21, 30.75, 39.5, 47.25, 54, 59.75, 65.5, 71.25, 77]],
  [6, [26, 35.75, 44.5, 52.25, 59, 64.75, 70.5, 76.25, 82]]
];

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function expectedRrr(totalLpbPercent) {
  return 1 - 1 / (1 + totalLpbPercent / 100);
}

function assertClose(actual, expected) {
  assert.ok(Math.abs(actual - expected) < 1e-12, `${actual} should be close to ${expected}`);
}

function assertProductionSuccess(result, expected) {
  assert.deepEqual(Object.keys(result).sort(), [
    'components',
    'errors',
    'ok',
    'rrr',
    'status',
    'totalLpbPercent'
  ].sort());
  assert.equal(result.ok, true);
  assert.equal(result.status, 'calculated');
  assert.deepEqual(Object.keys(result.components).sort(), [
    'dailyLpb',
    'focusLpb',
    'locationBaseLpb',
    'specializationProfileLpb'
  ].sort());
  assert.equal(result.components.locationBaseLpb, expected.locationBaseLpb);
  assert.equal(result.components.specializationProfileLpb, expected.specializationProfileLpb);
  assert.equal(result.components.focusLpb, expected.focusLpb ?? 0);
  assert.equal(result.components.dailyLpb, expected.dailyLpb ?? 0);
  assert.equal(result.totalLpbPercent, expected.totalLpbPercent);
  assertClose(result.rrr, expectedRrr(expected.totalLpbPercent));
  assert.deepEqual(result.errors, []);
}

function assertProductionFailure(result, errorCode) {
  assert.deepEqual(result, {
    ok: false,
    status: 'invalid-production-bonus',
    components: null,
    totalLpbPercent: null,
    rrr: null,
    errors: [errorCode]
  });
}

function assertConsumptionFailure(result, errorCode) {
  assert.deepEqual(result, {
    ok: false,
    status: 'invalid-consumption',
    grossQuantity: null,
    calculatedReturnedQuantity: null,
    calculatedConsumedQuantity: null,
    appliedConsumedQuantity: null,
    consumptionSource: null,
    errors: [errorCode]
  });
}

test('production domain math calculators export their public APIs', () => {
  assert.equal(productionBonusCalculator.calculateProductionBonus, calculateProductionBonus);
  assert.equal(typeof calculateProductionBonus, 'function');
  assert.equal(
    regionalMaterialConsumptionCalculator.calculateRegionalMaterialConsumption,
    calculateRegionalMaterialConsumption
  );
  assert.equal(typeof calculateRegionalMaterialConsumption, 'function');
});

test('production bonus royal city contract calculates base specialization focus daily and RRR', () => {
  assertProductionSuccess(
    calculateProductionBonus({
      profile: clone(ROYAL_PROFILE),
      recipeCategory: 'SWORD',
      eventParameters: clone(ROYAL_EVENT)
    }),
    {
      locationBaseLpb: 18,
      specializationProfileLpb: 0,
      totalLpbPercent: 18
    }
  );

  assertProductionSuccess(
    calculateProductionBonus({
      profile: clone(ROYAL_PROFILE),
      recipeCategory: 'MACE',
      eventParameters: clone(ROYAL_EVENT)
    }),
    {
      locationBaseLpb: 18,
      specializationProfileLpb: 15,
      totalLpbPercent: 33
    }
  );

  assertProductionSuccess(
    calculateProductionBonus({
      profile: clone(ROYAL_PROFILE),
      recipeCategory: 'MACE',
      eventParameters: {
        ...clone(ROYAL_EVENT),
        focusEnabled: true,
        dailyBonusPercent: 20
      }
    }),
    {
      locationBaseLpb: 18,
      specializationProfileLpb: 15,
      focusLpb: 59,
      dailyLpb: 20,
      totalLpbPercent: 112
    }
  );
});

test('production bonus hideout general table applies to non-specialized recipes', () => {
  for (const [hideoutPowerLevel, expectedLpb] of HIDEOUT_GENERAL_TABLE) {
    const result = calculateProductionBonus({
      profile: clone(HIDEOUT_PROFILE),
      recipeCategory: 'SWORD',
      eventParameters: {
        ...clone(HIDEOUT_EVENT),
        hideoutPowerLevel
      }
    });

    assertProductionSuccess(result, {
      locationBaseLpb: expectedLpb,
      specializationProfileLpb: 0,
      totalLpbPercent: expectedLpb
    });
  }
});

test('production bonus hideout specialized matrix preserves location base and profile specialization components', () => {
  for (const [regionQuality, powerValues] of HIDEOUT_SPECIALIZED_MATRIX) {
    for (const [powerIndex, matrixValue] of powerValues.entries()) {
      const hideoutPowerLevel = powerIndex + 1;
      const generalPowerValue = HIDEOUT_GENERAL_TABLE[powerIndex][1];
      const result = calculateProductionBonus({
        profile: {
          ...clone(HIDEOUT_PROFILE),
          regionQuality
        },
        recipeCategory: 'MACE',
        eventParameters: {
          ...clone(HIDEOUT_EVENT),
          hideoutPowerLevel
        }
      });

      assertProductionSuccess(result, {
        locationBaseLpb: generalPowerValue,
        specializationProfileLpb: matrixValue - generalPowerValue,
        totalLpbPercent: matrixValue
      });
    }
  }
});

test('production bonus region mapping accepts exact matching categories and rejects unknown or lowercase categories', () => {
  const matchingByRegion = {
    SWAMP: 'MACE',
    FOREST: 'SWORD',
    MOUNTAIN: 'HAMMER',
    HIGHLAND: 'AXE',
    STEPPE: 'CROSSBOW',
    CENTER: 'WAR_GLOVES',
    MISTS: 'CAPE'
  };

  for (const [region, recipeCategory] of Object.entries(matchingByRegion)) {
    const result = calculateProductionBonus({
      profile: {
        ...clone(ROYAL_PROFILE),
        region
      },
      recipeCategory,
      eventParameters: clone(ROYAL_EVENT)
    });

    assert.equal(result.ok, true);
    assert.equal(result.components.specializationProfileLpb, 15);
  }

  assertProductionFailure(
    calculateProductionBonus({
      profile: clone(ROYAL_PROFILE),
      recipeCategory: 'mace',
      eventParameters: clone(ROYAL_EVENT)
    }),
    'INVALID_RECIPE_CATEGORY'
  );

  assertProductionFailure(
    calculateProductionBonus({
      profile: clone(ROYAL_PROFILE),
      recipeCategory: 'UNKNOWN_CATEGORY',
      eventParameters: clone(ROYAL_EVENT)
    }),
    'INVALID_RECIPE_CATEGORY'
  );

  for (const [region, categories] of Object.entries(REGION_CATEGORIES)) {
    assert.ok(categories.length > 0, `${region} should define at least one category`);
  }
});

test('production bonus validation returns one prioritized error and never mutates profile or event input', () => {
  const validInput = {
    profile: clone(ROYAL_PROFILE),
    recipeCategory: 'MACE',
    eventParameters: clone(ROYAL_EVENT)
  };
  const validSnapshot = clone(validInput);
  assert.equal(calculateProductionBonus(validInput).ok, true);
  assert.deepEqual(validInput, validSnapshot);

  const invalidCases = [
    [
      {
        profile: null,
        recipeCategory: '',
        eventParameters: null
      },
      'INVALID_PROFILE'
    ],
    [
      {
        profile: clone(ROYAL_PROFILE),
        recipeCategory: 'mace',
        eventParameters: null
      },
      'INVALID_RECIPE_CATEGORY'
    ],
    [
      {
        profile: clone(ROYAL_PROFILE),
        recipeCategory: 'MACE',
        eventParameters: {
          ...clone(ROYAL_EVENT),
          dailyBonusPercent: 5
        }
      },
      'INVALID_EVENT_PARAMETERS'
    ],
    [
      {
        profile: clone(ROYAL_PROFILE),
        recipeCategory: 'MACE',
        eventParameters: {
          ...clone(ROYAL_EVENT),
          locationId: 'martlock'
        }
      },
      'LOCATION_MISMATCH'
    ],
    [
      {
        profile: {
          ...clone(HIDEOUT_PROFILE),
          regionQuality: '1'
        },
        recipeCategory: '',
        eventParameters: null
      },
      'INVALID_PROFILE'
    ],
    [
      {
        profile: clone(HIDEOUT_PROFILE),
        recipeCategory: 'MACE',
        eventParameters: {
          ...clone(HIDEOUT_EVENT),
          hideoutPowerLevel: 0
        }
      },
      'INVALID_EVENT_PARAMETERS'
    ]
  ];

  for (const [input, errorCode] of invalidCases) {
    const before = clone(input);
    assertProductionFailure(calculateProductionBonus(input), errorCode);
    assert.deepEqual(input, before);
  }
});

test('regional material consumption exports success shape and uses batch rounding rather than per-craft rounding', () => {
  const rrr = 1 - 1 / 1.18;
  const result = calculateRegionalMaterialConsumption({
    baseQuantity: 5,
    craftQuantity: 10,
    rrr
  });

  assert.deepEqual(result, {
    ok: true,
    status: 'calculated',
    grossQuantity: 50,
    calculatedReturnedQuantity: Math.floor(50 * rrr),
    calculatedConsumedQuantity: 50 - Math.floor(50 * rrr),
    appliedConsumedQuantity: 50 - Math.floor(50 * rrr),
    consumptionSource: 'calculated',
    errors: []
  });

  assert.deepEqual(
    calculateRegionalMaterialConsumption({
      baseQuantity: 8,
      craftQuantity: 3,
      rrr: 1 / 3
    }),
    {
      ok: true,
      status: 'calculated',
      grossQuantity: 24,
      calculatedReturnedQuantity: 8,
      calculatedConsumedQuantity: 16,
      appliedConsumedQuantity: 16,
      consumptionSource: 'calculated',
      errors: []
    }
  );
});

test('regional material consumption manual override is opt-in and ignores stale disabled values', () => {
  const calculatedInput = {
    baseQuantity: 8,
    craftQuantity: 3,
    rrr: 1 / 3
  };

  assert.equal(
    calculateRegionalMaterialConsumption({
      ...calculatedInput,
      override: undefined
    }).consumptionSource,
    'calculated'
  );

  assert.equal(
    calculateRegionalMaterialConsumption({
      ...calculatedInput,
      override: {
        overrideEnabled: false,
        overrideConsumedQuantity: 'stale-invalid-value'
      }
    }).consumptionSource,
    'calculated'
  );

  assert.deepEqual(
    calculateRegionalMaterialConsumption({
      ...calculatedInput,
      override: {
        overrideEnabled: true,
        overrideConsumedQuantity: 17
      }
    }),
    {
      ok: true,
      status: 'calculated',
      grossQuantity: 24,
      calculatedReturnedQuantity: 8,
      calculatedConsumedQuantity: 16,
      appliedConsumedQuantity: 17,
      consumptionSource: 'manual-override',
      errors: []
    }
  );

  assert.equal(
    calculateRegionalMaterialConsumption({
      ...calculatedInput,
      override: {
        overrideEnabled: true,
        overrideConsumedQuantity: 0
      }
    }).appliedConsumedQuantity,
    0
  );
});

test('regional material consumption validation prioritizes one error and keeps inputs immutable', () => {
  const validInput = {
    baseQuantity: 5,
    craftQuantity: 10,
    rrr: 1 - 1 / 1.18,
    override: {
      overrideEnabled: true,
      overrideConsumedQuantity: 17
    }
  };
  const validSnapshot = clone(validInput);
  assert.equal(calculateRegionalMaterialConsumption(validInput).ok, true);
  assert.deepEqual(validInput, validSnapshot);

  const invalidCases = [
    [
      {
        baseQuantity: 0,
        craftQuantity: 0,
        rrr: -1,
        override: { overrideEnabled: true }
      },
      'INVALID_BASE_QUANTITY'
    ],
    [
      {
        baseQuantity: 5,
        craftQuantity: 1.5,
        rrr: -1,
        override: { overrideEnabled: true }
      },
      'INVALID_CRAFT_QUANTITY'
    ],
    [
      {
        baseQuantity: 5,
        craftQuantity: 10,
        rrr: 1,
        override: { overrideEnabled: true }
      },
      'INVALID_RRR'
    ],
    [
      {
        baseQuantity: 5,
        craftQuantity: 10,
        rrr: 0.5,
        override: {
          overrideEnabled: true,
          overrideConsumedQuantity: 1.5
        }
      },
      'INVALID_OVERRIDE'
    ],
    [
      {
        baseQuantity: 5,
        craftQuantity: 10,
        rrr: 0.5,
        override: {
          overrideEnabled: 'true',
          overrideConsumedQuantity: 17
        }
      },
      'INVALID_OVERRIDE'
    ]
  ];

  for (const [input, errorCode] of invalidCases) {
    const before = clone(input);
    assertConsumptionFailure(calculateRegionalMaterialConsumption(input), errorCode);
    assert.deepEqual(input, before);
  }
});
