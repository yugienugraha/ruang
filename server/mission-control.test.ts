import { describe, expect, it } from 'vitest'
import {
  agentRoster,
  collectActivity,
  collectCalendar,
  collectKnowledge,
  collectSnapshot,
  collectTaskBoard,
  buildOfficeSnapshot,
  buildOfficeSummary,
  commandTimeoutMs,
  createRosterMemory,
  getOffice,
  parseChannelStatus,
  parseGatewayStatus,
  parseProfiles,
  parseSessions,
  parseSkills,
  rosterMemory,
} from './mission-control.js'

describe('Hermes output parsers', () => {
  it('extracts profile, model and gateway state from the profile table', () => {
    expect(parseProfiles(' Profile    Model       Gateway\n ───────\n ◆default  gpt-5.6    running\n  coder  gpt-5.5  stopped\n')).toEqual([
      { name: 'default', model: 'gpt-5.6', gateway: 'Running' }, { name: 'coder', model: 'gpt-5.5', gateway: 'Stopped' },
    ])
  })

  it('normalizes gateway state without returning raw output', () => {
    expect(parseGatewayStatus('Active: active (running) since today')).toBe('Running')
    expect(parseGatewayStatus('service stopped')).toBe('Stopped')
    expect(parseGatewayStatus('unexpected')).toBe('Unknown')
  })

  it('gives explicit stopped states precedence over active wording', () => {
    expect(parseGatewayStatus('Service is not running; last known state: active')).toBe('Stopped')
    expect(parseGatewayStatus('inactive (previously running)')).toBe('Stopped')
  })

  it('makes structured unavailable results when a read fails', async () => {
    const snapshot = await collectSnapshot(async () => { throw new Error('not found') })
    expect(snapshot.profiles).toMatchObject({ availability: 'unavailable', data: [], error: { code: 'COMMAND_FAILED' } })
    expect(snapshot.openCode.data).toBe('Unknown')
  })

  it('treats unrecognized profile output as unavailable', async () => {
    const snapshot = await collectSnapshot(async (_file, args) => {
      if (args.join(' ') === 'profile list') return 'Hermes profile service is starting.'
      if (args.join(' ') === '-p coder gateway status') return 'running'
      return '1.0.0'
    })

    expect(snapshot.profiles).toMatchObject({ availability: 'unavailable', data: [], error: { code: 'COMMAND_FAILED' } })

  })

  it('uses the default profile gateway state without invoking a separate default gateway command', async () => {
    const calls: string[][] = []
    const snapshot = await collectSnapshot(async (file, args) => {
      calls.push([file, ...args])
      if (args.join(' ') === 'profile list') return ' Profile    Model       Gateway\n ───────\n ◆default  gpt-5.6    running\n  coder  gpt-5.5  stopped\n'
      if (args.join(' ') === '-p coder gateway status') return 'running'
      return '1.0.0'
    })

    expect(snapshot.profiles.data.map((profile) => [profile.name, profile.gateway])).toEqual([['default', 'Running'], ['coder', 'Stopped']])
    // Gateway states come from the profile list alone: no per-profile gateway command runs.
    expect(calls.filter((call) => call.includes('gateway'))).toEqual([])
  })
})

