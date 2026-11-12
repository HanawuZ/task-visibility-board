import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ mode }) => {
  // '' prefix = load every var from .env.local; FLOW_GITHUB_TOKEN stays on the server.
  const env = loadEnv(mode, process.cwd(), '')
  const token = env.FLOW_GITHUB_TOKEN || ''

  // /gh/* → api.github.com with the token added server-side.
  // Read-only: REST GETs plus POST /gh/graphql (the app only sends queries).
  const gh = {
    target: 'https://api.github.com',
    changeOrigin: true,
    rewrite: (p) => p.replace(/^\/gh/, ''),
    headers: { 'User-Agent': 'task-visibility-board', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
  }
  const readOnly = {
    name: 'gh-read-only',
    configureServer(server) { server.middlewares.use(guard) },
    configurePreviewServer(server) { server.middlewares.use(guard) },
  }
  function guard(req, res, next) {
    if (!req.url.startsWith('/gh/')) return next()
    const ok = req.method === 'GET' || (req.method === 'POST' && req.url.split('?')[0] === '/gh/graphql')
    if (ok) return next()
    res.statusCode = 405
    res.end(JSON.stringify({ message: 'read-only proxy' }))
  }

  return {
    plugins: [react(), readOnly],
    define: {
      __GH_ORG__: JSON.stringify(env.GITHUB_OWNER || ''),
      __GH_TOKEN_SET__: JSON.stringify(!!token),
    },
    server: { port: 5173, proxy: { '/gh': gh } },
    preview: { proxy: { '/gh': gh } },
  }
})
