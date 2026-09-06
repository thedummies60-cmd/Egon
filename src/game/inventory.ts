import type { Stack } from "./blocks";
import { matchCraft } from "./recipes";

export type SlotArea = "main" | "hotbar" | "craft" | "result" | "lib";

export class Inventory {
  slots: (Stack | null)[] = new Array(36).fill(null);
  craft: (Stack | null)[] = new Array(9).fill(null);
  craftSize = 2;
  cursor: Stack | null = null;

  private idx(area: SlotArea, i: number): number {
    if (area === "hotbar") return 27 + i;
    return i; // main uses 0..26
  }

  getStack(area: SlotArea, i: number): Stack | null {
    if (area === "craft") return this.craft[i];
    if (area === "main" || area === "hotbar") return this.slots[this.idx(area, i)];
    return null;
  }

  private setStack(area: SlotArea, i: number, s: Stack | null) {
    if (area === "craft") this.craft[i] = s;
    else if (area === "main" || area === "hotbar") this.slots[this.idx(area, i)] = s;
  }

  resultStack(): Stack | null {
    const r = matchCraft(this.craft, this.craftSize);
    return r ? { id: r.out.id, count: r.out.count } : null;
  }

  click(area: SlotArea, i: number, btn: number, libId = 0) {
    if (area === "lib") {
      this.cursor = btn === 2 && this.cursor ? null : { id: libId, count: 64 };
      return;
    }

    if (area === "result") {
      const r = this.resultStack();
      if (!r) return;
      const c = this.cursor;
      if (c && (c.id !== r.id || c.count + r.count > 64)) return;
      const n = this.craftSize * this.craftSize;
      for (let k = 0; k < n; k++) {
        const s = this.craft[k];
        if (s) {
          s.count -= 1;
          if (s.count <= 0) this.craft[k] = null;
        }
      }
      this.cursor = c ? { id: c.id, count: c.count + r.count } : r;
      return;
    }

    const s = this.getStack(area, i);
    const c = this.cursor;

    if (btn === 2) {
      if (!c) {
        if (s) {
          const take = Math.ceil(s.count / 2);
          this.cursor = { id: s.id, count: take };
          s.count -= take;
          if (s.count <= 0) this.setStack(area, i, null);
        }
      } else if (!s) {
        this.setStack(area, i, { id: c.id, count: 1 });
        c.count -= 1;
        if (c.count <= 0) this.cursor = null;
      } else if (s.id === c.id && s.count < 64) {
        s.count += 1;
        c.count -= 1;
        if (c.count <= 0) this.cursor = null;
      }
      return;
    }

    // left button
    if (!c) {
      if (s) {
        this.cursor = s;
        this.setStack(area, i, null);
      }
    } else if (!s) {
      this.setStack(area, i, c);
      this.cursor = null;
    } else if (s.id === c.id) {
      const space = 64 - s.count;
      const mv = Math.min(space, c.count);
      s.count += mv;
      c.count -= mv;
      if (c.count <= 0) this.cursor = null;
    } else {
      this.setStack(area, i, c);
      this.cursor = s;
    }
  }

  give(id: number, count: number): boolean {
    for (let i = 0; i < 36 && count > 0; i++) {
      const s = this.slots[i];
      if (s && s.id === id && s.count < 64) {
        const mv = Math.min(64 - s.count, count);
        s.count += mv;
        count -= mv;
      }
    }
    for (let i = 0; i < 36 && count > 0; i++) {
      if (!this.slots[i]) {
        const mv = Math.min(64, count);
        this.slots[i] = { id, count: mv };
        count -= mv;
      }
    }
    return count === 0;
  }

  selectedStack(): Stack | null {
    return this.slots[27 + this.hotbarIndex];
  }

  hotbarIndex = 0;

  serialize() {
    return { slots: this.slots, craft: this.craft, hotbarIndex: this.hotbarIndex };
  }

  restore(data: { slots: (Stack | null)[]; craft: (Stack | null)[]; hotbarIndex: number }) {
    if (data?.slots?.length === 36) this.slots = data.slots;
    if (data?.craft?.length === 9) this.craft = data.craft;
    if (typeof data?.hotbarIndex === "number") this.hotbarIndex = data.hotbarIndex;
  }
}