describe('Hermes MVP source normalizers', () => {
  it('normalizes only configured messaging platform names and a safe session count', () => {
    expect(parseChannelStatus('System status\nMessaging Platforms\n  Telegram: configured\n  Discord: not configured\n\nActive sessions: 1\nPrivate token: do-not-return\n')).toEqual({
      channels: [{ name: 'Telegram', status: 'Configured' }], activeSessions: 1,
    })
  })

  it('accepts checked platform rows without exposing their trailing provider detail', () => {
    expect(parseChannelStatus('◆ Messaging Platforms\n  Telegram      ✓ configured (home: 100000001)\n  Discord       ✗ not configured\n◆ Sessions\n')).toEqual({
      channels: [{ name: 'Telegram', status: 'Configured' }],
    })
  })

  it('rejects unparseable channel status output', async () => {
    await expect((async () => parseChannelStatus('status is healthy'))()).rejects.toThrow('Unrecognized channel output.')
  })

  it('keeps an empty Kanban array available so the UI can show No tasks', async () => {
    const board = await collectTaskBoard(async () => '[]')
    expect(board.tasks).toEqual({ availability: 'available', data: [] })
  })

  it('keeps Hermes no-jobs output available so the UI can show No scheduled jobs', async () => {
    const calendar = await collectCalendar(async () => "No scheduled jobs.\nCreate one with 'hermes cron create ...' or the /cron command in chat.\n")
    expect(calendar.jobs).toEqual({ availability: 'available', data: [] })
  })

  it('treats malformed or unrecognized source output as unavailable', async () => {
    await expect(Promise.all([
      collectTaskBoard(async () => '[{"unexpected": "value"}]'),
      collectCalendar(async () => 'Cron service is starting.'),
      collectActivity(async () => 'No sessions are currently loaded.'),
      collectKnowledge(async () => 'Skills service is starting.'),
    ])).resolves.toEqual([
      expect.objectContaining({ tasks: expect.objectContaining({ availability: 'unavailable', data: [] }) }),
      expect.objectContaining({ jobs: expect.objectContaining({ availability: 'unavailable', data: [] }) }),
      expect.objectContaining({ sessions: expect.objectContaining({ availability: 'unavailable', data: [] }) }),
      expect.objectContaining({ skills: expect.objectContaining({ availability: 'unavailable', data: [] }) }),
    ])
  })

  it('conservatively normalizes session list metadata', async () => {
    const activity = await collectActivity(async () => 'Title                            Preview                                  Last Active   ID\n──────────────────────────────────────────────────────────────────────────────────────────────────────────────\nExample greeting session 01      halo                                     just now      20260101_000000_example01\n')
    expect(activity.sessions).toEqual({
      availability: 'available',
      data: [{ title: 'Example greeting session 01', preview: 'halo', lastActive: 'just now', id: '20260101_000000_example01' }],
    })
  })

  it('accepts a recognized sessions header with no session rows', () => {
    expect(parseSessions('Title                            Preview                                  Last Active   ID\n──────────────────────────────────────────────────────────────────────────────────────────────────────────────\n')).toEqual([])
  })

  it('normalizes only recognizable enabled skill table rows', async () => {
    const knowledge = await collectKnowledge(async () => '                        Installed Skills (enabled only)                         \n┏━━━━━━━━━━━━━━━━━━━━━━━━━┳━━━━━━━━━━━━━━━━━━━━━━┳━━━━━━━━━┳━━━━━━━━━┳━━━━━━━━━┓\n┃ Name                    ┃ Category             ┃ Source  ┃ Trust   ┃ Status  ┃\n┡━━━━━━━━━━━━━━━━━━━━━━━━━╇━━━━━━━━━━━━━━━━━━━━━━╇━━━━━━━━━╇━━━━━━━━━╇━━━━━━━━━┩\n│ maps                    │ productivity         │ builtin │ builtin │ enabled │\n└─────────────────────────┴──────────────────────┴─────────┴─────────┴─────────┘\n0 hub-installed, 1 builtin, 0 local — 1 enabled shown\n')
    expect(knowledge.skills).toEqual({
      availability: 'available',
      data: [{ name: 'maps', category: 'productivity', source: 'builtin', trust: 'builtin', status: 'enabled' }],
    })
  })

  it('accepts a recognized skills schema with no skill rows', () => {
    expect(parseSkills('┏━━━━━━━━━━━━━━━━━━━━━━━━━┳━━━━━━━━━━━━━━━━━━━━━━┳━━━━━━━━━┳━━━━━━━━━┳━━━━━━━━━┓\n┃ Name                    ┃ Category             ┃ Source  ┃ Trust   ┃ Status  ┃\n┡━━━━━━━━━━━━━━━━━━━━━━━━━╇━━━━━━━━━━━━━━━━━━━━━━╇━━━━━━━━━╇━━━━━━━━━╇━━━━━━━━━┩\n└─────────────────────────┴──────────────────────┴─────────┴─────────┴─────────┘\n0 hub-installed, 0 builtin, 0 local — 0 enabled shown\n')).toEqual([])
  })

  it('returns structured unavailable states for every new source', async () => {
    const fail = async () => { throw new Error('not found') }
    await expect(Promise.all([collectTaskBoard(fail), collectCalendar(fail), collectActivity(fail), collectKnowledge(fail)])).resolves.toEqual([
      expect.objectContaining({ tasks: expect.objectContaining({ availability: 'unavailable', data: [] }) }),
      expect.objectContaining({ jobs: expect.objectContaining({ availability: 'unavailable', data: [] }) }),
      expect.objectContaining({ sessions: expect.objectContaining({ availability: 'unavailable', data: [] }) }),
      expect.objectContaining({ skills: expect.objectContaining({ availability: 'unavailable', data: [] }) }),
    ])
  })
})

