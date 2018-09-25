var ebisujs = require('ebisu-js');
function predictRecall(model: number[], elapsed: number): number {
  if (model.length !== 3) { throw new Error('model must be length 3'); }
  return ebisujs.predictRecall(model, elapsed);
}
function updateRecall(model: number[], result: boolean, elapsed: number) {
  if (model.length !== 3) { throw new Error('model must be length 3'); }
  return ebisujs.updateRecall(model, result, elapsed);
}

export class Ebisu {
  model: number[];
  lastDate: Date;
  version: number;
  constructor(model: number[], lastDate: Date, version = 1) {
    if (model.length !== 3) { throw new Error('model must be length 3'); }
    if (!(lastDate instanceof Date)) { throw new Error('lastDate must be instanceof Date'); }
    if (version !== 1) { throw new Error('unknown Ebisu version'); }
    this.model = model.slice();
    this.lastDate = lastDate;
    this.version = version;
  }
  static elapsedHours(prev: Date, curr?: Date) {
    return ((curr ? curr.valueOf() : Date.now()) - prev.valueOf()) / 36e5;
    // 36e5 milliseconds per hour
  }
  predict(d?: Date) { return predictRecall(this.model, Ebisu.elapsedHours(this.lastDate, d)); }
  update(result: boolean, d?: Date) {
    // if (d && !(d instanceof Date)) { throw new Error('d must be instanceof Date'); }
    this.model = updateRecall(this.model, result, Ebisu.elapsedHours(this.lastDate, d));
    this.lastDate = d || new Date();
  }
  passiveUpdate(d?: Date) { this.lastDate = d || new Date(); }
  static fieldSeparator: string = ',';
  modelToString(): string { return this.model.map(n => n.toExponential(3)).join(Ebisu.fieldSeparator); }
  toStrings(): string[] { return [this.lastDate.toISOString(), this.modelToString()]; }
  toString(): string { return `${this.lastDate.toISOString()}; ${this.modelToString}`; }
  static fromString(s: string): Ebisu {
    let chunks = s.split(Ebisu.fieldSeparator);
    if (chunks.length !== 4) {
      console.error(s, chunks);
      throw new Error('expected four fields: date and three numbers')
    }
    let d = new Date(chunks[0]);
    let model = chunks.slice(1).map(parseFloat);
    return new Ebisu(model, d);
  }
  static createDefault(expectedHalflife: number = 1, betaAB: number = 3, d?: Date): Ebisu {
    return new Ebisu([betaAB, betaAB, expectedHalflife], d || new Date());
  }
}