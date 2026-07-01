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

function assertInvalidProductionInput(input, errorCode) {
  assertProductionFailure(calculateProductionBonus(input), errorCode);
}

function assertInvalidConsumptionInput(input, errorCode) {
  assertConsumptionFailure(calculateRegionalMaterialConsumption(input), errorCode);
}

test('production domain math calculators export their public APIs', () => {
  assert.deepEqual(
    Object.keys(productionBonusCalculator).sort(),
    ['calculateProductionBonus']
  );
  assert.equal(productionBonusCalculator.calculateProductionBonus, calculateProductionBonus);
  assert.equal(typeof calculateProductionBonus, 'function');

  assert.deepEqual(
    Object.keys(regionalMaterialConsumptionCalculator).sort(),
    ['calculateRegionalMaterialConsumption']
  );
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

test('production bonus profile validation matrix rejects malformed royal city and hideout profiles', () => {
  const invalidProfiles = [
    null,
    {},
    { ...ROYAL_PROFILE, locationId: '' },
    { ...ROYAL_PROFILE, locationId: '   ' },
    { ...ROYAL_PROFILE, locationId: 123 },
    { ...ROYAL_PROFILE, facilityType: 'ROYAL-CITY' },
    { ...ROYAL_PROFILE, facilityType: 'unknown' },
    { ...ROYAL_PROFILE, region: 'swamp' },
    { ...ROYAL_PROFILE, region: 'UNKNOWN' }
  ];

  for (const profile of invalidProfiles) {
    assertInvalidProductionInput({
      profile,
      recipeCategory: 'MACE',
      eventParameters: clone(ROYAL_EVENT)
    }, 'INVALID_PROFILE');
  }

  for (const regionQuality of [undefined, 0, 1, 6, 'null']) {
    const profile = { ...ROYAL_PROFILE };
    if (regionQuality === undefined) {
      delete profile.regionQuality;
    } else {
      profile.regionQuality = regionQuality;
    }

    assertInvalidProductionInput({
      profile,
      recipeCategory: 'MACE',
      eventParameters: clone(ROYAL_EVENT)
    }, 'INVALID_PROFILE');
  }

  for (const regionQuality of [1, 2, 3, 4, 5, 6]) {
    assert.equal(
      calculateProductionBonus({
        profile: {
          ...clone(HIDEOUT_PROFILE),
          regionQuality
        },
        recipeCategory: 'MACE',
        eventParameters: clone(HIDEOUT_EVENT)
      }).ok,
      true
    );
  }

  for (const regionQuality of [undefined, null, 0, 7, 1.5, '1', NaN, Infinity]) {
    const profile = { ...HIDEOUT_PROFILE };
    if (regionQuality === undefined) {
      delete profile.regionQuality;
    } else {
      profile.regionQuality = regionQuality;
    }

    assertInvalidProductionInput({
      profile,
      recipeCategory: 'MACE',
      eventParameters: clone(HIDEOUT_EVENT)
    }, 'INVALID_PROFILE');
  }
});

test('production bonus event validation matrix rejects malformed royal city and hideout events', () => {
  const invalidEvents = [
    null,
    {},
    { ...ROYAL_EVENT, locationId: '' },
    { ...ROYAL_EVENT, locationId: '   ' },
    { ...ROYAL_EVENT, locationId: 123 },
    { ...ROYAL_EVENT, focusEnabled: 0 },
    { ...ROYAL_EVENT, focusEnabled: 1 },
    { ...ROYAL_EVENT, focusEnabled: 'true' }
  ];

  for (const eventParameters of invalidEvents) {
    assertInvalidProductionInput({
      profile: clone(ROYAL_PROFILE),
      recipeCategory: 'MACE',
      eventParameters
    }, 'INVALID_EVENT_PARAMETERS');
  }

  for (const dailyBonusPercent of [0, 10, 20]) {
    assert.equal(
      calculateProductionBonus({
        profile: clone(ROYAL_PROFILE),
        recipeCategory: 'MACE',
        eventParameters: {
          ...clone(ROYAL_EVENT),
          dailyBonusPercent
        }
      }).ok,
      true
    );
  }

  for (const dailyBonusPercent of [-10, 5, 15, 0.1, '10', NaN, Infinity]) {
    assertInvalidProductionInput({
      profile: clone(ROYAL_PROFILE),
      recipeCategory: 'MACE',
      eventParameters: {
        ...ROYAL_EVENT,
        dailyBonusPercent
      }
    }, 'INVALID_EVENT_PARAMETERS');
  }

  for (const hideoutPowerLevel of [undefined, 0, 1, 9, 'null']) {
    const eventParameters = { ...ROYAL_EVENT };
    if (hideoutPowerLevel === undefined) {
      delete eventParameters.hideoutPowerLevel;
    } else {
      eventParameters.hideoutPowerLevel = hideoutPowerLevel;
    }

    assertInvalidProductionInput({
      profile: clone(ROYAL_PROFILE),
      recipeCategory: 'MACE',
      eventParameters
    }, 'INVALID_EVENT_PARAMETERS');
  }

  for (const hideoutPowerLevel of [1, 9]) {
    assert.equal(
      calculateProductionBonus({
        profile: clone(HIDEOUT_PROFILE),
        recipeCategory: 'MACE',
        eventParameters: {
          ...clone(HIDEOUT_EVENT),
          hideoutPowerLevel
        }
      }).ok,
      true
    );
  }

  for (const hideoutPowerLevel of [undefined, null, 0, 10, 1.5, '1', NaN, Infinity]) {
    const eventParameters = { ...HIDEOUT_EVENT };
    if (hideoutPowerLevel === undefined) {
      delete eventParameters.hideoutPowerLevel;
    } else {
      eventParameters.hideoutPowerLevel = hideoutPowerLevel;
    }

    assertInvalidProductionInput({
      profile: clone(HIDEOUT_PROFILE),
      recipeCategory: 'MACE',
      eventParameters
    }, 'INVALID_EVENT_PARAMETERS');
  }
});

test('production bonus validation priority distinguishes invalid event from location mismatch', () => {
  assertInvalidProductionInput({
    profile: clone(ROYAL_PROFILE),
    recipeCategory: 'MACE',
    eventParameters: {
      ...clone(ROYAL_EVENT),
      locationId: 'martlock',
      dailyBonusPercent: 5
    }
  }, 'INVALID_EVENT_PARAMETERS');

  assertInvalidProductionInput({
    profile: clone(ROYAL_PROFILE),
    recipeCategory: 'MACE',
    eventParameters: {
      ...clone(ROYAL_EVENT),
      locationId: 'martlock'
    }
  }, 'LOCATION_MISMATCH');

  assertInvalidProductionInput({
    profile: {
      ...clone(ROYAL_PROFILE),
      region: 'swamp'
    },
    recipeCategory: 'mace',
    eventParameters: {
      ...clone(ROYAL_EVENT),
      locationId: 'martlock',
      dailyBonusPercent: 5
    }
  }, 'INVALID_PROFILE');
});

test('production bonus hideout focus and daily bonuses add on top of the specialized matrix result', () => {
  const result = calculateProductionBonus({
    profile: {
      ...clone(HIDEOUT_PROFILE),
      regionQuality: 6
    },
    recipeCategory: 'MACE',
    eventParameters: {
      ...clone(HIDEOUT_EVENT),
      hideoutPowerLevel: 9,
      focusEnabled: true,
      dailyBonusPercent: 10
    }
  });

  assertProductionSuccess(result, {
    locationBaseLpb: 26,
    specializationProfileLpb: 56,
    focusLpb: 59,
    dailyLpb: 10,
    totalLpbPercent: 151
  });
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

  assert.deepEqual(
    calculateRegionalMaterialConsumption({
      ...calculatedInput,
      override: {
        overrideEnabled: true,
        overrideConsumedQuantity: 24
      }
    }),
    {
      ok: true,
      status: 'calculated',
      grossQuantity: 24,
      calculatedReturnedQuantity: 8,
      calculatedConsumedQuantity: 16,
      appliedConsumedQuantity: 24,
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

  assert.deepEqual(
    calculateRegionalMaterialConsumption({
      ...calculatedInput,
      override: {
        overrideEnabled: true,
        overrideConsumedQuantity: 25
      }
    }),
    {
      ok: false,
      status: 'invalid-consumption',
      grossQuantity: null,
      calculatedReturnedQuantity: null,
      calculatedConsumedQuantity: null,
      appliedConsumedQuantity: null,
      consumptionSource: null,
      errors: ['INVALID_OVERRIDE']
    }
  );
});

test('regional material consumption validation matrix covers base craft RRR and override boundaries', () => {
  for (const baseQuantity of [0, -1, 1.5, NaN, Infinity, '1', null, undefined]) {
    assertInvalidConsumptionInput({
      baseQuantity,
      craftQuantity: 10,
      rrr: 0.5
    }, 'INVALID_BASE_QUANTITY');
  }

  for (const craftQuantity of [0, -1, 1.5, NaN, Infinity, '1', null, undefined]) {
    assertInvalidConsumptionInput({
      baseQuantity: 5,
      craftQuantity,
      rrr: 0.5
    }, 'INVALID_CRAFT_QUANTITY');
  }

  for (const rrr of [-0.01, 1, 1.01, NaN, Infinity, '0.5', null, undefined]) {
    assertInvalidConsumptionInput({
      baseQuantity: 5,
      craftQuantity: 10,
      rrr
    }, 'INVALID_RRR');
  }

  for (const rrr of [0, 0.999999]) {
    assert.equal(
      calculateRegionalMaterialConsumption({
        baseQuantity: 5,
        craftQuantity: 10,
        rrr
      }).ok,
      true
    );
  }

  const validOverrideInputs = [
    undefined,
    { overrideEnabled: false },
    {
      overrideEnabled: false,
      overrideConsumedQuantity: 'stale-invalid-value'
    },
    {
      overrideEnabled: true,
      overrideConsumedQuantity: 0
    }
  ];

  for (const override of validOverrideInputs) {
    assert.equal(
      calculateRegionalMaterialConsumption({
        baseQuantity: 5,
        craftQuantity: 10,
        rrr: 0.5,
        override
      }).ok,
      true
    );
  }

  const invalidOverrideInputs = [
    null,
    {},
    { overrideEnabled: 'false' },
    { overrideEnabled: true },
    { overrideEnabled: true, overrideConsumedQuantity: '' },
    { overrideEnabled: true, overrideConsumedQuantity: -1 },
    { overrideEnabled: true, overrideConsumedQuantity: 1.5 },
    { overrideEnabled: true, overrideConsumedQuantity: NaN },
    { overrideEnabled: true, overrideConsumedQuantity: Infinity },
    { overrideEnabled: true, overrideConsumedQuantity: '1' }
  ];

  for (const override of invalidOverrideInputs) {
    assertInvalidConsumptionInput({
      baseQuantity: 5,
      craftQuantity: 10,
      rrr: 0.5,
      override
    }, 'INVALID_OVERRIDE');
  }
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
