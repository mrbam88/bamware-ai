// Run a CLI as a subprocess with a hard timeout. Returns { code, output, timedOut }.
// Never passes the prompt through a shell; argv only. Secrets stay in env, never argv.
import { spawn } from 'node:child_process';

export function run(argv, { cwd, env = process.env, timeoutMs = 10 * 60 * 1000, onChunk } = {}) {
  return new Promise((resolve) => {
    const [cmd, ...args] = argv;
    const child = spawn(cmd, args, { cwd, env, stdio: ['ignore', 'pipe', 'pipe'] });
    let output = '';
    let timedOut = false;
    const timer = setTimeout(() => { timedOut = true; child.kill('SIGTERM'); setTimeout(() => child.kill('SIGKILL'), 5000); }, timeoutMs);
    const take = (buf) => { const s = buf.toString(); output += s; if (onChunk) onChunk(s); };
    child.stdout.on('data', take);
    child.stderr.on('data', take);
    child.on('error', (err) => { clearTimeout(timer); resolve({ code: 127, output: `${output}\n${err.message}`, timedOut }); });
    child.on('close', (code) => { clearTimeout(timer); resolve({ code: code ?? 1, output, timedOut }); });
  });
}
