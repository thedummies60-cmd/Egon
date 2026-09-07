# Egon

A 3D Minecraft-style voxel sandbox that runs in the browser.

Open `index.html` and play. No build step, no `npm install`, no dependencies —
just HTML, CSS and JavaScript driving a hand-written WebGL renderer.

Every texture, model and sound in the game is generated in code at load time,
so the repository contains no image or audio assets at all.

## Play it

Three ways, easiest first.

**1. One file, no server.** Download [`egon.html`](egon.html) and open it. It is
the whole game inlined into a single 426 KB HTML file with no external
requests, so it works offline and straight off `file://`.

**2. Clone and serve.**

```bash
git clone https://github.com/thedummies60-cmd/Egon.git
cd Egon
python3 -m http.server 8000     # or: npx serve .
```

Then open <http://localhost:8000>. Opening `index.html` directly from disk also
works — the game uses classic scripts rather than ES modules precisely so
`file://` is fine.

**3. Rebuild the single file** after changing anything under `js/` or `css/`:

```bash
node build.js                   # -> egon.html
node build.js out.html --body   # body-only, for hosts with their own skeleton
```

### Mouse look

The game grabs the pointer so the mouse turns the camera. Where that is not
allowed — inside a sandboxed iframe, for instance — it falls back to
drag-to-look: hold the button and move to turn, hold still to keep mining.

## Controls

| Key | Action |
| --- | --- |
| `W` `A` `S` `D` | Move |
| Mouse | Look |
| Left click | Mine / attack |
| Right click | Place block, use item, open container |
| Middle click | Pick block (creative) |
| `Space` | Jump — double-tap to fly in creative |
| `Shift` | Sneak (won't walk off ledges) |
| `Ctrl` | Sprint |
| `1`–`9`, wheel | Hotbar slot |
| `E` | Inventory + 2×2 crafting |
| `Q` | Drop item (`Shift+Q` for the stack) |
| `F3` | Debug overlay |
| `F5` | Cycle camera perspective |
| `Esc` | Pause |

## What's in it

**World.** Infinite terrain streamed in chunks around the player, generated
from layered Perlin noise: continentalness picks oceans and inland height,
erosion drives mountain amplitude, and temperature/humidity select from 33
biomes — plains, forests, taiga, jungle, desert, savanna, badlands, swamp,
snowy plains, ice spikes, mushroom fields, peaks and more. Caves are carved by
intersecting ridged 3D noise plus larger cavern fields; ore veins, trees,
flowers, cacti, sugar cane, boulders and lakes are placed on top. Worlds are
seeded by name or number and reproduce exactly.

**Rendering.** A custom WebGL renderer with per-chunk meshes, face culling,
per-vertex ambient occlusion and smooth lighting, frustum culling, a flood-fill
sky/block light engine that spans chunk borders, biome-blended grass and
foliage tint, animated water and foliage, a day/night cycle with sun, moon,
stars and drifting clouds, distance fog, weather, and particles.

**Survival.** Health, hunger, saturation, armour, XP levels, fall damage,
drowning, burning, mob combat and drops, tool tiers that gate what a block will
drop, tool durability, dropped-item pickup and a death/respawn cycle.

**Creative.** Flight, unlimited blocks, a searchable palette of every block and
item organised into tabs, and instant mining.

**Crafting.** Shaped and shapeless recipes matched against a 2×2 or 3×3 grid,
furnaces with fuel and smelting progress, and chests. About 130 blocks and 99
items including the full tool, weapon and armour trees. Containers keep their
contents across a save, and a furnace left burning is still burning when you
come back.

**Living world.** Random ticks grow saplings into full trees, spread grass onto
bare dirt and let it die back under cover — so chopping a tree, replanting the
sapling it dropped and coming back to a grown one is a complete loop.

**Mobs.** 17 creatures built from animated box rigs — pig, cow, mooshroom,
sheep, chicken, rabbit, wolf, goat, horse, villager, zombie, skeleton, creeper,
spider, enderman, slime and the player model. They wander, look at you, flee
when hurt, chase and attack, burn in daylight, shoot arrows, and explode.

## How it is put together

```
index.html          script order and the DOM for every screen
css/style.css       Minecraft-flavoured GUI: bevelled panels, chunky buttons
js/
  lib/              vec3/mat4 maths, seeded PRNG, Perlin noise
  engine/
    paint.js        pixel-art toolkit every texture is drawn with
    blocktex.js     ~200 procedural block textures
    mobart.js       box models and skins for every creature
    atlas.js        packs textures into GPU atlases + a UI icon sheet
    gl.js           WebGL1/2 wrapper
    shaders.js      terrain / entity / sky / line programs
    renderer.js     passes, culling, chunk VBOs, dynamic batching
    input.js        pointer lock, key bindings
  world/
    blocks.js       block registry
    items.js        item registry + parametric item art
    biomes.js       biome table
    worldgen.js     terrain, caves, ores, decoration
    world.js        chunk storage + light engine
    mesher.js       voxels to geometry
  game/
    physics.js      swept AABB collision, DDA voxel raycast
    player.js       movement, camera, survival stats
    entities.js     mobs, drops, projectiles, particles
    inventory.js    stacks, slots, crafting grid
    recipes.js      crafting, smelting, fuel
    audio.js        WebAudio sound synthesis
    game.js         chunk streaming, interaction, spawning, saving
    gamerender.js   per-frame draw order, first-person hand
  ui/               pixel font and every screen
  main.js           bootstrap and frame loop
```

Worlds save to `localStorage`. Only the blocks you changed and the contents of
your containers are stored — the rest is regenerated from the seed — so saves
stay small for an infinite world.

## Performance

The default render distance is 8 chunks. If the game feels slow, lower it in
**Options** (3–16). Press `F3` to see frame time, chunk and draw-call counts.

## Notes

This is a fan-made project that imitates the look and feel of Minecraft. It is
not affiliated with, endorsed by, or connected to Mojang or Microsoft, and
shares no code or assets with the original game.
