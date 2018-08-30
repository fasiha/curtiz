export function cliPrompt(prefix = '> '): Promise<string> {
  return new Promise((resolve, reject) => {
    var stdin = process.stdin, stdout = process.stdout;
    stdin.resume();
    if (prefix) { stdout.write(prefix); }
    stdin.once('data', (data: Buffer) => {
      resolve(data.toString().trim());
      stdin.pause();
    });
  });
}
