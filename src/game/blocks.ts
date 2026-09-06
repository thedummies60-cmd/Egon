// ---------- block & item registry ----------

export type Stack = { id: number; count: number };

export const B = {
  AIR: 0, GRASS: 1, DIRT: 2, STONE: 3, COBBLE: 4, SAND: 5, LOG: 6, LEAVES: 7,
  PLANKS: 8, GLASS: 9, WATER: 10, SNOWGRASS: 11, SNOW: 12, CACTUS: 13,
  BEDROCK: 14, COAL_ORE: 15, IRON_ORE: 16, GOLD_ORE: 17, DIAMOND_ORE: 18,
  GRAVEL: 19, TABLE: 20, FURNACE: 21, STONEBRICK: 22, BOOKSHELF: 23,
  WOOL: 24, ROSE: 25, DANDELION: 26, TALLGRASS: 27, PUMPKIN: 28, TNT: 29,
} as const;

export const IT = {
  STICK: 100, COAL: 101, IRON: 102, GOLD: 103, DIAMOND: 104, APPLE: 105,
  PORK: 106, BEEF: 107, CHICKEN: 108, GUNPOWDER: 109,
  WSWORD: 120, WPICK: 121, WAXE: 122,
  SSWORD: 123, SPICK: 124, SAXE: 125,
  ISWORD: 126, IPICK: 127, IAXE: 128,
  DSWORD: 129, DPICK: 130, DAXE: 131,
} as const;

// tile indices in the 16x16 atlas
export const T = {
  GRASS_TOP: 0, GRASS_SIDE: 1, DIRT: 2, STONE: 3, COBBLE: 4, SAND: 5,
  LOG_SIDE: 6, LOG_TOP: 7, LEAVES: 8, PLANKS: 9, GLASS: 10, WATER: 11,
  SNOW_SIDE: 12, SNOW: 13, CACTUS_SIDE: 14, CACTUS_TOP: 15, BEDROCK: 16,
  COAL: 17, IRON: 18, GOLD: 19, DIAMOND: 20, GRAVEL: 21, TABLE_TOP: 22,
  TABLE_SIDE: 23, FURNACE_SIDE: 24, FURNACE_FRONT: 25, STONEBRICK: 26,
  BOOKSHELF: 27, WOOL: 28, ROSE: 29, DANDELION: 30, TALLGRASS: 31,
  PUMPKIN_SIDE: 32, PUMPKIN_TOP: 33, TNT_SIDE: 34, TNT_TOP: 35,
} as const;

export interface BlockDef {
  name: string;
  tile: [number, number, number]; // top, side, bottom
  solid: boolean;
  hard: number; // seconds to mine bare-handed; -1 = unbreakable
  tier: number; // required pickaxe tier (0 = hand ok)
  drop: number; // 0 = drops nothing
  tool?: "pickaxe" | "axe" | "shovel";
  cross?: boolean;
  transparent?: boolean;
}

export interface ItemDef {
  name: string;
  icon: string;
  food?: number; // half drumsticks restored
  tool?: { kind: "sword" | "pickaxe" | "axe"; tier: number; dmg: number; speed: number };
}

const bd = (
  name: string, tile: [number, number, number], hard: number,
  extra: Partial<BlockDef> = {},
): BlockDef => ({
  name, tile, hard,
  solid: true, tier: 0, drop: -1, ...extra,
});

