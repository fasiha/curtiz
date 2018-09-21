export function histogram<T, U>(arr: T[], f: (x: T) => U): Map<U, T[]> {
  let map: Map<U, T[]> = new Map([]);
  for (let x of arr) {
    let y = f(x);
    if (map.has(y)) {
      (map.get(y) || []).push(x);
    } else {
      map.set(y, [x]);
    }
  }
  return map;
}

if (require.main === module) {
  let v = Array.from(Array(15), _ => Math.random());
  console.log(v);
  console.log(histogram(v, x => Math.floor(x * 10)));
}