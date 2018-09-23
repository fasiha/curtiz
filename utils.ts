export function hasKanji(s: string): boolean {
  const k = /[⺀-⺙⺛-⻳⼀-⿕々〇〡-〩〸-〻㐀-䶵一-鿕豈-舘並-龎]/;
  return k.test(s);
}

export function* enumerate<T>(v: T[]|IterableIterator<T>): IterableIterator<[number, T]> {
  let n = 0;
  for (let x of v) { yield [n++, x]; }
}

export function* zip(...arrs: any[][]) {
  const stop = Math.min(...arrs.map(v => v.length));
  for (let i = 0; i < stop; i++) { yield arrs.map(v => v[i]); }
}

export function argmin<T>(arr: T[]|IterableIterator<T>, map: (element: T) => number,
                          status?: {min?: T, argmin?: number, minmapped?: number}): number {
  let smallestElement: T|undefined = undefined;
  let smallestMapped = Infinity;
  let smallestIdx = -1;
  for (const [i, x] of enumerate(arr)) {
    const mapped = map(x)
    if (mapped < smallestMapped) {
      smallestElement = x;
      smallestMapped = mapped;
      smallestIdx = i;
    }
  }
  if (status) {
    status.min = smallestElement;
    status.argmin = smallestIdx;
    status.minmapped = smallestMapped;
  }
  return smallestIdx;
}

export function fillHoles<T>(a: T[], b: T[], predicate: (a: T) => boolean = (o => !o)) {
  let bidx = 0;
  for (let aidx in a) {
    if (predicate(a[aidx])) { a[aidx] = b[bidx++]; }
  }
  return a;
}

// From
// https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Set#Implementing_basic_set_operations
export function isSuperset<T>(set: Set<T>, subset: Set<T>) {
  for (var elem of subset) {
    if (!set.has(elem)) { return false; }
  }
  return true;
}

export function union<T>(setA: Set<T>, setB: Set<T>) {
  var _union = new Set(setA);
  for (var elem of setB) { _union.add(elem); }
  return _union;
}

export function intersection<T>(setA: Set<T>, setB: Set<T>) {
  var _intersection = new Set();
  for (var elem of setB) {
    if (setA.has(elem)) { _intersection.add(elem); }
  }
  return _intersection;
}

export function difference<T>(setA: Set<T>, setB: Set<T>) {
  var _difference = new Set(setA);
  for (var elem of setB) { _difference.delete(elem); }
  return _difference;
}