describe('Office snapshot', () => {
  const runtime = {
    profiles: { availability: 'available' as const, data: [{ name: 'default', model: 'm', gateway: 'Running' as const }, { name: 'coder', model: 'm', gateway: 'Running' as const }] },
    openCode: { availability: 'available' as const, data: '1.0.0' },
    fetchedAt: '2026-09-27T12:00:00.000Z',
  }

  it('places the no-work crew in Lounge as server-managed Idle', () => {
    const office = buildOfficeSnapshot(runtime, { tasks: { availability: 'available', data: [] }, fetchedAt: runtime.fetchedAt }, { sessions: { availability: 'available', data: [] }, fetchedAt: runtime.fetchedAt }, { now: runtime.fetchedAt })

    expect(office.stations).toMatchObject([
      { name: 'default', room: 'Lounge', roomPosition: 'lounge-seat-1', state: 'Idle' },
      { name: 'coder', room: 'Lounge', roomPosition: 'lounge-seat-2', state: 'Idle' },
      { name: 'opencode', room: 'Lounge', roomPosition: 'lounge-seat-3', state: 'Idle' },
    ])
    expect(office.stations[2].provenance).toContain('OpenCode version availability is not a state signal')
    expect(office.stations[0].provenance).toContain('Ruang managed-idle placement policy')
    expect(office.summary).toEqual({ declared: 3, active: 0, idle: 3, offline: 0, unknown: 0, gatewaysReachable: 2, gatewaysDeclared: 2 })
  })

  it('uses only station-bound stopped gateways and actor-attributed Kanban tasks for work state', () => {
    const office = buildOfficeSnapshot(runtime, {
      tasks: { availability: 'available', data: [
        { title: 'Unassigned running work', status: 'running' },
        { title: 'Review the office', status: 'review', assignee: 'coder' },
      ] },
      fetchedAt: '2026-09-27T12:00:00.000Z',
    }, { sessions: { availability: 'available', data: [] }, fetchedAt: '2026-09-27T12:00:00.000Z' }, { now: runtime.fetchedAt })

    expect(office.stations).toMatchObject([
      { id: 'default', name: 'default', role: 'Hermes profile', room: 'Lounge', state: 'Idle', currentTask: 'No attributed task', recentActivity: 'No attributed recent activity' },
      { name: 'coder', room: 'Workspace', state: 'Reviewing', currentTask: 'Review the office', recentActivity: 'No attributed recent activity' },
      { name: 'opencode', room: 'Lounge', state: 'Idle', currentTask: 'No attributed task' },
    ])
  })

  it('returns Unknown when a required managed-idle input is unavailable or stale', () => {
    const unavailable = buildOfficeSnapshot(runtime, { tasks: { availability: 'unavailable', data: [] }, fetchedAt: runtime.fetchedAt }, { sessions: { availability: 'available', data: [] }, fetchedAt: runtime.fetchedAt }, { now: runtime.fetchedAt })
    const stale = buildOfficeSnapshot(runtime, { tasks: { availability: 'available', data: [] }, fetchedAt: '2026-09-27T11:58:00.000Z' }, { sessions: { availability: 'available', data: [] }, fetchedAt: runtime.fetchedAt }, { now: runtime.fetchedAt })

    expect(unavailable.stations.map((station) => station.state)).toEqual(['Unknown', 'Unknown', 'Unknown'])
    expect(stale.stations.map((station) => station.state)).toEqual(['Unknown', 'Unknown', 'Unknown'])
  })

  it('maps office states to rooms and keeps unknown agents in a labelled neutral workspace position', () => {
    const office = buildOfficeSnapshot(runtime, { tasks: { availability: 'available', data: [] }, fetchedAt: runtime.fetchedAt }, { sessions: { availability: 'available', data: [] }, fetchedAt: runtime.fetchedAt }, { now: runtime.fetchedAt })
    expect(office.stations).toMatchObject([
      { name: 'default', room: 'Lounge', roomPosition: 'lounge-seat-1' },
      { name: 'coder', room: 'Lounge', roomPosition: 'lounge-seat-2' },
      { name: 'opencode', room: 'Lounge', roomPosition: 'lounge-seat-3' },
    ])
  })

  it('summarizes only declared office states and reports gateway health separately', () => {
    const office = buildOfficeSnapshot(runtime, { tasks: { availability: 'available', data: [] }, fetchedAt: runtime.fetchedAt }, { sessions: { availability: 'available', data: [] }, fetchedAt: runtime.fetchedAt }, { now: runtime.fetchedAt })
    expect(buildOfficeSummary(office.stations, runtime)).toEqual({ declared: 3, active: 0, idle: 3, offline: 0, unknown: 0, gatewaysReachable: 2, gatewaysDeclared: 2 })
  })

  it('does not treat a stopped gateway as Offline (CLI agents need none) and never turns OpenCode version into a work state', () => {
    const office = buildOfficeSnapshot({
      ...runtime,
      profiles: { availability: 'available', data: [{ name: 'default', model: 'm', gateway: 'Stopped' }, { name: 'coder', model: 'm', gateway: 'Running' }] },
    }, {
      tasks: { availability: 'available', data: [{ title: 'Active lead work', status: 'running', assignee: 'default' }] },
      fetchedAt: '2026-09-27T12:00:00.000Z',
    }, { sessions: { availability: 'unavailable', data: [], error: { code: 'COMMAND_FAILED', message: 'Read command was unavailable.' } }, fetchedAt: '2026-09-27T12:00:00.000Z' }, { now: runtime.fetchedAt })

    expect(office.stations[0]).toMatchObject({ name: 'default', state: 'Working', currentTask: 'Active lead work', recentActivity: 'Not Available' })
    expect(office.stations.some((station) => station.state === 'Offline')).toBe(false)
    expect(office.stations[2]).toMatchObject({ name: 'opencode', state: 'Unknown' })
  })

  it('does not turn unassigned work, generic sessions, gateway Running, or a version into active state', () => {
    const office = buildOfficeSnapshot(runtime, {
      tasks: { availability: 'available', data: [{ title: 'Unassigned work', status: 'running' }] }, fetchedAt: runtime.fetchedAt,
    }, {
      sessions: { availability: 'available', data: [{ title: 'Generic session', preview: 'work', lastActive: 'now' }] }, fetchedAt: runtime.fetchedAt,
    }, { now: runtime.fetchedAt })

    expect(office.stations.map((station) => station.state)).toEqual(['Idle', 'Idle', 'Idle'])
  })

  it('uses a fresh explicit overlay before attributed work and expires it', () => {
    const board = { tasks: { availability: 'available' as const, data: [{ title: 'Lead work', status: 'running', assignee: 'default' }] }, fetchedAt: runtime.fetchedAt }
    const activity = { sessions: { availability: 'available' as const, data: [] }, fetchedAt: runtime.fetchedAt }
    const active = buildOfficeSnapshot(runtime, board, activity, { now: runtime.fetchedAt, explicitStates: [{ station: 'default', state: 'Reviewing', expiresAt: '2026-09-27T12:00:10.000Z' }] })
    const expired = buildOfficeSnapshot(runtime, board, activity, { now: '2026-09-27T12:00:20.000Z', explicitStates: [{ station: 'default', state: 'Reviewing', expiresAt: '2026-09-27T12:00:10.000Z' }] })

    expect(active.stations[0].state).toBe('Reviewing')
    expect(expired.stations[0].state).toBe('Working')
  })
})

