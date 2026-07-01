# Special Material Identity Catalog Review Archive

Status: Completed historical review evidence
Authority: Historical catalog review input
Current implementation: Pure-domain source catalog and resolver exist; production inventory integration is not implemented
Active checkpoint: None
Superseded by: src/data/specialMaterialCatalog.js
Last reviewed: 2026-07-01

This document preserves the extraction and review evidence that led to the approved pure-domain catalog.

Current pure-domain authority:

- `src/data/specialMaterialCatalog.js`
- `src/services/specialMaterialIdentityResolver.js`
- corresponding catalog and resolver regression tests

The Markdown tables are historical review evidence. Runtime code must not parse this document or generate stable IDs from it.

Approved IDs now live in the pure source catalog. Production inventory, storage, writer, Crafting integration, backup, UI, migration, and Stable Item ID migration are still not implemented by this document.

## Catalog Evidence Source

Candidate source fields:

- `artifactName`
- `alchemyName`
- `recipe.id`
- `recipe.name`
- `recipe.enName`
- `artifactQty`

Alchemy Tier requirement currently comes from `getAlchemyRequirement()` in `src/components/crafting.js`. It is crafting logic, not a catalog source row.

## Extraction Boundary

Read-only candidate extraction may inspect `ALBION_DB`; it must not modify `src/data/albion_db.js`.

Example inspection command:

```bash
node --input-type=module -e "import('./src/data/albion_db.js').then(({ALBION_DB})=>{const recipes=[];const walk=v=>{if(Array.isArray(v)){for(const x of v)walk(x);return;}if(v&&typeof v==='object'){if(typeof v.id==='string'&&('artifactName'in v||'alchemyName'in v))recipes.push(v);for(const x of Object.values(v))walk(x);}};walk(ALBION_DB);const artifact=new Map(),alchemy=new Map();const add=(map,raw,id)=>{if(typeof raw!=='string'||!raw.trim())return;const key=raw.trim();if(!map.has(key))map.set(key,new Set());map.get(key).add(id);};for(const recipe of recipes){add(artifact,recipe.artifactName,recipe.id);add(alchemy,recipe.alchemyName,recipe.id);}console.log(JSON.stringify({recipes:recipes.length,artifact:artifact.size,alchemy:alchemy.size,total:artifact.size+alchemy.size},null,2));})"
```

## Catalog Review Summary

- Total complete rows: 153
- Artifact rows: 146
- Alchemy rows: 7
- Candidate stable ID rows: 152
- Unresolved rows: 0
- Source-conflict rows: 1
- Duplicate raw references merged: 1
- Candidate stable ID collisions: 0
- Different quantities observed for the same Artifact material: 1
- Chinese-only / English-only / ambiguous rows: 0

Spec Lead review has been completed for the pure-domain catalog/resolver checkpoint. Production integration still requires separate approval.

## Candidate Inventory Summary

- Recipes inspected: 235
- Unique Artifact raw values: 146
- Unique Alchemy raw values: 7
- Total unique Special Material candidates: 153
- Complete table rows: 153
- Candidate stable ID rows: 152
- Unresolved rows: 0
- Source-conflict rows: 1

Completeness equation:

```text
Complete table rows (153) = Candidate stable ID rows (152) + Unresolved rows (0) + Source-conflict rows (1) = Total unique Special Material candidates (153)
```

## Name Parsing Contract

Safe bilingual split writes the leading non-English segment to Chinese Name and the trailing ASCII segment to English Name.

Do not silently resolve:

- Chinese-only raw values
- English-only raw values
- multiple plausible English segments
- punctuation that changes identity meaning
- candidate stable ID collisions
- source recipe metadata conflicts

## Stable ID Candidate Boundary

Candidate Stable ID rules used for this document:

- Artifact candidates use `ARTIFACT_` prefix.
- Alchemy candidates use `ALCHEMY_` prefix.
- Tier is not encoded in the candidate Stable ID.
- Runtime Tier remains a separate identity dimension.
- `TBD` means the candidate must be resolved by Spec Lead before production use.

These IDs are not current implementation and must not be imported into source code without a separate approved implementation task.

## Artifact Candidate Inventory