export const BLOCKS: Record<number, BlockDef> = {
  [B.GRASS]: bd("Grass Block", [T.GRASS_TOP, T.GRASS_SIDE, T.DIRT], 0.6, { tool: "shovel", drop: B.DIRT }),
  [B.DIRT]: bd("Dirt", [T.DIRT, T.DIRT, T.DIRT], 0.5, { tool: "shovel", drop: B.DIRT }),
  [B.STONE]: bd("Stone", [T.STONE, T.STONE, T.STONE], 1.6, { tool: "pickaxe", tier: 1, drop: B.COBBLE }),
  [B.COBBLE]: bd("Cobblestone", [T.COBBLE, T.COBBLE, T.COBBLE], 1.8, { tool: "pickaxe", tier: 1, drop: B.COBBLE }),
  [B.SAND]: bd("Sand", [T.SAND, T.SAND, T.SAND], 0.5, { tool: "shovel", drop: B.SAND }),
  [B.LOG]: bd("Oak Log", [T.LOG_TOP, T.LOG_SIDE, T.LOG_TOP], 1.8, { tool: "axe", drop: B.LOG }),
  [B.LEAVES]: bd("Leaves", [T.LEAVES, T.LEAVES, T.LEAVES], 0.25, { drop: 0, transparent: true }),
  [B.PLANKS]: bd("Oak Planks", [T.PLANKS, T.PLANKS, T.PLANKS], 1.6, { tool: "axe", drop: B.PLANKS }),
  [B.GLASS]: bd("Glass", [T.GLASS, T.GLASS, T.GLASS], 0.35, { drop: B.GLASS, transparent: true }),
  [B.WATER]: bd("Water", [T.WATER, T.WATER, T.WATER], -1, { solid: false, transparent: true, drop: 0 }),
  [B.SNOWGRASS]: bd("Snowy Grass", [T.SNOW, T.SNOW_SIDE, T.DIRT], 0.6, { tool: "shovel", drop: B.DIRT }),
  [B.SNOW]: bd("Snow Block", [T.SNOW, T.SNOW, T.SNOW], 0.4, { tool: "shovel", drop: B.SNOW }),
  [B.CACTUS]: bd("Cactus", [T.CACTUS_TOP, T.CACTUS_SIDE, T.CACTUS_TOP], 0.4, { drop: B.CACTUS }),
  [B.BEDROCK]: bd("Bedrock", [T.BEDROCK, T.BEDROCK, T.BEDROCK], -1, { drop: 0 }),
  [B.COAL_ORE]: bd("Coal Ore", [T.COAL, T.COAL, T.COAL], 2.2, { tool: "pickaxe", tier: 1, drop: IT.COAL }),
  [B.IRON_ORE]: bd("Iron Ore", [T.IRON, T.IRON, T.IRON], 2.6, { tool: "pickaxe", tier: 2, drop: IT.IRON }),
  [B.GOLD_ORE]: bd("Gold Ore", [T.GOLD, T.GOLD, T.GOLD], 2.8, { tool: "pickaxe", tier: 3, drop: IT.GOLD }),
  [B.DIAMOND_ORE]: bd("Diamond Ore", [T.DIAMOND, T.DIAMOND, T.DIAMOND], 3.0, { tool: "pickaxe", tier: 3, drop: IT.DIAMOND }),
  [B.GRAVEL]: bd("Gravel", [T.GRAVEL, T.GRAVEL, T.GRAVEL], 0.6, { tool: "shovel", drop: B.GRAVEL }),
  [B.TABLE]: bd("Crafting Table", [T.TABLE_TOP, T.TABLE_SIDE, T.PLANKS], 1.8, { tool: "axe", drop: B.TABLE }),
  [B.FURNACE]: bd("Furnace", [T.COBBLE, T.FURNACE_SIDE, T.COBBLE], 2.4, { tool: "pickaxe", tier: 1, drop: B.FURNACE }),
  [B.STONEBRICK]: bd("Stone Bricks", [T.STONEBRICK, T.STONEBRICK, T.STONEBRICK], 1.7, { tool: "pickaxe", tier: 1, drop: B.STONEBRICK }),
  [B.BOOKSHELF]: bd("Bookshelf", [T.PLANKS, T.BOOKSHELF, T.PLANKS], 1.4, { tool: "axe", drop: B.BOOKSHELF }),
  [B.WOOL]: bd("Wool", [T.WOOL, T.WOOL, T.WOOL], 0.7, { drop: B.WOOL }),
  [B.ROSE]: bd("Rose", [T.ROSE, T.ROSE, T.ROSE], 0.05, { solid: false, cross: true, drop: B.ROSE }),
  [B.DANDELION]: bd("Dandelion", [T.DANDELION, T.DANDELION, T.DANDELION], 0.05, { solid: false, cross: true, drop: B.DANDELION }),
  [B.TALLGRASS]: bd("Tall Grass", [T.TALLGRASS, T.TALLGRASS, T.TALLGRASS], 0.02, { solid: false, cross: true, drop: 0 }),
  [B.PUMPKIN]: bd("Pumpkin", [T.PUMPKIN_TOP, T.PUMPKIN_SIDE, T.PUMPKIN_TOP], 1.0, { tool: "axe", drop: B.PUMPKIN }),
  [B.TNT]: bd("TNT", [T.TNT_TOP, T.TNT_SIDE, T.TNT_TOP], 0.1, { drop: B.TNT }),
};

const id = (name: string, icon: string, extra: Partial<ItemDef> = {}): ItemDef => ({ name, icon, ...extra });