describe('calendar across profiles', () => {
  const profileList = `\n Profile          Model                        Gateway      Alias        Distribution\n ───────────────    ───────────────────────────    ───────────    ───────────    ────────────────────\n ◆default         anthropic/claude-sonnet-4    running      —            —\n  coder    openai/gpt-5.5               running      le           —\n  research        —                            stopped      —            —\n`
  const cron = (id: string, name: string) => `  ${id} [active]\n    Name:      ${name}\n    Schedule:  0 8 * * *\n    Repeat:    ∞\n    Next run:  2026-09-28T08:00:00+07:00\n`

  it('reads every profile with -p and tags each job with its profile', async () => {
    const calls: string[][] = []
    const calendar = await collectCalendar(async (_file, args) => {
      calls.push(args)
      if (args.join(' ') === 'profile list') return profileList
      if (args[1] === 'default') return cron('a1b2c3d4', 'Morning brief')
      if (args[1] === 'coder') return cron('b2c3d4e5', 'Nightly review')
      return 'No scheduled jobs.\n'
    })
    expect(calls).toContainEqual(['-p', 'coder', 'cron', 'list', '--all'])
    expect(calendar.jobs.availability).toBe('available')
    expect(calendar.jobs.data.map((job) => [job.agent, job.name])).toEqual([['default', 'Morning brief'], ['coder', 'Nightly review']])
    expect(calendar.failedProfiles).toBeUndefined()
  })

  it('keeps the other profiles when one cron list fails, and names the failed one', async () => {
    const calendar = await collectCalendar(async (_file, args) => {
      if (args.join(' ') === 'profile list') return profileList
      if (args[1] === 'research') throw new Error('boom')
      return cron('a1b2c3d4', `Job of ${args[1]}`)
    })
    expect(calendar.jobs.data).toHaveLength(2)
    expect(calendar.failedProfiles).toEqual(['research'])
  })

  it('never passes an option-like profile name to hermes', async () => {
    const calls: string[][] = []
    await collectCalendar(async (_file, args) => {
      calls.push(args)
      if (args.join(' ') === 'profile list') return profileList.replace('research        ', '--evil          ')
      return 'No scheduled jobs.\n'
    })
    expect(calls.flat()).not.toContain('--evil')
  })
})