| Raw Value | Candidate Stable ID | Category | Chinese Name | English Name | Source Recipe IDs | Observed Quantity | Review Status | Notes |
| --------- | ------------------- | -------- | ------------ | ------------ | ----------------- | ----------------- | ------------- | ----- |
| 迷惑護身符 Alluring Amulet | ARTIFACT_ALLURING_AMULET | artifact | 迷惑護身符 | Alluring Amulet | Cultist Robe | 1 | candidate | Complete row from current recipe metadata. |
| 迷惑綁帶 Alluring Bindings | ARTIFACT_ALLURING_BINDINGS | artifact | 迷惑綁帶 | Alluring Bindings | Cultist Sandals | 1 | candidate | Complete row from current recipe metadata. |
| 迷惑弩箭 Alluring Bolts | ARTIFACT_ALLURING_BOLTS | artifact | 迷惑弩箭 | Alluring Bolts | Siegebow | 1 | candidate | Complete row from current recipe metadata. |
| 迷惑水晶 Alluring Crystals | ARTIFACT_ALLURING_CRYSTALS | artifact | 迷惑水晶 | Alluring Crystals | Eye of Secrets | 1 | candidate | Complete row from current recipe metadata. |
| 迷惑襯墊 Alluring Padding | ARTIFACT_ALLURING_PADDING | artifact | 迷惑襯墊 | Alluring Padding | Cultist Cowl | 1 | candidate | Complete row from current recipe metadata. |
| 古代綁帶 Ancient Bindings | ARTIFACT_ANCIENT_BINDINGS | artifact | 古代綁帶 | Ancient Bindings | Graveguard Boots | 1 | candidate | Complete row from current recipe metadata. |
| 古代環鏈 Ancient Chain Rings | ARTIFACT_ANCIENT_CHAIN_RINGS | artifact | 古代環鏈 | Ancient Chain Rings | Graveguard Armor | 1 | candidate | Complete row from current recipe metadata. |
| 古代鎚首 Ancient Hammer Head | ARTIFACT_ANCIENT_HAMMER_HEAD | artifact | 古代鎚首 | Ancient Hammer Head | Tombhammer | 1 | candidate | Complete row from current recipe metadata. |
| 古代襯墊 Ancient Padding | ARTIFACT_ANCIENT_PADDING | artifact | 古代襯墊 | Ancient Padding | Graveguard Helmet | 1 | candidate | Complete row from current recipe metadata. |
| 古代盾牌骨架 Ancient Shield Core | ARTIFACT_ANCIENT_SHIELD_CORE | artifact | 古代盾牌骨架 | Ancient Shield Core | Sarcophagus | 1 | candidate | Complete row from current recipe metadata. |
| 弧光水晶 Arclight Crystal | ARTIFACT_ARCLIGHT_CRYSTAL | artifact | 弧光水晶 | Arclight Crystal | Arclight Blasters | 1 | candidate | Complete row from current recipe metadata. |
| 先知襯墊 Augured Fasteners | ARTIFACT_AUGURED_FASTENERS | artifact | 先知襯墊 | Augured Fasteners | Hood of Tenacity | 1 | candidate | Complete row from current recipe metadata. |
| 先知扣環 Augured Padding | ARTIFACT_AUGURED_PADDING | artifact | 先知扣環 | Augured Padding | Shoes of Tenacity | 1 | candidate | Complete row from current recipe metadata. |
| 先知飾帶 Augured Sash | ARTIFACT_AUGURED_SASH | artifact | 先知飾帶 | Augured Sash | Jacket of Tenacity | 1 | candidate | Complete row from current recipe metadata. |
| 阿瓦隆戰鬥回憶錄 Avalonian Battle Memoir | ARTIFACT_AVALONIAN_BATTLE_MEMOIR | artifact | 阿瓦隆戰鬥回憶錄 | Avalonian Battle Memoir | Realmbreaker | 1 | candidate | Complete row from current recipe metadata. |
| 血鑄之刃 Bloodforged Blade | ARTIFACT_BLOODFORGED_BLADE | artifact | 血鑄之刃 | Bloodforged Blade | Clarent Blade | 1 | candidate | Complete row from current recipe metadata. |
| 血鑄觸媒 Bloodforged Catalyst | ARTIFACT_BLOODFORGED_CATALYST | artifact | 血鑄觸媒 | Bloodforged Catalyst | Damnation Staff | 1 | candidate | Complete row from current recipe metadata. |
| 血鑄尖刺 Bloodforged Spikes | ARTIFACT_BLOODFORGED_SPIKES | artifact | 血鑄尖刺 | Bloodforged Spikes | Facebreaker | 1 | candidate | Complete row from current recipe metadata. |
| 染血古物 Bloodstained Antiquities | ARTIFACT_BLOODSTAINED_ANTIQUITIES | artifact | 染血古物 | Bloodstained Antiquities | Bridled Fury | 1 | candidate | Complete row from current recipe metadata. |
| 藍焰水晶 Blueflame Crystal | TBD | artifact | 藍焰水晶 | Blueflame Crystal | MISSING_RECIPE_ID(藍焰火炬) | 1 | source-conflict | Source recipe metadata has an empty recipe.id; requires Spec Lead source-data decision. |
| 破碎惡魔之牙 Broken Demonic Fangs | ARTIFACT_BROKEN_DEMONIC_FANGS | artifact | 破碎惡魔之牙 | Broken Demonic Fangs | Demonfang | 1 | candidate | Complete row from current recipe metadata. |
| 破碎誓言 Broken Oaths | ARTIFACT_BROKEN_OATHS | artifact | 破碎誓言 | Broken Oaths | Oathkeepers | 1 | candidate | Complete row from current recipe metadata. |
| 燃燒寶珠 Burning Orb | ARTIFACT_BURNING_ORB | artifact | 燃燒寶珠 | Burning Orb | Brimstone Staff | 1 | candidate | Complete row from current recipe metadata. |
| 雕飾白骨 Carved Bone | ARTIFACT_CARVED_BONE | artifact | 雕飾白骨 | Carved Bone | Bow of Badon | 1 | candidate | Complete row from current recipe metadata. |
| 刻顱襯墊 Carved Skull Padding | ARTIFACT_CARVED_SKULL_PADDING | artifact | 刻顱襯墊 | Carved Skull Padding | Judicator Helmet | 1 | candidate | Complete row from current recipe metadata. |
| 冰晶碎片 Chilled Crystalline Shard | ARTIFACT_CHILLED_CRYSTALLINE_SHARD | artifact | 冰晶碎片 | Chilled Crystalline Shard | Chillhowl | 1 | candidate | Complete row from current recipe metadata. |
| 裂紋水晶 Crackling Crystal | ARTIFACT_CRACKLING_CRYSTAL | artifact | 裂紋水晶 | Crackling Crystal | Truebolt Hammer | 1 | candidate | Complete row from current recipe metadata. |
| 阿瓦隆碎裂 Crushed Avalonian Heirloom | ARTIFACT_CRUSHED_AVALONIAN_HEIRLOOM | artifact | 阿瓦隆碎裂 | Crushed Avalonian Heirloom | Astral Aegis | 1 | candidate | Complete row from current recipe metadata. |
| 老手級地獄弩箭 Crystallized Dread | ARTIFACT_CRYSTALLIZED_DREAD | artifact | 老手級地獄弩箭 | Crystallized Dread | Boltcasters | 1 | candidate | Complete row from current recipe metadata. |
| 十字弓遺失零件 Crystallized Spirit | ARTIFACT_CRYSTALLIZED_SPIRIT | artifact | 十字弓遺失零件 | Crystallized Spirit | Weeping Repeater | 1 | candidate | Complete row from current recipe metadata. |
| 詛咒戟刃 Cursed Barbs | ARTIFACT_CURSED_BARBS | artifact | 詛咒戟刃 | Cursed Barbs | Trinity Spear | 1 | candidate | Complete row from current recipe metadata. |
| 詛咒碎刃 Cursed Blades | ARTIFACT_CURSED_BLADES | artifact | 詛咒碎刃 | Cursed Blades | Galatine Pair | 1 | candidate | Complete row from current recipe metadata. |
| 詛咒永凍水晶 Cursed Frozen Crystal | ARTIFACT_CURSED_FROZEN_CRYSTAL | artifact | 詛咒永凍水晶 | Cursed Frozen Crystal | Permafrost Prism | 1 | candidate | Complete row from current recipe metadata. |
| 詛咒顎骨 Cursed Jawbone | ARTIFACT_CURSED_JAWBONE | artifact | 詛咒顎骨 | Cursed Jawbone | Cursed Skull | 1 | candidate | Complete row from current recipe metadata. |
| 阿瓦隆破損護手 Damaged Avalonian Gauntlet | ARTIFACT_DAMAGED_AVALONIAN_GAUNTLET | artifact | 阿瓦隆破損護手 | Damaged Avalonian Gauntlet | Fists of Avalon | 1 | candidate | Complete row from current recipe metadata. |
| 黎明之鷹遺骸 Dawnbird Remnant | ARTIFACT_DAWNBIRD_REMNANT | artifact | 黎明之鷹遺骸 | Dawnbird Remnant | Lightcaller | 1 | candidate | Complete row from current recipe metadata. |
| 死亡之觸水晶 Death-Touched Crystal | ARTIFACT_DEATH_TOUCHED_CRYSTAL | artifact | 死亡之觸水晶 | Death-Touched Crystal | Twin Slayers | 1 | candidate | Complete row from current recipe metadata. |
| 潛魔襯墊 Demonhide Bindings | ARTIFACT_DEMONHIDE_BINDINGS | artifact | 潛魔襯墊 | Demonhide Bindings | Hellion Hood | 1 | candidate | Complete row from current recipe metadata. |
| 潛魔皮革 Demonhide Leather | ARTIFACT_DEMONHIDE_LEATHER | artifact | 潛魔皮革 | Demonhide Leather | Hellion Jacket | 1 | candidate | Complete row from current recipe metadata. |
| 潛魔綁帶 Demonhide Padding | ARTIFACT_DEMONHIDE_PADDING | artifact | 潛魔綁帶 | Demonhide Padding | Hellion Shoes | 1 | candidate | Complete row from current recipe metadata. |
| 惡魔箭鏃 Demonic Arrowheads | ARTIFACT_DEMONIC_ARROWHEADS | artifact | 惡魔箭鏃 | Demonic Arrowheads | Wailing Bow | 1 | candidate | Complete row from current recipe metadata. |
| 惡魔之刃 Demonic Blade | ARTIFACT_DEMONIC_BLADE | artifact | 惡魔之刃 | Demonic Blade | Carving Sword | 1 | candidate | Complete row from current recipe metadata. |
| 惡魔內襯 Demonic Filling | ARTIFACT_DEMONIC_FILLING | artifact | 惡魔內襯 | Demonic Filling | Demon Boots | 1 | candidate | Complete row from current recipe metadata. |
| 惡魔顎骨 Demonic Jawbone | ARTIFACT_DEMONIC_JAWBONE | artifact | 惡魔顎骨 | Demonic Jawbone | Muisak | 1 | candidate | Complete row from current recipe metadata. |
| 惡魔金屬護甲 Demonic Plates | ARTIFACT_DEMONIC_PLATES | artifact | 惡魔金屬護甲 | Demonic Plates | Demon Armor | 1 | candidate | Complete row from current recipe metadata. |
| 惡魔殘片 Demonic Scraps | ARTIFACT_DEMONIC_SCRAPS | artifact | 惡魔殘片 | Demonic Scraps | Demon Helmet | 1 | candidate | Complete row from current recipe metadata. |
| 恐懼風暴水晶 Dreadstorm Crystal | ARTIFACT_DREADSTORM_CRYSTAL | artifact | 恐懼風暴水晶 | Dreadstorm Crystal | Dreadstorm Monarch | 1 | candidate | Complete row from current recipe metadata. |
| 德魯伊綁帶 Druidic Bindings | ARTIFACT_DRUIDIC_BINDINGS | artifact | 德魯伊綁帶 | Druidic Bindings | Druid Sandals | 1 | candidate | Complete row from current recipe metadata. |
| 德路伊羽毛 Druidic Feathers | ARTIFACT_DRUIDIC_FEATHERS | artifact | 德路伊羽毛 | Druidic Feathers | Druid Robe | 1 | candidate | Complete row from current recipe metadata. |
| 德魯伊碑文 Druidic Inscriptions | ARTIFACT_DRUIDIC_INSCRIPTIONS | artifact | 德魯伊碑文 | Druidic Inscriptions | Druidic Staff | 1 | candidate | Complete row from current recipe metadata. |
| 德魯伊防腐鳥喙 Druidic Preserved Beak | ARTIFACT_DRUIDIC_PRESERVED_BEAK | artifact | 德魯伊防腐鳥喙 | Druidic Preserved Beak | Druid Cowl | 1 | candidate | Complete row from current recipe metadata. |
| 鑲邊水晶 Edged Crystal | ARTIFACT_EDGED_CRYSTAL | artifact | 鑲邊水晶 | Edged Crystal | Crystal Reaper | 1 | candidate | Complete row from current recipe metadata. |
| 刻紋原木 Engraved Log | ARTIFACT_ENGRAVED_LOG | artifact | 刻紋原木 | Engraved Log | Grovekeeper | 1 | candidate | Complete row from current recipe metadata. |
| 榮耀水晶 Exalted Crystal | ARTIFACT_EXALTED_CRYSTAL | artifact | 榮耀水晶 | Exalted Crystal | Exalted Staff | 1 | candidate | Complete row from current recipe metadata. |
| 尊榮腿甲 Exalted Greave | ARTIFACT_EXALTED_GREAVE | artifact | 尊榮腿甲 | Exalted Greave | Boots of Valor | 1 | candidate | Complete row from current recipe metadata. |
| 尊榮金屬護甲 Exalted Plating | ARTIFACT_EXALTED_PLATING | artifact | 尊榮金屬護甲 | Exalted Plating | Armor of Valor | 1 | candidate | Complete row from current recipe metadata. |
| 尊榮面具 Exalted Visor | ARTIFACT_EXALTED_VISOR | artifact | 尊榮面具 | Exalted Visor | Helmet of Valor | 1 | candidate | Complete row from current recipe metadata. |
| 精靈背翅 Fey Dorsal Wing | ARTIFACT_FEY_DORSAL_WING | artifact | 精靈背翅 | Fey Dorsal Wing | Feyscale Robe | 1 | candidate | Complete row from current recipe metadata. |
| 精靈龍鱗 Fey Dragonscales | ARTIFACT_FEY_DRAGONSCALES | artifact | 精靈龍鱗 | Fey Dragonscales | Feyscale Sandals | 1 | candidate | Complete row from current recipe metadata. |
| 獅鷲絨毛 Flawless Griffin Beak | ARTIFACT_FLAWLESS_GRIFFIN_BEAK | artifact | 獅鷲絨毛 | Flawless Griffin Beak | Mistwalker Shoes | 1 | candidate | Complete row from current recipe metadata. |
| 鍛造水晶 Forged Crystal | ARTIFACT_FORGED_CRYSTAL | artifact | 鍛造水晶 | Forged Crystal | Forgebark Staff | 1 | candidate | Complete row from current recipe metadata. |
| 碎裂混沌寶珠 Fractured Opaque Orb | ARTIFACT_FRACTURED_OPAQUE_ORB | artifact | 碎裂混沌寶珠 | Fractured Opaque Orb | Shadowcaller | 1 | candidate | Complete row from current recipe metadata. |
| 驚魂箭矢 Ghastly Arrows | ARTIFACT_GHASTLY_ARROWS | artifact | 驚魂箭矢 | Ghastly Arrows | Whispering Bow | 1 | candidate | Complete row from current recipe metadata. |
| 驚魂面甲 Ghastly Bindings | ARTIFACT_GHASTLY_BINDINGS | artifact | 驚魂面甲 | Ghastly Bindings | Specter Hood | 1 | candidate | Complete row from current recipe metadata. |
| 驚魂碎刃 Ghastly Blades | ARTIFACT_GHASTLY_BLADES | artifact | 驚魂碎刃 | Ghastly Blades | Deathgivers | 1 | candidate | Complete row from current recipe metadata. |
| 驚魂蠟燭 Ghastly Candle | ARTIFACT_GHASTLY_CANDLE | artifact | 驚魂蠟燭 | Ghastly Candle | Cryptcandle | 1 | candidate | Complete row from current recipe metadata. |
| 驚魂皮革 Ghastly Leather | ARTIFACT_GHASTLY_LEATHER | artifact | 驚魂皮革 | Ghastly Leather | Specter Jacket | 1 | candidate | Complete row from current recipe metadata. |
| 驚魂之環 Ghastly Scroll | ARTIFACT_GHASTLY_SCROLL | artifact | 驚魂之環 | Ghastly Scroll | Redemption Staff | 1 | candidate | Complete row from current recipe metadata. |
| 驚魂綁帶 Ghastly Visor | ARTIFACT_GHASTLY_VISOR | artifact | 驚魂綁帶 | Ghastly Visor | Specter Shoes | 1 | candidate | Complete row from current recipe metadata. |
| 榮光之戒 Glowing Harmonic Ring | ARTIFACT_GLOWING_HARMONIC_RING | artifact | 榮光之戒 | Glowing Harmonic Ring | Dawnsong | 1 | candidate | Complete row from current recipe metadata. |
| 完美獅鷲利喙 Griffin Underfur | ARTIFACT_GRIFFIN_UNDERFUR | artifact | 完美獅鷲利喙 | Griffin Underfur | Mistwalker Hood | 1 | candidate | Complete row from current recipe metadata. |
| 硬化柔刃 Hardened Deboles | ARTIFACT_HARDENED_DEBOLES | artifact | 硬化柔刃 | Hardened Deboles | Bloodletter | 1 | candidate | Complete row from current recipe metadata. |
| 煉獄小惡魔遺骸 Hellfire Imp Remnant | ARTIFACT_HELLFIRE_IMP_REMNANT | artifact | 煉獄小惡魔遺骸 | Hellfire Imp Remnant | Hellspawn Staff | 1 | candidate | Complete row from current recipe metadata. |
| 地獄鎚首 Hellish Hammer Heads | ARTIFACT_HELLISH_HAMMER_HEADS | artifact | 地獄鎚首 | Hellish Hammer Heads | Forge Hammers | 1 | candidate | Complete row from current recipe metadata. |
| 地獄手柄 Hellish Handle | ARTIFACT_HELLISH_HANDLE | artifact | 地獄手柄 | Hellish Handle | Leering Cane | 1 | candidate | Complete row from current recipe metadata. |
| 地獄鐮刃 Hellish Sicklehead | ARTIFACT_HELLISH_SICKLEHEAD | artifact | 地獄鐮刃 | Hellish Sicklehead | Infernal Scythe | 1 | candidate | Complete row from current recipe metadata. |
| 地獄雙鐮刃 Hellish Sicklehead Pairs | ARTIFACT_HELLISH_SICKLEHEAD_PAIRS | artifact | 地獄雙鐮刃 | Hellish Sicklehead Pairs | Soulscythe | 1 | candidate | Complete row from current recipe metadata. |
| 白霜寶珠 Hoarfrost Orb | ARTIFACT_HOARFROST_ORB | artifact | 白霜寶珠 | Hoarfrost Orb | Hoarfrost Staff | 1 | candidate | Complete row from current recipe metadata. |
| 阿瓦隆詠唱旋輪 Humming Avalonian Whirligig | ARTIFACT_HUMMING_AVALONIAN_WHIRLIGIG | artifact | 阿瓦隆詠唱旋輪 | Humming Avalonian Whirligig | Energy Shaper | 1 | candidate | Complete row from current recipe metadata. |
| 沉眠之戒 Hypnotic Harmonic Ring | ARTIFACT_HYPNOTIC_HARMONIC_RING | artifact | 沉眠之戒 | Hypnotic Harmonic Ring | Evensong | 1 | candidate | Complete row from current recipe metadata. |
| 冰柱寶珠 Icicle Orb | ARTIFACT_ICICLE_ORB | artifact | 冰柱寶珠 | Icicle Orb | Icicle Staff | 1 | candidate | Complete row from current recipe metadata. |
| 冰寒水晶 Icy Crystal | ARTIFACT_ICY_CRYSTAL | artifact | 冰寒水晶 | Icy Crystal | Arctic Staff | 1 | candidate | Complete row from current recipe metadata. |
| 注魔皮革襯裡 Imbued Leather Folds | ARTIFACT_IMBUED_LEATHER_FOLDS | artifact | 注魔皮革襯裡 | Imbued Leather Folds | Stalker Jacket | 1 | candidate | Complete row from current recipe metadata. |
| 注魔錘矛首 Imbued Mace Head | ARTIFACT_IMBUED_MACE_HEAD | artifact | 注魔錘矛首 | Imbued Mace Head | Camlann Mace | 1 | candidate | Complete row from current recipe metadata. |
| 注魔面甲 Imbued Soles | ARTIFACT_IMBUED_SOLES | artifact | 注魔面甲 | Imbued Soles | Stalker Hood | 1 | candidate | Complete row from current recipe metadata. |
| 注魔鞋底 Imbued Visor | ARTIFACT_IMBUED_VISOR | artifact | 注魔鞋底 | Imbued Visor | Stalker Shoes | 1 | candidate | Complete row from current recipe metadata. |
| 無瑕手工弓身 Immaculately Crafted Riser | ARTIFACT_IMMACULATELY_CRAFTED_RISER | artifact | 無瑕手工弓身 | Immaculately Crafted Riser | Skystrider Bow | 1 | candidate | Complete row from current recipe metadata. |
| 煉獄布質綁帶 Infernal Cloth Bindings | ARTIFACT_INFERNAL_CLOTH_BINDINGS | artifact | 煉獄布質綁帶 | Infernal Cloth Bindings | Fiend Sandals | 1 | candidate | Complete row from current recipe metadata. |
| 煉獄布質襯裡 Infernal Cloth Folds | ARTIFACT_INFERNAL_CLOTH_FOLDS | artifact | 煉獄布質襯裡 | Infernal Cloth Folds | Fiend Robe | 1 | candidate | Complete row from current recipe metadata. |
| 煉獄布質面甲 Infernal Cloth Visor | ARTIFACT_INFERNAL_CLOTH_VISOR | artifact | 煉獄布質面甲 | Infernal Cloth Visor | Fiend Cowl | 1 | candidate | Complete row from current recipe metadata. |
| 煉獄叉槍首 Infernal Harpoon Tips | ARTIFACT_INFERNAL_HARPOON_TIPS | artifact | 煉獄叉槍首 | Infernal Harpoon Tips | Spirithunter | 1 | candidate | Complete row from current recipe metadata. |
| 煉獄錘矛首 Infernal Mace Head | ARTIFACT_INFERNAL_MACE_HEAD | artifact | 煉獄錘矛首 | Infernal Mace Head | Incubus Mace | 1 | candidate | Complete row from current recipe metadata. |
| 煉獄卷軸 Infernal Scroll | ARTIFACT_INFERNAL_SCROLL | artifact | 煉獄卷軸 | Infernal Scroll | Fallen Staff | 1 | candidate | Complete row from current recipe metadata. |
| 煉獄盾牌骨架 Infernal Shield Core | ARTIFACT_INFERNAL_SHIELD_CORE | artifact | 煉獄盾牌骨架 | Infernal Shield Core | Caitiff Shield | 1 | candidate | Complete row from current recipe metadata. |
| 無限水晶 Infinite Crystal | ARTIFACT_INFINITE_CRYSTAL | artifact | 無限水晶 | Infinite Crystal | Infinity Blade | 1 | candidate | Complete row from current recipe metadata. |
| 烙印綁帶 Inscribed Bindings | ARTIFACT_INSCRIBED_BINDINGS | artifact | 烙印綁帶 | Inscribed Bindings | Judicator Boots | 1 | candidate | Complete row from current recipe metadata. |
| 烙印石環 Inscribed Stone | ARTIFACT_INSCRIBED_STONE | artifact | 烙印石環 | Inscribed Stone | Taproot | 1 | candidate | Complete row from current recipe metadata. |
| 完整精靈腓骨 Intact Fey Fibula | ARTIFACT_INTACT_FEY_FIBULA | artifact | 完整精靈腓骨 | Intact Fey Fibula | Feyscale Cowl | 1 | candidate | Complete row from current recipe metadata. |
| 看守者斧首 Keeper Axeheads | ARTIFACT_KEEPER_AXEHEADS | artifact | 看守者斧首 | Keeper Axeheads | Bear Paws | 1 | candidate | Complete row from current recipe metadata. |
| 看守者矛首 Keeper Spearhead | ARTIFACT_KEEPER_SPEARHEAD | artifact | 看守者矛首 | Keeper Spearhead | Heron Spear | 1 | candidate | Complete row from current recipe metadata. |
| 失落秘術水晶 Lost Arcane Crystal | ARTIFACT_LOST_ARCANE_CRYSTAL | artifact | 失落秘術水晶 | Lost Arcane Crystal | Witchwork Staff | 1 | candidate | Complete row from current recipe metadata. |
| 失落詛咒水晶 Lost Cursed Crystal | ARTIFACT_LOST_CURSED_CRYSTAL | artifact | 失落詛咒水晶 | Lost Cursed Crystal | Lifecurse Staff | 1 | candidate | Complete row from current recipe metadata. |
| 萬金之手 Massive Metallic Hand | ARTIFACT_MASSIVE_METALLIC_HAND | artifact | 萬金之手 | Massive Metallic Hand | Hand of Justice | 1 | candidate | Complete row from current recipe metadata. |
| 救世珍寶 Messianic Curio | ARTIFACT_MESSIANIC_CURIO | artifact | 救世珍寶 | Messianic Curio | Hallowfall | 1 | candidate | Complete row from current recipe metadata. |
| 幻象水晶 Mirage Crystal | ARTIFACT_MIRAGE_CRYSTAL | artifact | 幻象水晶 | Mirage Crystal | Phantom Twinblade | 1 | candidate | Complete row from current recipe metadata. |
| 摩根娜斧槍首 Morgana Halberd Head | ARTIFACT_MORGANA_HALBERD_HEAD | artifact | 摩根娜斧槍首 | Morgana Halberd Head | Carrioncaller | 1 | candidate | Complete row from current recipe metadata. |
| 奧秘寶珠 Occult Orb | ARTIFACT_OCCULT_ORB | artifact | 奧秘寶珠 | Occult Orb | Occult Staff | 1 | candidate | Complete row from current recipe metadata. |
| 癲狂觸媒 Possessed Catalyst | ARTIFACT_POSSESSED_CATALYST | artifact | 癲狂觸媒 | Possessed Catalyst | Malevolent Locus | 1 | candidate | Complete row from current recipe metadata. |
| 癲狂之環 Possessed Scroll | ARTIFACT_POSSESSED_SCROLL | artifact | 癲狂之環 | Possessed Scroll | Lifetouch Staff | 1 | candidate | Complete row from current recipe metadata. |
| 防腐皮草 Preserved Animal Fur | ARTIFACT_PRESERVED_ANIMAL_FUR | artifact | 防腐皮草 | Preserved Animal Fur | Judicator Armor | 1 | candidate | Complete row from current recipe metadata. |
| 防腐原木 Preserved Log | ARTIFACT_PRESERVED_LOG | artifact | 防腐原木 | Preserved Log | Rampant Staff | 1 | candidate | Complete row from current recipe metadata. |
| 防腐原石 Preserved Rocks | ARTIFACT_PRESERVED_ROCKS | artifact | 防腐原石 | Preserved Rocks | Staff of Balance | 1 | candidate | Complete row from current recipe metadata. |
| 脈動水晶 Pulsating Crystal | ARTIFACT_PULSATING_CRYSTAL | artifact | 脈動水晶 | Pulsating Crystal | Forcepulse Bracers | 1 | candidate | Complete row from current recipe metadata. |
| 焚心水晶 Pyreheart Crystal | ARTIFACT_PYREHEART_CRYSTAL | artifact | 焚心水晶 | Pyreheart Crystal | Flamewalker Staff | 1 | candidate | Complete row from current recipe metadata. |
| 摩根娜強化槍首 Reinforced Morgana Poles | ARTIFACT_REINFORCED_MORGANA_POLES | artifact | 摩根娜強化槍首 | Reinforced Morgana Poles | Black Monk Stave | 1 | candidate | Complete row from current recipe metadata. |
| 先王遺物 Remnants of the Old King | ARTIFACT_REMNANTS_OF_THE_OLD_KING | artifact | 先王遺物 | Remnants of the Old King | Kingmaker | 1 | candidate | Complete row from current recipe metadata. |
| 裂隙水晶 Rift Crystal | ARTIFACT_RIFT_CRYSTAL | artifact | 裂隙水晶 | Rift Crystal | Daybreaker | 1 | candidate | Complete row from current recipe metadata. |
| 腐敗水晶 Rotten Crystal | ARTIFACT_ROTTEN_CRYSTAL | artifact | 腐敗水晶 | Rotten Crystal | Rotcaller Staff | 1 | candidate | Complete row from current recipe metadata. |
| 皇家徽記 Royal Sigils | ARTIFACT_ROYAL_SIGILS | artifact | 皇家徽記 | Royal Sigils | Royal Armor, Royal Boots, Royal Cowl, Royal Helmet, Royal Hood, Royal Jacket, Royal Robe, Royal Sandals, Royal Shoes | 2, 4 | candidate | Complete row from current recipe metadata. |
| 破損先祖護手 Ruined Ancestral Vamplates | ARTIFACT_RUINED_ANCESTRAL_VAMPLATES | artifact | 破損先祖護手 | Ruined Ancestral Vamplates | Rift Glaive | 1 | candidate | Complete row from current recipe metadata. |
| 符文號角 Runed Horn | ARTIFACT_RUNED_HORN | artifact | 符文號角 | Runed Horn | Mistcaller | 1 | candidate | Complete row from current recipe metadata. |
| 符文原石 Runed Rock | ARTIFACT_RUNED_ROCK | artifact | 符文原石 | Runed Rock | Bedrock Mace | 1 | candidate | Complete row from current recipe metadata. |
| 符文石魔像遺骸 Runestone Golem Remnant | ARTIFACT_RUNESTONE_GOLEM_REMNANT | artifact | 符文石魔像遺骸 | Runestone Golem Remnant | Earthrune Staff | 1 | candidate | Complete row from current recipe metadata. |
| 聖潔腰帶 Sanctified Belt | ARTIFACT_SANCTIFIED_BELT | artifact | 聖潔腰帶 | Sanctified Belt | Robe of Purity | 1 | candidate | Complete row from current recipe metadata. |
| 聖潔綁帶 Sanctified Bindings | ARTIFACT_SANCTIFIED_BINDINGS | artifact | 聖潔綁帶 | Sanctified Bindings | Sandals of Purity | 1 | candidate | Complete row from current recipe metadata. |
| 聖潔面具 Sanctified Mask | ARTIFACT_SANCTIFIED_MASK | artifact | 聖潔面具 | Sanctified Mask | Cowl of Purity | 1 | candidate | Complete row from current recipe metadata. |
| 靈蛇水晶 Serpent Crystal | ARTIFACT_SERPENT_CRYSTAL | artifact | 靈蛇水晶 | Serpent Crystal | Stillgaze Staff | 1 | candidate | Complete row from current recipe metadata. |
| 破損天界信物 Severed Celestial Keepsake | ARTIFACT_SEVERED_CELESTIAL_KEEPSAKE | artifact | 破損天界信物 | Severed Celestial Keepsake | Celestial Censer | 1 | candidate | Complete row from current recipe metadata. |
| 惡魔斷角 Severed Demonic Horns | ARTIFACT_SEVERED_DEMONIC_HORNS | artifact | 惡魔斷角 | Severed Demonic Horns | Hellfire Hands | 1 | candidate | Complete row from current recipe metadata. |
| 阿瓦隆破碎紀念物 Shattered Avalonian Memento | ARTIFACT_SHATTERED_AVALONIAN_MEMENTO | artifact | 阿瓦隆破碎紀念物 | Shattered Avalonian Memento | Sacred Scepter | 1 | candidate | Complete row from current recipe metadata. |
| 星觸法仗 Startouched Crystal | ARTIFACT_STARTOUCHED_CRYSTAL | artifact | 星觸法仗 | Startouched Crystal | Astral Staff | 1 | candidate | Complete row from current recipe metadata. |
| 瘟疫象徵 Symbol of Blight | ARTIFACT_SYMBOL_OF_BLIGHT | artifact | 瘟疫象徵 | Symbol of Blight | Blight Staff | 1 | candidate | Complete row from current recipe metadata. |
| 時凝水晶 Timelocked Crystal | ARTIFACT_TIMELOCKED_CRYSTAL | artifact | 時凝水晶 | Timelocked Crystal | Timelocked Grimoire | 1 | candidate | Complete row from current recipe metadata. |
| 陳舊手杖 Timeworn Walking Staves | ARTIFACT_TIMEWORN_WALKING_STAVES | artifact | 陳舊手杖 | Timeworn Walking Staves | Grailseeker | 1 | candidate | Complete row from current recipe metadata. |
| 不破水晶 Unbreakable Crystal | ARTIFACT_UNBREAKABLE_CRYSTAL | artifact | 不破水晶 | Unbreakable Crystal | Unbreakable Ward | 1 | candidate | Complete row from current recipe metadata. |
| 不潔之環 Unholy Scroll | ARTIFACT_UNHOLY_SCROLL | artifact | 不潔之環 | Unholy Scroll | Blazing Staff | 1 | candidate | Complete row from current recipe metadata. |
| 無損獅鷲羽毛 Untarnished Griffin Feathers | ARTIFACT_UNTARNISHED_GRIFFIN_FEATHERS | artifact | 無損獅鷲羽毛 | Untarnished Griffin Feathers | Mistwalker Jacket | 1 | candidate | Complete row from current recipe metadata. |
| 無根永生幼苗 Uprooted Perennial Sapling | ARTIFACT_UPROOTED_PERENNIAL_SAPLING | artifact | 無根永生幼苗 | Uprooted Perennial Sapling | Ironroot Staff | 1 | candidate | Complete row from current recipe metadata. |
| 巨熊守衛遺骸 Ursine Guardian Remains | ARTIFACT_URSINE_GUARDIAN_REMAINS | artifact | 巨熊守衛遺骸 | Ursine Guardian Remains | Ursine Maulers | 1 | candidate | Complete row from current recipe metadata. |
| 迷霧織蛛甲殼 Veilweaver Carapace | ARTIFACT_VEILWEAVER_CARAPACE | artifact | 迷霧織蛛甲殼 | Veilweaver Carapace | Duskweaver Armor | 1 | candidate | Complete row from current recipe metadata. |
| 迷霧織蛛尖爪 Veilweaver Claws | ARTIFACT_VEILWEAVER_CLAWS | artifact | 迷霧織蛛尖爪 | Veilweaver Claws | Duskweaver Boots | 1 | candidate | Complete row from current recipe metadata. |
| 迷霧織蛛大鄂 Veilweaver Mandibles | ARTIFACT_VEILWEAVER_MANDIBLES | artifact | 迷霧織蛛大鄂 | Veilweaver Mandibles | Duskweaver Helmet | 1 | candidate | Complete row from current recipe metadata. |
| 變形黯鴉金屬護甲 Warped Raven Plate | ARTIFACT_WARPED_RAVEN_PLATE | artifact | 變形黯鴉金屬護甲 | Warped Raven Plate | Ravenstrike Cestus | 1 | candidate | Complete row from current recipe metadata. |
| 狼人遺骸 Werewolf Remnant | ARTIFACT_WEREWOLF_REMNANT | artifact | 狼人遺骸 | Werewolf Remnant | Bloodmoon Staff | 1 | candidate | Complete row from current recipe metadata. |
| 野火寶珠 Wildfire Orb | ARTIFACT_WILDFIRE_ORB | artifact | 野火寶珠 | Wildfire Orb | Wildfire Staff | 1 | candidate | Complete row from current recipe metadata. |
| 風鳴水晶 Windborne Crystal | ARTIFACT_WINDBORNE_CRYSTAL | artifact | 風鳴水晶 | Windborne Crystal | Mistpiercer | 1 | candidate | Complete row from current recipe metadata. |

