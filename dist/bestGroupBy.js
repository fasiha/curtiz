"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * Like "groupBy", but only track the "best" group.
 * @param arr Array of values
 * @param grouper Mapper from elements of array to some group. Should be pure (it'll be called on first element twice).
 * @param compare Compare two groups: if `compare(x, y) > 0`, then `x > y`, and similarly `=` and `<`.
 * @return array containing the best group as first element, then the array of entries in that group.
 *
 * I only care about `compare`'s output's sign/zero, so it doesn't need to be a true distance.
 */
function bestGroupBy(arr, grouper, compare) {
    let bestGroup = grouper(arr[0]);
    let bestTs = [];
    for (const x of arr) {
        const groupx = grouper(x);
        const compared = compare(groupx, bestGroup);
        if (compared === 0) {
            bestTs.push(x);
        }
        else if (compared > 0) {
            bestTs = [x];
            bestGroup = groupx;
        }
    }
    return [bestGroup, bestTs];
}
exports.bestGroupBy = bestGroupBy;
