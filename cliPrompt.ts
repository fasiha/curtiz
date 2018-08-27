export function cliPrompt(): Promise<string> {
  return new Promise((resolve, reject) => {
    var stdin = process.stdin, stdout = process.stdout;
    stdin.resume();
    stdout.write('> ');
    stdin.once('data', (data: Buffer) => {
      resolve(data.toString().trim());
      stdin.pause();
    });
  });
}
