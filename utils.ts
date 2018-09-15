export function* enumerate<T>(v: T[]): IterableIterator<[number, T]> {
  for (let n = 0; n < v.length; n++) { yield [n, v[n]]; }
}

export function* zip(...arrs: any[][]) {
  const stop = Math.min(...arrs.map(v => v.length));
  for (let i = 0; i < stop; i++) { yield arrs.map(v => v[i]); }
}

export function argmin<T>(arr: T[], map: (element: T) => number): [T|undefined, number, number] {
  let smallestElement: T|undefined = undefined;
  let smallestMapped = Infinity;
  let smallestIdx = -1;
  for (let i = 0; i < arr.length; i++) {
    let mapped = map(arr[i])
    if (mapped < smallestMapped) {
      smallestElement = arr[i]
      smallestMapped = mapped;
      smallestIdx = i;
    }
  }
  return [smallestElement, smallestMapped, smallestIdx];
}

export function fillHoles<T>(a: T[], b: T[], predicate: (a: T) => boolean = (o => !o)) {
  let bidx = 0;
  for (let aidx in a) {
    if (predicate(a[aidx])) { a[aidx] = b[bidx++]; }
  }
  return a;
}