export const ITEMS: Record<number, ItemDef> = {
  [IT.STICK]: id("Stick", "stick"),
  [IT.COAL]: id("Coal", "coal"),
  [IT.IRON]: id("Iron Ingot", "ingot_iron"),
  [IT.GOLD]: id("Gold Ingot", "ingot_gold"),
  [IT.DIAMOND]: id("Diamond", "diamond"),
  [IT.APPLE]: id("Apple", "apple", { food: 4 }),
  [IT.PORK]: id("Raw Porkchop", "pork", { food: 6 }),
  [IT.BEEF]: id("Raw Beef", "beef", { food: 8 }),
  [IT.CHICKEN]: id("Raw Chicken", "chicken", { food: 4 }),
  [IT.GUNPOWDER]: id("Gunpowder", "gunpowder"),
  [IT.WSWORD]: id("Wooden Sword", "sword_wood", { tool: { kind: "sword", tier: 0, dmg: 5, speed: 1.5 } }),
  [IT.WPICK]: id("Wooden Pickaxe", "pick_wood", { tool: { kind: "pickaxe", tier: 1, dmg: 3, speed: 4 } }),
  [IT.WAXE]: id("Wooden Axe", "axe_wood", { tool: { kind: "axe", tier: 1, dmg: 4, speed: 4 } }),
  [IT.SSWORD]: id("Stone Sword", "sword_stone", { tool: { kind: "sword", tier: 0, dmg: 6, speed: 1.5 } }),
  [IT.SPICK]: id("Stone Pickaxe", "pick_stone", { tool: { kind: "pickaxe", tier: 2, dmg: 4, speed: 5 } }),
  [IT.SAXE]: id("Stone Axe", "axe_stone", { tool: { kind: "axe", tier: 2, dmg: 5, speed: 5 } }),
  [IT.ISWORD]: id("Iron Sword", "sword_iron", { tool: { kind: "sword", tier: 0, dmg: 8, speed: 1.5 } }),
  [IT.IPICK]: id("Iron Pickaxe", "pick_iron", { tool: { kind: "pickaxe", tier: 3, dmg: 5, speed: 6.5 } }),
  [IT.IAXE]: id("Iron Axe", "axe_iron", { tool: { kind: "axe", tier: 3, dmg: 6, speed: 6.5 } }),
  [IT.DSWORD]: id("Diamond Sword", "sword_diamond", { tool: { kind: "sword", tier: 0, dmg: 10, speed: 1.5 } }),
  [IT.DPICK]: id("Diamond Pickaxe", "pick_diamond", { tool: { kind: "pickaxe", tier: 4, dmg: 6, speed: 8 } }),
  [IT.DAXE]: id("Diamond Axe", "axe_diamond", { tool: { kind: "axe", tier: 4, dmg: 8, speed: 8 } }),
};

export const isBlockId = (n: number) => n > 0 && n < 100;
export const isItemId = (n: number) => n >= 100;

export function nameOf(n: number): string {
  if (isBlockId(n)) return BLOCKS[n]?.name ?? "Block";
  return ITEMS[n]?.name ?? "Item";
}

// tile used when drawing the inventory icon of a block
export const ICON_TILE: Record<number, number> = {
  [B.GRASS]: T.GRASS_SIDE, [B.LOG]: T.LOG_SIDE, [B.TABLE]: T.TABLE_SIDE,
  [B.FURNACE]: T.FURNACE_FRONT, [B.PUMPKIN]: T.PUMPKIN_SIDE,
  [B.SNOWGRASS]: T.SNOW_SIDE, [B.TNT]: T.TNT_SIDE,
};

export const ALL_BLOCKS: number[] = Object.keys(BLOCKS)
  .map(Number)
  .filter((b) => b !== B.WATER && b !== B.TALLGRASS)
  .sort((a, b2) => a - b2);

export const ALL_ITEMS: number[] = Object.keys(ITEMS).map(Number).sort((a, b) => a - b);

export const CREATIVE_LIST: number[] = [...ALL_BLOCKS, ...ALL_ITEMS];

// average colors per tile — used for block-break particles & hand block tint
export const TILE_COLORS: Record<number, string> = {
  [T.GRASS_TOP]: "#7cbd4f", [T.GRASS_SIDE]: "#8a6a42", [T.DIRT]: "#96653f",
  [T.STONE]: "#8f8f8f", [T.COBBLE]: "#7d7d7d", [T.SAND]: "#e7dca6",
  [T.LOG_SIDE]: "#6b5232", [T.LOG_TOP]: "#a8894f", [T.LEAVES]: "#3e7a24",
  [T.PLANKS]: "#b8945f", [T.GLASS]: "#cfe8f5", [T.WATER]: "#3b66c4",
  [T.SNOW_SIDE]: "#e8f0f5", [T.SNOW]: "#f4f8fb", [T.CACTUS_SIDE]: "#4a8f2f",
  [T.CACTUS_TOP]: "#5ca63c", [T.BEDROCK]: "#4a4a4a", [T.COAL]: "#4f4f4f",
  [T.IRON]: "#9b8372", [T.GOLD]: "#b09a45", [T.DIAMOND]: "#5fb5ab",
  [T.GRAVEL]: "#8a7f76", [T.TABLE_TOP]: "#a67c48", [T.TABLE_SIDE]: "#9c7443",
  [T.FURNACE_SIDE]: "#777777", [T.FURNACE_FRONT]: "#6d6d6d", [T.STONEBRICK]: "#9a9a9a",
  [T.BOOKSHELF]: "#8a5f3c", [T.WOOL]: "#e6e6e6", [T.ROSE]: "#c23b3b",
  [T.DANDELION]: "#e3d24a", [T.TALLGRASS]: "#6da84a", [T.PUMPKIN_SIDE]: "#d0741c",
  [T.PUMPKIN_TOP]: "#c46a15", [T.TNT_SIDE]: "#c8402c", [T.TNT_TOP]: "#b83a28",
};