## Alchemy Candidate Inventory

| Raw Value | Candidate Stable ID | Category | Chinese Name | English Name | Source Recipe IDs | Observed Quantity | Review Status | Notes |
| --------- | ------------------- | -------- | ------------ | ------------ | ----------------- | ----------------- | ------------- | ----- |
| 黎明羽毛 Dawnfeather | ALCHEMY_DAWNFEATHER | alchemy | 黎明羽毛 | Dawnfeather | Lightcaller | tier-derived | candidate | Complete row from current recipe metadata. |
| 小惡魔角 Imp's Horn | ALCHEMY_IMP_S_HORN | alchemy | 小惡魔角 | Imp's Horn | Hellspawn Staff | tier-derived | candidate | Complete row from current recipe metadata. |
| 符文牙齒 Runestone Tooth | ALCHEMY_RUNESTONE_TOOTH | alchemy | 符文牙齒 | Runestone Tooth | Earthrune Staff | tier-derived | candidate | Complete row from current recipe metadata. |
| 暗影之爪 Shadow Claws | ALCHEMY_SHADOW_CLAWS | alchemy | 暗影之爪 | Shadow Claws | Prowling Staff | tier-derived | candidate | Complete row from current recipe metadata. |
| 靈性之爪 Spirit Paws | ALCHEMY_SPIRIT_PAWS | alchemy | 靈性之爪 | Spirit Paws | Primal Staff | tier-derived | candidate | Complete row from current recipe metadata. |
| 樹人之根 Sylvian Root | ALCHEMY_SYLVIAN_ROOT | alchemy | 樹人之根 | Sylvian Root | Rootbound Staff | tier-derived | candidate | Complete row from current recipe metadata. |
| 狼人獠牙 Werewolf Fangs | ALCHEMY_WEREWOLF_FANGS | alchemy | 狼人獠牙 | Werewolf Fangs | Bloodmoon Staff | tier-derived | candidate | Complete row from current recipe metadata. |

## Unresolved Candidate Details

No row-level unresolved candidates were found by the current extraction.

## Source Conflict Details

Source-conflict rows require Spec Lead review before production catalog work:

- `藍焰水晶 Blueflame Crystal`: `recipe.id` is empty in source metadata. The inventory table records `MISSING_RECIPE_ID(藍焰火炬)` and keeps Candidate Stable ID as `TBD`.

General review risks remain:

- Candidate IDs are unapproved.
- Source recipe metadata may still contain human naming errors.
- Future catalog source location is undecided.
- Resolver tests are not approved by this document.

## Review Questions

1. Are candidate stable IDs acceptable?
2. Which Chinese / English names are canonical display names?
3. Are any current raw recipe names wrong or duplicate?
4. Should Alchemy stable IDs identify material kind only, with Tier supplied by runtime identity?
5. Should the future catalog source live under `src/data` or a domain module?
6. What review process approves a candidate row as a production assignment?

No answer in this document authorizes catalog source, resolver tests, storage, writer, backup, UI, Crafting integration, or Stable Item ID migration.
