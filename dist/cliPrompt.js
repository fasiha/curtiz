"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
function cliPrompt(prefix = '> ') {
    return new Promise((resolve, reject) => {
        var stdin = process.stdin, stdout = process.stdout;
        stdin.resume();
        if (prefix) {
            stdout.write(prefix);
        }
        stdin.once('data', (data) => {
            resolve(data.toString().trim());
            stdin.pause();
        });
    });
}
exports.cliPrompt = cliPrompt;
