"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var ebisujs = require('ebisu-js');
function predictRecall(model, elapsed) {
    if (model.length !== 3) {
        throw new Error('model must be length 3');
    }
    return ebisujs.predictRecall(model, elapsed);
}
function updateRecall(model, result, elapsed) {
    if (model.length !== 3) {
        throw new Error('model must be length 3');
    }
    return ebisujs.updateRecall(model, result, elapsed);
}
class Ebisu {
    constructor(model, lastDate, version = 1) {
        if (model.length !== 3) {
            throw new Error('model must be length 3');
        }
        if (!(lastDate instanceof Date)) {
            throw new Error('lastDate must be instanceof Date');
        }
        if (version !== 1) {
            throw new Error('unknown Ebisu version');
        }
        this.model = model.slice();
        this.lastDate = lastDate;
        this.version = version;
    }
    static elapsedHours(prev, curr) {
        return ((curr ? curr.valueOf() : Date.now()) - prev.valueOf()) / 36e5;
        // 36e5 milliseconds per hour
    }
    predict(d) { return predictRecall(this.model, Ebisu.elapsedHours(this.lastDate, d)); }
    update(result, d) {
        // if (d && !(d instanceof Date)) { throw new Error('d must be instanceof Date'); }
        this.model = updateRecall(this.model, result, Ebisu.elapsedHours(this.lastDate, d));
        this.lastDate = d || new Date();
    }
    passiveUpdate(d) { this.lastDate = d || new Date(); }
    modelToString() { return this.model.map(n => n.toExponential(3)).join(Ebisu.fieldSeparator); }
    toStrings() { return [this.lastDate.toISOString(), this.modelToString()]; }
    toString() { return `${this.lastDate.toISOString()}${Ebisu.fieldSeparator} ${this.modelToString()}`; }
    static fromString(s) {
        let chunks = s.split(Ebisu.fieldSeparator);
        if (chunks.length !== 4) {
            console.error(s, chunks);
            throw new Error('expected four fields: date and three numbers');
        }
        let d = new Date(chunks[0]);
        let model = chunks.slice(1).map(parseFloat);
        return new Ebisu(model, d);
    }
    static createDefault(expectedHalflife = 1, betaAB = 3, d) {
        return new Ebisu([betaAB, betaAB, expectedHalflife], d || new Date());
    }
}
Ebisu.fieldSeparator = ',';
exports.Ebisu = Ebisu;
