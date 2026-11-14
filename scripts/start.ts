import { spawn } from 'node:child_process'

/**
 * Runs the local API and the Vite dev server together; Ctrl-C stops both.
 * Extra arguments go to Vite, e.g. `--host` to open the app to the local network.
 * The API itself stays on 127.0.0.1: other devices reach it through Vite's proxy.
 */
const children = [
  spawn('node', ['server/main.ts'], { stdio: 'inherit' }),
  spawn('npx', ['vite', ...process.argv.slice(2)], { stdio: 'inherit' }),
]

const stop = () => children.forEach((c) => c.kill())
process.on('SIGINT', stop)
process.on('SIGTERM', stop)
children.forEach((c) => c.on('exit', (code) => {
  stop()
  process.exitCode = code ?? 0
}))
