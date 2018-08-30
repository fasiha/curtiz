import {cliPrompt} from './cliPrompt';
export async function fill(interlude: (s: string) => boolean): Promise<void> {
  while (true) {
    let input = await cliPrompt('');
    if (interlude(input)) { return; }
  }
}