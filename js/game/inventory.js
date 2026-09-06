/* ============================================================
 * inventory.js - slots, stacks and the crafting grids.
 * Layout: 0-8 hotbar, 9-35 main, 36-39 armour, 40-48 crafting,
 * 49 crafting result, 50 cursor (the stack on the mouse).
 * ============================================================ */
(function () {
  'use strict';
  const MC = window.MC || (window.MC = {});

  const HOTBAR = 0, MAIN = 9, ARMOR = 36, CRAFT = 40, RESULT = 49, CURSOR = 50;
  const SIZE = 51;

  function stack(name, count, dur) {
    const t = MC.thing(name);
    if (!t) return null;
    return { name: name, count: count, dur: dur === undefined ? (t.durability || 0) : dur };
  }
  MC.stack = stack;

  function Inventory() {
    this.slots = new Array(SIZE).fill(null);
    this.craftSize = 2;              // 2x2 unless a crafting table is open
  }

  Inventory.HOTBAR = HOTBAR; Inventory.MAIN = MAIN; Inventory.ARMOR = ARMOR;
  Inventory.CRAFT = CRAFT; Inventory.RESULT = RESULT; Inventory.CURSOR = CURSOR;
  Inventory.SIZE = SIZE;

  Inventory.prototype.get = function (i) { return this.slots[i]; };
  Inventory.prototype.set = function (i, s) { this.slots[i] = s; };

  Inventory.prototype.maxStack = function (name) {
    const t = MC.thing(name);
    return t ? t.maxStack : 64;
  };

  /* Add items, hotbar first then the main grid. Returns what didn't fit. */
  Inventory.prototype.add = function (name, count) {
    const max = this.maxStack(name);
    const order = [];
    for (let i = HOTBAR; i < HOTBAR + 9; i++) order.push(i);
    for (let i = MAIN; i < MAIN + 27; i++) order.push(i);

    // top up existing stacks
    if (max > 1) {
      for (let k = 0; k < order.length && count > 0; k++) {
        const s = this.slots[order[k]];
        if (s && s.name === name && s.count < max) {
          const n = Math.min(max - s.count, count);
          s.count += n; count -= n;
        }
      }
    }
    // then fill empties
    for (let k = 0; k < order.length && count > 0; k++) {
      if (!this.slots[order[k]]) {
        const n = Math.min(max, count);
        this.slots[order[k]] = stack(name, n);
        count -= n;
      }
    }
    return count;
  };

  Inventory.prototype.has = function (name, count) {
    let n = 0;
    for (let i = 0; i < ARMOR; i++) {
      const s = this.slots[i];
      if (s && s.name === name) n += s.count;
      if (n >= count) return true;
    }
    return false;
  };

  Inventory.prototype.remove = function (name, count) {
    for (let i = 0; i < ARMOR && count > 0; i++) {
      const s = this.slots[i];
      if (!s || s.name !== name) continue;
      const n = Math.min(s.count, count);
      s.count -= n; count -= n;
      if (s.count <= 0) this.slots[i] = null;
    }
    return count === 0;
  };

  Inventory.prototype.consumeSelected = function (sel, n) {
    const s = this.slots[sel];
    if (!s) return false;
    s.count -= (n || 1);
    if (s.count <= 0) this.slots[sel] = null;
    return true;
  };

  /* Wear down a tool; returns true if it broke. */
  Inventory.prototype.damageTool = function (slot, amount) {
    const s = this.slots[slot];
    if (!s) return false;
    const t = MC.thing(s.name);
    if (!t || !t.durability) return false;
    s.dur -= amount;
    if (s.dur <= 0) { this.slots[slot] = null; return true; }
    return false;
  };

  Inventory.prototype.firstEmpty = function () {
    for (let i = HOTBAR; i < HOTBAR + 9; i++) if (!this.slots[i]) return i;
    for (let i = MAIN; i < MAIN + 27; i++) if (!this.slots[i]) return i;
    return -1;
  };

  /* Creative middle-click: put this block in hand, replacing nothing. */
  Inventory.prototype.pickBlock = function (name, sel) {
    for (let i = HOTBAR; i < HOTBAR + 9; i++) {
      if (this.slots[i] && this.slots[i].name === name) return i;
    }
    for (let i = MAIN; i < MAIN + 27; i++) {
      if (this.slots[i] && this.slots[i].name === name) {
        const t = this.slots[sel];
        this.slots[sel] = this.slots[i];
        this.slots[i] = t;
        return sel;
      }
    }
    const empty = this.slots[sel] ? -1 : sel;
    const target = empty >= 0 ? empty : sel;
    this.slots[target] = stack(name, 1);
    return target;
  };

  /* ---------------- mouse interactions ---------------- */

  // left click: pick up / put down / merge
  Inventory.prototype.clickSlot = function (i, readOnlyResult) {
    const cur = this.slots[CURSOR];
    const s = this.slots[i];
    if (readOnlyResult) {
      // crafting output: only lets you take
      if (!s) return false;
      if (!cur) { this.slots[CURSOR] = s; this.slots[i] = null; return true; }
      if (cur.name === s.name && cur.count + s.count <= this.maxStack(cur.name)) {
        cur.count += s.count; this.slots[i] = null; return true;
      }
      return false;
    }
    if (!cur) { this.slots[CURSOR] = s; this.slots[i] = null; return true; }
    if (!s) { this.slots[i] = cur; this.slots[CURSOR] = null; return true; }
    if (s.name === cur.name) {
      const max = this.maxStack(s.name);
      const n = Math.min(max - s.count, cur.count);
      if (n > 0) {
        s.count += n; cur.count -= n;
        if (cur.count <= 0) this.slots[CURSOR] = null;
        return true;
      }
    }
    this.slots[i] = cur; this.slots[CURSOR] = s;
    return true;
  };

  // right click: split a stack or place one item
  Inventory.prototype.rightClickSlot = function (i) {
    const cur = this.slots[CURSOR];
    const s = this.slots[i];
    if (!cur) {
      if (!s) return false;
      const half = Math.ceil(s.count / 2);
      this.slots[CURSOR] = stack(s.name, half, s.dur);
      s.count -= half;
      if (s.count <= 0) this.slots[i] = null;
      return true;
    }
    if (!s) {
      this.slots[i] = stack(cur.name, 1, cur.dur);
      cur.count--;
      if (cur.count <= 0) this.slots[CURSOR] = null;
      return true;
    }
    if (s.name === cur.name && s.count < this.maxStack(s.name)) {
      s.count++; cur.count--;
      if (cur.count <= 0) this.slots[CURSOR] = null;
      return true;
    }
    return false;
  };

  // shift click: hotbar <-> main, or into the inventory from crafting/armour
  Inventory.prototype.quickMove = function (i) {
    const s = this.slots[i];
    if (!s) return false;
    let from, to;
    if (i >= HOTBAR && i < HOTBAR + 9) { from = HOTBAR; to = [MAIN, MAIN + 27]; }
    else if (i >= MAIN && i < MAIN + 27) { from = MAIN; to = [HOTBAR, HOTBAR + 9]; }
    else { to = [HOTBAR, MAIN + 27]; }

    const max = this.maxStack(s.name);
    for (let k = to[0]; k < to[1] && s.count > 0; k++) {
      const d = this.slots[k];
      if (d && d.name === s.name && d.count < max) {
        const n = Math.min(max - d.count, s.count);
        d.count += n; s.count -= n;
      }
    }
    for (let k = to[0]; k < to[1] && s.count > 0; k++) {
      if (!this.slots[k]) { this.slots[k] = stack(s.name, s.count, s.dur); s.count = 0; }
    }
    if (s.count <= 0) this.slots[i] = null;
    return true;
  };

  /* ---------------- crafting ---------------- */

  Inventory.prototype.craftGrid = function () {
    const n = this.craftSize;
    const g = [];
    for (let y = 0; y < n; y++) {
      for (let x = 0; x < n; x++) {
        const s = this.slots[CRAFT + y * 3 + x];
        g.push(s ? s.name : null);
      }
    }
    return { grid: g, size: n };
  };

  Inventory.prototype.updateCraftResult = function () {
    const g = this.craftGrid();
    const r = MC.recipes.match(g.grid, g.size);
    this.slots[RESULT] = r ? stack(r.name, r.count) : null;
    this._pendingRecipe = r;
  };

  Inventory.prototype.consumeCraft = function (times) {
    times = times || 1;
    for (let t = 0; t < times; t++) {
      for (let y = 0; y < this.craftSize; y++) {
        for (let x = 0; x < this.craftSize; x++) {
          const i = CRAFT + y * 3 + x;
          const s = this.slots[i];
          if (!s) continue;
          // buckets and bowls survive being used in a recipe
          if (s.name === 'water_bucket' || s.name === 'lava_bucket' || s.name === 'milk_bucket') {
            this.slots[i] = stack('bucket', 1);
            continue;
          }
          s.count--;
          if (s.count <= 0) this.slots[i] = null;
        }
      }
    }
    this.updateCraftResult();
  };

  // how many times the current recipe can be repeated with what's in the grid
  Inventory.prototype.maxCrafts = function () {
    let m = Infinity;
    for (let y = 0; y < this.craftSize; y++) {
      for (let x = 0; x < this.craftSize; x++) {
        const s = this.slots[CRAFT + y * 3 + x];
        if (s) m = Math.min(m, s.count);
      }
    }
    return m === Infinity ? 0 : m;
  };

  // drop everything in the crafting grid back into the inventory
  Inventory.prototype.clearCraft = function () {
    const out = [];
    for (let i = CRAFT; i < CRAFT + 9; i++) {
      const s = this.slots[i];
      if (!s) continue;
      const left = this.add(s.name, s.count);
      if (left > 0) out.push({ name: s.name, count: left });
      this.slots[i] = null;
    }
    this.slots[RESULT] = null;
    const cur = this.slots[CURSOR];
    if (cur) {
      const left = this.add(cur.name, cur.count);
      if (left > 0) out.push({ name: cur.name, count: left });
      this.slots[CURSOR] = null;
    }
    return out;
  };

  Inventory.prototype.armorPoints = function () {
    let n = 0;
    for (let i = ARMOR; i < ARMOR + 4; i++) {
      const s = this.slots[i];
      if (!s) continue;
      const t = MC.thing(s.name);
      if (t && t.armor) n += t.armor.defense;
    }
    return n;
  };

  Inventory.prototype.serialize = function () {
    return this.slots.map(function (s) { return s ? [s.name, s.count, s.dur] : 0; });
  };
  Inventory.prototype.load = function (data) {
    if (!data) return;
    for (let i = 0; i < Math.min(data.length, SIZE); i++) {
      const d = data[i];
      this.slots[i] = d ? stack(d[0], d[1], d[2]) : null;
    }
  };

  MC.Inventory = Inventory;
})();