describe('read timeout', () => {
  it('defaults to a budget a busy Hermes CLI read can meet', () => {
    expect(commandTimeoutMs({})).toBe(20_000)
    expect(commandTimeoutMs({ RUANG_COMMAND_TIMEOUT_MS: '' })).toBe(20_000)
    expect(commandTimeoutMs({ RUANG_COMMAND_TIMEOUT_MS: '   ' })).toBe(20_000)
  })

  it('accepts a whole number of milliseconds inside 1s-120s', () => {
    expect(commandTimeoutMs({ RUANG_COMMAND_TIMEOUT_MS: '45000' })).toBe(45_000)
    expect(commandTimeoutMs({ MISSION_CONTROL_COMMAND_TIMEOUT_MS: '30000' })).toBe(30_000)
    expect(commandTimeoutMs({ RUANG_COMMAND_TIMEOUT_MS: '1000' })).toBe(1_000)
    expect(commandTimeoutMs({ RUANG_COMMAND_TIMEOUT_MS: '120000' })).toBe(120_000)
  })

  it('skips an unusable value rather than letting it shadow a usable one', () => {
    // A broken current name must not hide a working legacy value.
    expect(commandTimeoutMs({ RUANG_COMMAND_TIMEOUT_MS: 'soon', MISSION_CONTROL_COMMAND_TIMEOUT_MS: '30000' })).toBe(30_000)
    expect(commandTimeoutMs({ RUANG_COMMAND_TIMEOUT_MS: '0', MISSION_CONTROL_COMMAND_TIMEOUT_MS: '30000' })).toBe(30_000)
    for (const value of ['0', '-5', '999', '120001', '45000.5', '0x10', 'Infinity', 'NaN']) {
      expect(commandTimeoutMs({ RUANG_COMMAND_TIMEOUT_MS: value })).toBe(20_000)
    }
  })
})

describe('an empty crew is a readable answer', () => {
  it('reads a recognised profile table with no rows as an empty crew', () => {
    expect(parseProfiles(' Profile   Model   Gateway   Alias\n ────────  ───────  ────────\n')).toEqual([])
    expect(parseProfiles('No profiles found.\n')).toEqual([])
  })

  it('still treats unparseable profile output as a failed read', () => {
    expect(() => parseProfiles('hermes is starting up')).toThrow('Unrecognized profile output.')
  })

  it('reports an empty crew as available rather than as a failed read', async () => {
    const snapshot = await collectSnapshot(async (_file, args) => (args.join(' ') === 'profile list' ? ' Profile   Model   Gateway\n ────────\n' : '1.18.35'))

    expect(snapshot.profiles).toEqual({ availability: 'available', data: [] })
  })
})

