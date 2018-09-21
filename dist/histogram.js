"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
function histogram(arr, f) {
    let map = new Map([]);
    for (let x of arr) {
        let y = f(x);
        if (map.has(y)) {
            (map.get(y) || []).push(x);
        }
        else {
            map.set(y, [x]);
        }
    }
    return map;
}
exports.histogram = histogram;
if (require.main === module) {
    let v = Array.from(Array(15), _ => Math.random());
    console.log(v);
    console.log(histogram(v, x => Math.floor(x * 10)));
}
