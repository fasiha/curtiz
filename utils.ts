export function hasKanji(s: string): boolean {
  const k = /[⺀-⺙⺛-⻳⼀-⿕々〇〡-〩〸-〻㐀-䶵一-鿕豈-舘並-龎]/;
  return k.test(s);
}

/**
 * Generates `[index, value]` 2-tuples, so you can `for (let [index, value] of enumerate(v) {...})`.
 * @param v array or iterable iterator to enumerate
 * @param n starting number (defaults to 0)
 *
 * Hat tip: https://docs.python.org/3/library/functions.html#enumerate
 */
export function* enumerate<T>(v: T[]|IterableIterator<T>, n: number = 0): IterableIterator<[number, T]> {
  for (let x of v) { yield [n++, x]; }
}

export function* zip(...arrs: any[][]) {
  const stop = Math.min(...arrs.map(v => v.length));
  for (let i = 0; i < stop; i++) { yield arrs.map(v => v[i]); }
}

/**
 * Apply a predicate to an array from its end, returning the continguously-passing sub-array.
 * @param arr Array to filter from the right (end)
 * @param predicate Function to apply to each element, defaults to boolean check
 *
 * See alo `filterLeft`.
 */
export function filterRight<T>(arr: T[], predicate: (element: T) => boolean = (element) => !!element): T[] {
  let ret: T[] = [];
  if (arr.length === 0) { return ret; }
  for (let idx = arr.length - 1; idx >= 0; idx--) {
    if (predicate(arr[idx])) {
      ret.push(arr[idx]);
    } else {
      break;
    }
  }
  return ret.reverse();
}
/**
 * Get the leading elements of an array that pass a predicate function.
 * @param arr Array to filter from the beginning (left)
 * @param predicate Function to apply to each element, defaults to boolean check
 *
 * See also `filterRight`.
 */
export function filterLeft<T>(arr: T[], predicate: (element: T) => boolean = (element) => !!element): T[] {
  let ret: T[] = [];
  for (let x of arr) {
    if (predicate(x)) {
      ret.push(x);
    } else {
      break;
    }
  }
  return ret;
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

export function setEq<T>(a: Set<T>, b: Set<T>): boolean {
  if (a.size !== b.size) { return false; }
  return isSuperset(a, b);
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