describe('roster memory', () => {
  const read = {
    profiles: { availability: 'available' as const, data: [{ name: 'default', model: 'm', gateway: 'Running' as const }] },
    openCode: { availability: 'available' as const, data: '1.0.0' },
    fetchedAt: '2026-09-27T12:00:00.000Z',
  }
  const failed = {
    profiles: { availability: 'unavailable' as const, data: [], error: { code: 'TIMEOUT' as const, message: 'Read timed out.' } },
    openCode: { availability: 'available' as const, data: '1.0.0' },
    fetchedAt: '2026-09-27T12:00:00.000Z',
  }

  it('keeps the last readable crew and leaves it alone when a later read fails', () => {
    const memory = createRosterMemory()
    memory.remember(read, 1_000)
    expect(memory.current(1_000)).toEqual(read.profiles.data)
    memory.remember(failed, 2_000)
    expect(memory.current(2_000)).toEqual(read.profiles.data)
  })

  it('forgets a crew that has stopped being recent', () => {
    const memory = createRosterMemory(60_000)
    memory.remember(read, 1_000)
    expect(memory.current(61_000)).toHaveLength(1)
    expect(memory.current(61_001)).toEqual([])
  })

  it('clears when a read succeeds with no profiles, so a deleted crew stops being a station', () => {
    const memory = createRosterMemory()
    memory.remember(read, 1_000)
    memory.remember({ ...read, profiles: { availability: 'available', data: [] } }, 2_000)
    expect(memory.current(2_000)).toEqual([])
  })

  it('forgets everything on clear', () => {
    const memory = createRosterMemory()
    memory.remember(read, 1_000)
    memory.clear()
    expect(memory.current(1_000)).toEqual([])
  })
})

describe('Office roster when the profile list fails', () => {
  const at = '2026-09-27T12:00:00.000Z'
  const lastKnown = [{ name: 'default', model: 'm', gateway: 'Running' as const }, { name: 'coder', model: 'm', gateway: 'Running' as const }]
  const unreadable = {
    profiles: { availability: 'unavailable' as const, data: [], error: { code: 'TIMEOUT' as const, message: 'Read timed out.' } },
    openCode: { availability: 'available' as const, data: '1.0.0' },
    fetchedAt: at,
  }
  const board = { tasks: { availability: 'available' as const, data: [] }, fetchedAt: at }
  const activity = { sessions: { availability: 'available' as const, data: [] }, fetchedAt: at }
  const agentActivity = { agents: [], fetchedAt: at }

  it('keeps the last readable crew as Unknown instead of dropping every Hermes station', () => {
    const office = buildOfficeSnapshot(unreadable, board, activity, { now: at, lastKnownProfiles: lastKnown })

    expect(office.stations.map((station) => station.name)).toEqual(['default', 'coder', 'opencode'])
    expect(office.stations.map((station) => station.state)).toEqual(['Unknown', 'Unknown', 'Unknown'])
    expect(office.stations[0].provenance).toContain('Gateway Unknown')
    expect(office.stations[0].provenance).toContain('station kept from the last readable list')
    // The gateway states belonged to the failed read, so none is claimed and none is counted.
    expect(office.summary).toMatchObject({ declared: 3, unknown: 3, gatewaysReachable: 0, gatewaysDeclared: 0 })
  })

  it('stays empty (OpenCode only) when no readable list was ever seen', () => {
    const office = buildOfficeSnapshot(unreadable, board, activity, { now: at })

    expect(office.stations.map((station) => station.name)).toEqual(['opencode'])
    expect(office.stations[0].provenance).not.toContain('last readable list')
  })

  it('never lets the kept roster claim work: a stopped gateway is not resurrected', () => {
    const stopped = [{ name: 'coder', model: 'm', gateway: 'Stopped' as const }]
    const office = buildOfficeSnapshot(unreadable, board, activity, { now: at, lastKnownProfiles: stopped })

    expect(agentRoster(unreadable, stopped)).toContainEqual({ id: 'coder', role: 'Hermes profile', profile: 'coder', gateway: undefined, aliases: ['coder'] })
    expect(office.stations.map((station) => station.state)).toEqual(['Unknown', 'Unknown'])
  })

  it('serves the kept crew through the office endpoint, not only through the builder', async () => {
    const now = Date.parse(at)
    rosterMemory.remember({ ...unreadable, profiles: { availability: 'available', data: lastKnown } }, now)
    const kept = await getOffice(now, { runtime: unreadable, board, activity, agentActivity })
    expect(kept.stations.map((station) => station.name)).toEqual(['default', 'coder', 'opencode'])

    // The memory is what keeps them: without it the endpoint falls back to the failed read.
    rosterMemory.clear()
    const forgotten = await getOffice(now, { runtime: unreadable, board, activity, agentActivity })
    expect(forgotten.stations.map((station) => station.name)).toEqual(['opencode'])
  })
})

