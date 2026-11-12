import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { handleGh, readJson } from './server/ghProxy.js'

export default defineConfig(({ mode }) => {
  // '' prefix = load every var from .env.local; FLOW_GITHUB_TOKEN stays on the server.
  const env = loadEnv(mode, process.cwd(), '')

  // Same read-only /gh/* proxy that api/gh.js provides on Vercel.
  async function gh(req, res, next) {
    if (!req.url.startsWith('/gh/')) return next()
    const u = new URL(req.url, 'http://localhost')
    try {
      const out = await handleGh(
        {
          method: req.method,
          path: u.pathname.slice(3),
          search: u.search,
          body: req.method === 'POST' ? await readJson(req) : null,
          accept: req.headers.accept,
        },
        env,
      )
      res.statusCode = out.status
      for (const [k, v] of Object.entries(out.headers)) res.setHeader(k, v)
      res.end(out.body)
    } catch (err) {
      res.statusCode = 502
      res.end(JSON.stringify({ message: 'proxy error: ' + err.message }))
    }
  }

  return {
    plugins: [
      react(),
      {
        name: 'gh-proxy',
        configureServer(server) { server.middlewares.use(gh) },
        configurePreviewServer(server) { server.middlewares.use(gh) },
      },
    ],
    server: { port: 5173 },
  }
})
