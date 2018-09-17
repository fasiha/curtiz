"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
// This is a riff off the Clojure function partition-by,
// see http://clojure.github.io/clojure/clojure.core-api.html#clojure.core/partition-by
//
// `partitionBy([ 0, 0, 0, 1, 2, 3, 0, 1, 2, 3, 4, 5, 0, 0, 1, 0, 1, 0 ], x => !x)` =>
// ```
// [ [ 0 ],
//   [ 0 ],
//   [ 0, 1, 2, 3 ],
//   [ 0, 1, 2, 3, 4, 5 ],
//   [ 0 ],
//   [ 0, 1 ],
//   [ 0, 1 ],
//   [ 0 ] ]
// ```
function partitionBy(arr, pred) {
    let ret = arr.length ? [[arr[0]]] : [[]];
    let retidx = 0;
    for (let i = 1; i < arr.length; i++) {
        if (pred(arr[i], i, arr)) {
            ret.push([arr[i]]);
            retidx++;
        }
        else {
            ret[retidx].push(arr[i]);
        }
    }
    return ret;
}
exports.default = partitionBy;
