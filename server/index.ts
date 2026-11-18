import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import express, { type NextFunction, type Request, type Response } from 'express'
import { alwaysHiddenFor, excludedFor, FolderError, listFolder, publicAgent, readFolderFile, resolveAgentFolders } from './folders.js'
import { installAccess } from './access.js'
import { redactActivity, redactCalendar, redactDashboard, redactLogs, redactMemory, redactOffice, redactTasks, redactUsage } from './privacy.js'
import { installProfileLock, isHidden, type Privacy } from './profile-lock.js'
import { API_VERSION } from './api-version.js'
import { collectMemory } from './memory.js'
import { getActivity, getCalendar, getChannels, getCommandLog, getDashboard, getKnowledge, getLogs, getOffice, getSnapshot, getTaskBoard, getTaskDetail, getUsage } from './mission-control.js'

const HOST = process.env.RUANG_HOST ?? '127.0.0.1'
// MISSION_CONTROL_PORT is the pre-rename name, still honoured.
const PORT = Number(process.env.RUANG_PORT ?? process.env.MISSION_CONTROL_PORT) || 3001
// The built UI sits next to the server: ../dist from server/*.ts (development, npm start)
// and ../../dist from build/server/*.js (the installed package).
const distDirectory = [new URL('../dist', import.meta.url), new URL('../../dist', import.meta.url)].map((url) => fileURLToPath(url)).find((path) => existsSync(join(path, 'index.html'))) ?? fileURLToPath(new URL('../dist', import.meta.url))

const app = express()
app.disable('x-powered-by')
app.use('/api', (_request, response, next) => {
  response.set('Cache-Control', 'no-store')
  next()
})

const startedAt = new Date().toISOString()
app.get('/api/health', (_request, response) => { response.json({ ok: true, apiVersion: API_VERSION, startedAt }) })

// Optional access code (off by default): locks every other /api route until it is entered.
installAccess(app)
// Optional profile lock (off by default): a PIN withholds the private data of chosen agents.
const privacyOf = installProfileLock(app)

// `?fresh=1` (manual refresh) bypasses the 10s cache for anything older than 2s.
const FRESH_WINDOW_MS = 8_000
// Every snapshot is shared and cached; the private data of locked agents is withheld per request.
const routes: Record<string, (now: number, privacy: Privacy) => Promise<unknown> | unknown> = {
  '/api/runtime': getSnapshot,
  '/api/dashboard': async (now, privacy) => redactDashboard(await getDashboard(now), privacy),
  '/api/tasks': async (now, privacy) => redactTasks(await getTaskBoard(now), privacy),
  '/api/calendar': async (now, privacy) => redactCalendar(await getCalendar(now), privacy),
  '/api/activity': async (now, privacy) => redactActivity(await getActivity(now), privacy),
  '/api/knowledge': getKnowledge,
  '/api/office': async (now, privacy) => redactOffice(await getOffice(now), privacy),
  '/api/channels': getChannels,
  '/api/logs': async (now, privacy) => redactLogs(await getLogs(now), privacy),
  '/api/command-log': () => getCommandLog(),
}
for (const [path, handler] of Object.entries(routes)) {
  app.get(path, async (request, response) => {
    const now = Date.now() + (request.query.fresh === '1' ? FRESH_WINDOW_MS : 0)
    response.json(await handler(now, await privacyOf(request)))
  })
}
const locked = (response: Response, agent: string) => response.status(423).json({ error: `🔒 ${agent} is locked. Enter the PIN to see it.`, locked: 'profile', agent })
app.get('/api/usage', async (request, response) => {
  const now = Date.now() + (request.query.fresh === '1' ? FRESH_WINDOW_MS : 0)
  response.json(redactUsage(await getUsage(Number(request.query.days) || 7, now), await privacyOf(request)))
})
app.get('/api/tasks/:id', async (request, response) => {
  const board = typeof request.query.board === 'string' && request.query.board ? request.query.board : undefined
  const privacy = await privacyOf(request)
  const listed = (await getTaskBoard()).tasks.data.find((task) => task.id === request.params.id && task.board === board)
  if (listed && isHidden(privacy, listed.assignee)) { locked(response, listed.assignee!); return }
  const detail = await getTaskDetail(String(request.params.id), Date.now(), board)
  if (!detail) { response.status(404).json({ error: 'Unknown task.' }); return }
  const assignee = detail.task.data?.assignee
  if (isHidden(privacy, assignee)) { locked(response, assignee!); return }
  response.json(detail)
})

// Folders: read-only view of each agent's own folder. Only agents the server resolved
// (every Hermes profile this machine reports, and OpenCode when installed) can be opened.
async function agentFolders() {
  const runtime = await getSnapshot()
  return resolveAgentFolders(runtime.profiles.data.map((profile) => profile.name))
}
async function openFolder(profile: string) {
  const folders = await agentFolders()
  const folder = folders.find((item) => item.profile === profile)
  if (!folder) throw new FolderError('Unknown agent.', 404)
  if (!folder.available) throw new FolderError(folder.reason ?? 'Folder not available.', 404)
  // Other agents' folders inside this one are hidden, and the Hermes profiles folder always is.
  return { folder, excluded: [...excludedFor(folder, folders), ...(await alwaysHiddenFor(folder))] }
}
function folderRoute(handler: (request: Request) => Promise<unknown>) {
  return async (request: Request, response: Response) => {
    try {
      response.json(await handler(request))
    } catch (error) {
      if (error instanceof FolderError) { response.status(error.status).json({ error: error.message }); return }
      throw error
    }
  }
}
app.get('/api/memory', folderRoute(async (request) => redactMemory(await collectMemory(await agentFolders()), await privacyOf(request))))
app.get('/api/folders', folderRoute(async () => ({ agents: (await agentFolders()).map(publicAgent), fetchedAt: new Date().toISOString() })))
/** A locked agent's folder answers 423 (Locked) until the PIN unlocks it in this browser. */
async function guardFolder(request: Request) {
  const profile = String(request.params.profile)
  if (isHidden(await privacyOf(request), profile)) throw new FolderError(`🔒 ${profile} is locked. Enter the PIN to see it.`, 423)
  return openFolder(profile)
}
app.get('/api/folders/:profile/list', folderRoute(async (request) => {
  const { folder, excluded } = await guardFolder(request)
  return listFolder(folder, request.query.path, excluded)
}))
app.get('/api/folders/:profile/file', folderRoute(async (request) => {
  const { folder, excluded } = await guardFolder(request)
  return readFolderFile(folder, request.query.path, excluded)
}))

app.use('/api', (_request, response) => { response.status(404).json({ error: 'Not found' }) })

// robots.txt: the public UI is crawlable; the /api surface (data snapshots) is not.
app.get('/robots.txt', (_request, response) => {
  response.type('text/plain').send('User-agent: *\nAllow: /\nDisallow: /api\n')
})

if (existsSync(distDirectory)) {
  app.use(express.static(distDirectory))
  app.get(/^(?!\/api\/).*/, (_request, response) => { response.sendFile('index.html', { root: distDirectory }) })
}

app.use((error: unknown, _request: Request, response: Response, _next: NextFunction) => {
  void _next
  console.error('Ruang request failed:', error instanceof Error ? error.message : error)
  response.status(500).json({ error: 'Internal error' })
})

app.listen(PORT, HOST, () => console.log(`Ruang listening on http://${HOST}:${PORT}${existsSync(distDirectory) ? ' (serving built UI)' : ' (API only; run the Vite dev server for the UI)'}`))
