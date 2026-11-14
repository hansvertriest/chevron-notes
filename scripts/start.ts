import { spawn } from 'node:child_process'

/** Runs the local API and the Vite dev server together; Ctrl-C stops both. */
const children = [
  spawn('node', ['server/main.ts'], { stdio: 'inherit' }),
  spawn('npx', ['vite'], { stdio: 'inherit' }),
]

const stop = () => children.forEach((c) => c.kill())
process.on('SIGINT', stop)
process.on('SIGTERM', stop)
children.forEach((c) => c.on('exit', (code) => {
  stop()
  process.exitCode = code ?? 0
}))
