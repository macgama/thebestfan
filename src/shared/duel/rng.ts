/**
 * PRNG déterministe. Le duel entier est rejouable à partir de (seed + intents),
 * ce qui permet de rejouer une partie depuis la base en cas de litige ou de bug.
 */
export class Rng {
  private s: number;

  constructor(seed: string) {
    let h = 1779033703 ^ seed.length;
    for (let i = 0; i < seed.length; i++) {
      h = Math.imul(h ^ seed.charCodeAt(i), 3432918353);
      h = (h << 13) | (h >>> 19);
    }
    this.s = h >>> 0;
  }

  /** État interne, à persister avec le duel pour reprendre exactement au même point. */
  save(): number {
    return this.s;
  }

  load(s: number): void {
    this.s = s >>> 0;
  }

  next(): number {
    this.s = Math.imul(this.s ^ (this.s >>> 16), 2246822507);
    this.s = Math.imul(this.s ^ (this.s >>> 13), 3266489909);
    this.s ^= this.s >>> 16;
    return (this.s >>> 0) / 4294967296;
  }

  int(max: number): number {
    return Math.floor(this.next() * max);
  }

  pick<T>(arr: readonly T[]): T {
    return arr[this.int(arr.length)];
  }

  /** Fisher-Yates en place. */
  shuffle<T>(arr: T[]): T[] {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = this.int(i + 1);
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }
}
