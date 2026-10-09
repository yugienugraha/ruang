import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { excludedFor, FolderError, fsError, hermesRoot, listFolder, publicAgent, readFolderFile, resolveAgentFolders, safeRelativePath } from './folders.js'
import { buildOfficeSnapshot, collectAgentActivity, CommandError, parseRecentActivity, type AgentActivitySnapshot } from './mission-control.js'

const at = '2026-09-27T12:00:00.000Z'
const runtime = { profiles: { availability: 'available' as const, data: [{ name: 'default', model: 'm', gateway: 'Running' as const }, { name: 'coder', model: 'm', gateway: 'Running' as const }] }, openCode: { availability: 'available' as const, data: '1' }, fetchedAt: at }
const emptyBoard = { tasks: { availability: 'available' as const, data: [] }, fetchedAt: at }
const emptyActivity = { sessions: { availability: 'available' as const, data: [] }, fetchedAt: at }
const quiet = (profile: string) => ({ profile, availability: 'available' as const, active: false, mentionsOpenCode: false })

describe('live agent activity', () => {
  it('classifies chat replies, cron runs and tool use from agent.log', () => {
    const chat = parseRecentActivity('--- ~/.hermes/logs/agent.log [since=3m] (last 80) ---\n2026-09-27 12:00:01,000 INFO [tg:1] gateway.platforms.telegram: inbound message from user\n2026-09-27 12:00:02,000 INFO [tg:1] run_agent: turn started\n')
    expect(chat).toMatchObject({ active: true, kind: 'chat', label: 'Replying to a chat', lastSeen: '2026-09-27 12:00:02,000' })
    expect(parseRecentActivity('2026-09-27 12:00:01,000 INFO cron.scheduler: running job a1b2\n')).toMatchObject({ kind: 'cron', label: 'Running a scheduled job' })
    expect(parseRecentActivity('2026-09-27 12:00:01,000 INFO tools.terminal: running `opencode run fix`\n')).toMatchObject({ kind: 'tools', mentionsOpenCode: true })
  })

  it('ignores gateway polling noise and CLI housekeeping', () => {
    expect(parseRecentActivity('2026-09-27 12:00:01,000 INFO gateway.run: heartbeat ok\n2026-09-27 12:00:02,000 INFO hermes_cli.status: loaded\n')).toMatchObject({ active: false })
  })

  it('treats a session active in the last minutes as a conversation', () => {
    const sessions = `${'Title'.padEnd(32)} ${'Preview'.padEnd(40)} ${'Last Active'.padEnd(13)} ID\n${'─'.repeat(110)}\n${'Ask about invoices'.padEnd(32)} ${'hi'.padEnd(40)} ${'1m ago'.padEnd(13)} 20260927_120000_abc123\n`
    expect(parseRecentActivity('', sessions)).toMatchObject({ active: true, kind: 'chat' })
    expect(parseRecentActivity('', sessions.replace('1m ago', '2h ago'))).toMatchObject({ active: false })
  })

  it('probes each station profile with fixed commands and treats a missing log as quiet', async () => {
    const calls: string[] = []
    const snapshot = await collectAgentActivity(['default', 'coder', '--evil'], async (_file, args) => {
      calls.push(args.join(' '))
      if (args.includes('logs') && args[1] === 'coder') throw new CommandError('Command exited with code 1.', 'COMMAND_FAILED', 'Log file not found: x')
      if (args.includes('logs')) return '2026-09-27 12:00:01,000 INFO run_agent: turn started\n'
      return 'No sessions found.\n'
    })
    expect(calls).toContain('-p default logs agent -n 80 --since 3m')
    expect(calls).toContain('-p coder sessions list --limit 3')
    expect(calls.join(' ')).not.toContain('--evil')
    expect(snapshot.agents).toMatchObject([{ profile: 'default', availability: 'available', active: true, kind: 'thinking' }, { profile: 'coder', availability: 'available', active: false }])
  })
})

