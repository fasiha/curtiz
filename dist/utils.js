"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
function* enumerate(v) {
    for (let n = 0; n < v.length; n++) {
        yield [n, v[n]];
    }
}
exports.enumerate = enumerate;
function* zip(...arrs) {
    const stop = Math.min(...arrs.map(v => v.length));
    for (let i = 0; i < stop; i++) {
        yield arrs.map(v => v[i]);
    }
}
exports.zip = zip;
function argmin(arr, map) {
    let smallestElement = undefined;
    let smallestMapped = Infinity;
    let smallestIdx = -1;
    for (let i = 0; i < arr.length; i++) {
        let mapped = map(arr[i]);
        if (mapped < smallestMapped) {
            smallestElement = arr[i];
            smallestMapped = mapped;
            smallestIdx = i;
        }
    }
    return [smallestElement, smallestMapped, smallestIdx];
}
exports.argmin = argmin;
function fillHoles(a, b, predicate = (o => !o)) {
    let bidx = 0;
    for (let aidx in a) {
        if (predicate(a[aidx])) {
            a[aidx] = b[bidx++];
        }
    }
    return a;
}
exports.fillHoles = fillHoles;