describe('office placement from live activity', () => {
  const live = (agents: AgentActivitySnapshot['agents']): AgentActivitySnapshot => ({ agents, fetchedAt: at })

  it('moves a chatting or scheduled agent out of the Lounge into the Workspace', () => {
    const office = buildOfficeSnapshot(runtime, emptyBoard, emptyActivity, { now: at, agentActivity: live([
      { profile: 'default', availability: 'available', active: true, kind: 'chat', label: 'Replying to a chat', mentionsOpenCode: false },
      { profile: 'coder', availability: 'available', active: true, kind: 'cron', label: 'Running a scheduled job', mentionsOpenCode: true },
    ]) })
    expect(office.stations).toMatchObject([
      { name: 'default', state: 'Collaborating', room: 'Workspace', roomPosition: 'meeting-area', activity: 'Replying to a chat', seat: 1 },
      { name: 'coder', state: 'Working', room: 'Workspace', roomPosition: 'assigned-desk', activity: 'Running a scheduled job', seat: 2 },
      { name: 'opencode', state: 'Working', room: 'Workspace', activity: 'Building via OpenCode', seat: 3 },
    ])
    expect(office.summary).toMatchObject({ active: 3, idle: 0 })
  })

  it('keeps quiet agents in the Lounge and shows live work even when the gateway is stopped', () => {
    const quietOffice = buildOfficeSnapshot(runtime, emptyBoard, emptyActivity, { now: at, agentActivity: live([quiet('default'), quiet('coder')]) })
    expect(quietOffice.stations.map((station) => [station.state, station.room, station.activity])).toEqual([['Idle', 'Lounge', 'On a break'], ['Idle', 'Lounge', 'On a break'], ['Idle', 'Lounge', 'On a break']])
    const stopped = buildOfficeSnapshot({ ...runtime, profiles: { availability: 'available', data: [{ name: 'default', model: 'm', gateway: 'Running' }, { name: 'coder', model: 'm', gateway: 'Stopped' }] } }, emptyBoard, emptyActivity, { now: at, agentActivity: live([quiet('default'), { profile: 'coder', availability: 'available', active: true, kind: 'tools', label: 'Using tools', mentionsOpenCode: false }]) })
    expect(stopped.stations[1]).toMatchObject({ state: 'Working', room: 'Workspace', activity: 'Using tools' })
  })

  it('labels running Kanban work with the task and never idles on an unavailable probe', () => {
    const board = { tasks: { availability: 'available' as const, data: [{ title: 'Ship v2', status: 'running', assignee: 'default' }] }, fetchedAt: at }
    const office = buildOfficeSnapshot(runtime, board, emptyActivity, { now: at, agentActivity: live([quiet('default'), { profile: 'coder', availability: 'unavailable', active: false, mentionsOpenCode: false }]) })
    expect(office.stations[0]).toMatchObject({ state: 'Working', activity: 'Kanban: Ship v2' })
    expect(office.stations[1].state).toBe('Unknown')
    expect(office.stations[2].state).toBe('Unknown')
  })
})

describe('agent folders', () => {
  let home: string
  let outside: string
  const root = () => path.join(home, '.hermes')
  const write = (file: string, content: string | Buffer) => { mkdirSync(path.dirname(file), { recursive: true }); writeFileSync(file, content) }
  beforeAll(() => {
    home = mkdtempSync(path.join(tmpdir(), 'mc-home-'))
    outside = mkdtempSync(path.join(tmpdir(), 'mc-outside-'))
    writeFileSync(path.join(outside, 'secret.txt'), 'outside')
    // Layout from a real install: every profile, including default, has its own folder.
    write(path.join(root(), 'config.yaml'), 'root: shared\n')
    write(path.join(root(), 'profiles', 'default', 'SOUL.md'), '# Soul\nBe helpful.\n')
    write(path.join(root(), 'profiles', 'default', 'config.yaml'), 'model: x\nmax_tokens: 4096\napi_key: sk-live-abcdefghijklmnop\n')
    write(path.join(root(), 'profiles', 'default', '.env'), 'OPENAI_API_KEY=sk-should-never-be-read\n')
    write(path.join(root(), 'profiles', 'default', 'state.db'), Buffer.from([0, 1, 2, 3]))
    write(path.join(root(), 'profiles', 'default', 'image.bin'), Buffer.from([0, 0, 0, 1, 2]))
    write(path.join(root(), 'profiles', 'default', 'memories', 'MEMORY.md'), 'remember this')
    write(path.join(root(), 'profiles', 'coder', 'SOUL.md'), 'engineer')
    write(path.join(home, '.opencode', 'config.yaml'), 'theme: dark\n')
    symlinkSync(outside, path.join(root(), 'profiles', 'default', 'escape'))
    symlinkSync(path.join(outside, 'secret.txt'), path.join(root(), 'profiles', 'default', 'escape.txt'))
  })
  afterAll(() => { rmSync(home, { recursive: true, force: true }); rmSync(outside, { recursive: true, force: true }) })

  it('resolves the Hermes root like Hermes does', () => {
    expect(hermesRoot({}, '/home/u')).toBe('/home/u/.hermes')
    expect(hermesRoot({ HERMES_HOME: '/home/u/.hermes/profiles/coder' }, '/home/u')).toBe('/home/u/.hermes')
    expect(hermesRoot({ HERMES_HOME: '/opt/data/profiles/coder' }, '/home/u')).toBe('/opt/data')
    expect(hermesRoot({ HERMES_HOME: '/opt/data' }, '/home/u')).toBe('/opt/data')
  })

  it('gives every agent its own folder, never the shared Hermes root', async () => {
    const folders = await resolveAgentFolders(['default', 'coder', 'research'], {}, home)
    expect(folders.map((folder) => [folder.label, folder.path, folder.available])).toEqual([
      ['default', '~/.hermes/profiles/default', true],
      ['coder', '~/.hermes/profiles/coder', true],
      ['research', '~/.hermes/profiles/research', false],
      ['opencode', '~/.opencode', true],
    ])
    expect(folders.map(publicAgent).every((agent) => !('directory' in agent))).toBe(true)
    const lead = await listFolder(folders[0], '', excludedFor(folders[0], folders))
    const engineer = await listFolder(folders[1], '', excludedFor(folders[1], folders))
    const openCode = await listFolder(folders[3], '', excludedFor(folders[3], folders))
    expect(lead.entries.map((entry) => entry.name)).toEqual(['escape', 'memories', '.env', 'config.yaml', 'escape.txt', 'image.bin', 'SOUL.md', 'state.db'])
    expect(engineer.entries.map((entry) => entry.name)).toEqual(['SOUL.md'])
    expect(openCode.entries.map((entry) => entry.name)).toEqual(['config.yaml'])
    expect(lead.entries.find((entry) => entry.name === '.env')?.sensitive).toBe(true)
  })

  it('falls back to the Hermes root for default and hides the other profiles inside it', async () => {
    const stock = mkdtempSync(path.join(tmpdir(), 'mc-stock-'))
    write(path.join(stock, '.hermes', 'SOUL.md'), 'root soul')
    write(path.join(stock, '.hermes', 'profiles', 'coder', 'SOUL.md'), 'engineer')
    const folders = await resolveAgentFolders(['default', 'coder'], {}, stock)
    expect(folders[0]).toMatchObject({ profile: 'default', path: '~/.hermes', available: true })
    const listing = await listFolder(folders[0], '', excludedFor(folders[0], folders))
    expect(listing.entries.map((entry) => entry.name)).toEqual(['profiles', 'SOUL.md'])
    await expect(listFolder(folders[0], 'profiles/coder', excludedFor(folders[0], folders))).rejects.toMatchObject({ status: 404 })
    await expect(readFolderFile(folders[0], 'profiles/coder/SOUL.md', excludedFor(folders[0], folders))).rejects.toMatchObject({ status: 404 })
    // Hiding a profile inside the root must not cost the profile its own folder: `default` owns
    // ~/.hermes, and coder's folder lives inside it, so an exclusion list built from every *other*
    // agent would reject coder's own path as well.
    const inner = await listFolder(folders[1], '', excludedFor(folders[1], folders))
    expect(inner.entries.map((entry) => entry.name)).toEqual(['SOUL.md'])
    expect(await readFolderFile(folders[1], 'SOUL.md', excludedFor(folders[1], folders))).toMatchObject({ kind: 'text', content: 'engineer' })
    rmSync(stock, { recursive: true, force: true })
  })

  it('refuses a non-default agent that resolves to the root or to another agent', async () => {
    const shared = mkdtempSync(path.join(tmpdir(), 'mc-shared-'))
    mkdirSync(path.join(shared, '.hermes', 'profiles'), { recursive: true })
    symlinkSync(path.join(shared, '.hermes'), path.join(shared, '.hermes', 'profiles', 'coder'))
    const folders = await resolveAgentFolders(['default', 'coder'], {}, shared)
    expect(folders[1]).toMatchObject({ profile: 'coder', available: false, reason: 'Resolves to the shared Hermes root, not its own folder' })
    rmSync(shared, { recursive: true, force: true })
  })

  it('reads text with redaction and refuses secrets, binaries and escapes', async () => {
    const folders = await resolveAgentFolders([], {}, home)
    const lead = folders[0]
    expect(await readFolderFile(lead, 'SOUL.md')).toMatchObject({ kind: 'text', content: '# Soul\nBe helpful.\n' })
    const config = await readFolderFile(lead, 'config.yaml')
    expect(config.content).toContain('max_tokens: 4096')
    expect(config.content).not.toContain('sk-live')
    expect(config.redactions).toBe(1)
    const env = await readFolderFile(lead, '.env')
    expect(env).toMatchObject({ kind: 'sensitive' })
    expect(env.content).toBeUndefined()
    expect((await readFolderFile(lead, 'image.bin')).kind).toBe('binary')
    await expect(readFolderFile(lead, 'escape.txt')).rejects.toMatchObject({ status: 403 })
    await expect(listFolder(lead, 'escape')).rejects.toMatchObject({ status: 403 })
    await expect(readFolderFile(lead, '../coder/SOUL.md')).rejects.toMatchObject({ status: 403 })
    await expect(readFolderFile(lead, '../../config.yaml')).rejects.toBeInstanceOf(FolderError)
    expect(safeRelativePath('/memories//')).toBe('memories')
  })

  it('explains permission and missing-file errors instead of failing generically', () => {
    const denied = fsError(Object.assign(new Error('x'), { code: 'EACCES' }), 'the agent folder', '/home/ubuntu/.hermes/profiles/coder')
    expect(denied.status).toBe(403)
    expect(denied.message).toMatch(/^Permission denied: Ruang runs as ".+" and cannot read the agent folder\./)
    expect(denied.message).toContain('/home/ubuntu/.hermes/profiles/coder')
    expect(fsError(Object.assign(new Error('x'), { code: 'ENOENT' }), '"notes.md"')).toMatchObject({ status: 404, message: '"notes.md" was not found.' })
    expect(fsError(Object.assign(new Error('x'), { code: 'EIO' }), 'the agent folder')).toMatchObject({ status: 500, message: 'Could not read the agent folder (EIO).' })
  })

  it('lists large folders quickly and in order, capped at 500 entries', async () => {
    const big = mkdtempSync(path.join(tmpdir(), 'mc-big-'))
    for (let index = 0; index < 650; index += 1) writeFileSync(path.join(big, `session_${String(index).padStart(4, '0')}.json`), '{}')
    mkdirSync(path.join(big, 'archive'))
    const listing = await listFolder({ profile: 'coder', directory: big }, '')
    expect(listing.entries).toHaveLength(500)
    expect(listing.truncated).toBe(true)
    expect(listing.entries[0]).toMatchObject({ name: 'archive', type: 'dir' })
    expect(listing.entries[1]).toMatchObject({ name: 'session_0000.json', type: 'file', size: 2 })
    rmSync(big, { recursive: true, force: true })
  })
})

describe('agent roster', () => {
  it('lists only the profiles this machine reports, and OpenCode only when its folder exists', async () => {
    const bare = mkdtempSync(path.join(tmpdir(), 'mc-bare-'))
    mkdirSync(path.join(bare, '.hermes', 'profiles', 'sales'), { recursive: true })
    const folders = await resolveAgentFolders(['default', 'sales'], {}, bare)
    expect(folders.map((folder) => folder.profile)).toEqual(['default', 'sales'])
    rmSync(bare, { recursive: true, force: true })
  })
})
