import { constants } from 'node:fs'
import { access, open, readdir, realpath, stat } from 'node:fs/promises'
import { homedir, userInfo } from 'node:os'
import path from 'node:path'
import { redactLogLine } from './mission-control.js'

// Read-only browser over each agent's own folder: ~/.hermes/profiles/<name> for Hermes
// profiles (`default` falls back to ~/.hermes when it has no profiles/default folder) and
// ~/.opencode for OpenCode. Every request is confined to that folder (after
// resolving symlinks), secret-bearing files are listed but never read, and text content is
// passed through the same secret redaction as logs.

const PREVIEW_LIMIT = 256 * 1024
const LIST_LIMIT = 500
const PROFILE_NAME = /^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/

/** Heavy or non-profile directories hidden from listings. */
const HIDDEN_DIRECTORIES = new Set(['node_modules', '.git', '__pycache__', '.venv', 'venv', '.cache', 'hermes-agent'])
/** Never read: credentials, keys and binary state stores. Listed with `sensitive: true`. */
const SENSITIVE_FILE = /(^\.env(\..*)?$|^auth\.json$|^\.netrc$|^id_(rsa|ed25519|ecdsa|dsa)(\.pub)?$|\.(pem|key|p12|pfx|crt|keystore|jks)$|credential|secret|token|password|cookie|oauth|\.(db|sqlite|sqlite3|db-wal|db-shm|db-journal)$|-(wal|shm)$)/i

export interface FolderAgent { profile: string; label: string; available: boolean; path: string; reason?: string; warning?: string }
/** Server-side view of an agent folder: the absolute directory stays on the server. */
export interface AgentFolder extends FolderAgent { directory: string }
export interface FolderEntry { name: string; path: string; type: 'dir' | 'file'; size: number; modified: string; sensitive: boolean; unreadable?: boolean }
export interface FolderListing { profile: string; path: string; entries: FolderEntry[]; truncated: boolean; hiddenCount: number }
export interface FolderFile {
  profile: string
  path: string
  size: number
  modified: string
  kind: 'text' | 'binary' | 'sensitive' | 'too-large'
  content?: string
  truncated?: boolean
  redactions?: number
}

export class FolderError extends Error {
  constructor(message: string, readonly status: 400 | 403 | 404 | 423 | 500) { super(message) }
}

/** Mirrors hermes_constants.get_default_hermes_root(). RUANG_HERMES_ROOT (or the older MISSION_CONTROL_HERMES_ROOT) overrides it. */
export function hermesRoot(env: NodeJS.ProcessEnv = process.env, home = homedir()): string {
  const override = env.RUANG_HERMES_ROOT ?? env.MISSION_CONTROL_HERMES_ROOT
  if (override) return path.resolve(override)
  const native = path.join(home, `.hermes${env.HERMES_DATA_DIR_SUFFIX ?? ''}`)
  const configured = env.HERMES_HOME?.trim()
  if (!configured) return native
  const resolved = path.resolve(configured.replace(/^~(?=$|\/)/, home))
  const relative = path.relative(native, resolved)
  if (!relative.startsWith('..') && !path.isAbsolute(relative)) return native
  return path.basename(path.dirname(resolved)) === 'profiles' ? path.dirname(path.dirname(resolved)) : resolved
}

/** Normalises a client path to a safe relative path ('' is the profile root). */
export function safeRelativePath(input: unknown): string {
  if (input === undefined || input === '' || input === '/') return ''
  if (typeof input !== 'string' || input.length > 1024 || input.includes('\0')) throw new FolderError('Invalid path.', 400)
  const normalized = path.posix.normalize(input.replace(/\\/g, '/')).replace(/^\/+/, '').replace(/\/+$/, '')
  if (normalized === '.' ) return ''
  if (normalized.split('/').some((part) => part === '..')) throw new FolderError('Path escapes the profile folder.', 403)
  return normalized
}

function processUser(): string {
  try { return userInfo().username } catch { return String(process.getuid?.() ?? 'unknown') }
}

/** Turns a filesystem error into a message that says what went wrong and how to fix it. */
export function fsError(error: unknown, what: string, where?: string): FolderError {
  const code = (error as NodeJS.ErrnoException | undefined)?.code
  const user = processUser()
  if (code === 'EACCES' || code === 'EPERM') return new FolderError(`Permission denied: Ruang runs as "${user}" and cannot read ${what}. Run Ruang as the user that owns this Hermes profile, or grant read access, for example: sudo setfacl -R -m u:${user}:rX ${where ?? '<folder>'}`, 403)
  if (code === 'ENOENT' || code === 'ENOTDIR') return new FolderError(`${what[0].toUpperCase()}${what.slice(1)} was not found.`, 404)
  if (code === 'ELOOP') return new FolderError(`${what[0].toUpperCase()}${what.slice(1)} is a symlink loop.`, 400)
  return new FolderError(`Could not read ${what} (${code ?? 'unknown error'}).`, 500)
}

async function resolveInside(base: string, relative: string): Promise<string> {
  let realBase: string
  try { realBase = await realpath(base) } catch (error) { throw fsError(error, 'the agent folder', base) }
  let target: string
  try { target = await realpath(path.join(realBase, relative)) } catch (error) { throw fsError(error, relative ? `"${relative}"` : 'the agent folder', realBase) }
  const inside = path.relative(realBase, target)
  if (inside.startsWith('..') || path.isAbsolute(inside)) throw new FolderError('Path escapes the profile folder.', 403)
  return target
}

function isHidden(name: string): boolean {
  return HIDDEN_DIRECTORIES.has(name)
}

function insideAny(target: string, directories: Iterable<string>): boolean {
  for (const directory of directories) {
    const relative = path.relative(directory, target)
    if (relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative))) return true
  }
  return false
}

export function isSensitive(name: string): boolean {
  return SENSITIVE_FILE.test(name)
}

/**
 * Lists one folder of an agent. `excluded` holds the real paths of the *other* agents' folders:
 * when one agent's folder contains another's (the Hermes root holds profiles/), that sub-folder
 * is hidden so every agent only ever shows its own files.
 */
/**
 * Lists one folder of an agent. `excluded` holds the real paths of the *other* agents' folders:
 * when one agent's folder contains another's (the Hermes root holds profiles/), that sub-folder
 * is hidden so every agent only ever shows its own files. Entries are typed from readdir and
 * only the shown entries are stat'ed, so large folders (sessions/) stay fast. An entry that
 * cannot be stat'ed is still listed, marked unreadable.
 */
export async function listFolder(folder: Pick<AgentFolder, 'profile' | 'directory'>, relativeInput: unknown, excluded: string[] = []): Promise<FolderListing> {
  const relative = safeRelativePath(relativeInput)
  const directory = await resolveInside(folder.directory, relative)
  if (insideAny(directory, excluded)) throw new FolderError('File or folder not found.', 404)
  const label = relative ? `"${relative}"` : 'the agent folder'
  let dirents
  try {
    if (!(await stat(directory)).isDirectory()) throw new FolderError('Not a folder.', 400)
    dirents = await readdir(directory, { withFileTypes: true })
  } catch (error) {
    throw error instanceof FolderError ? error : fsError(error, label, directory)
  }
  let hiddenCount = 0
  const typed: { name: string; full: string; type: 'dir' | 'file'; unreadable?: boolean }[] = []
  for (const dirent of dirents) {
    if (isHidden(dirent.name)) { hiddenCount += 1; continue }
    const full = path.join(directory, dirent.name)
    let type: 'dir' | 'file' | undefined = dirent.isDirectory() ? 'dir' : dirent.isFile() ? 'file' : undefined
    let unreadable = false
    if (dirent.isSymbolicLink()) {
      try {
        const target = await stat(full)
        type = target.isDirectory() ? 'dir' : target.isFile() ? 'file' : undefined
      } catch (error) {
        const code = (error as NodeJS.ErrnoException).code
        if (code !== 'EACCES' && code !== 'EPERM') continue // broken symlink
        type = 'file'
        unreadable = true
      }
    }
    if (!type) continue // sockets, pipes, devices
    if (type === 'dir' && excluded.length > 0) {
      const real = await realpath(full).catch(() => undefined)
      if (real && insideAny(real, excluded)) { hiddenCount += 1; continue }
    }
    typed.push({ name: dirent.name, full, type, ...(unreadable ? { unreadable } : {}) })
  }
  typed.sort((a, b) => (a.type === b.type ? a.name.localeCompare(b.name) : a.type === 'dir' ? -1 : 1))
  const shown = await Promise.all(typed.slice(0, LIST_LIMIT).map(async (item): Promise<FolderEntry> => {
    const base = { name: item.name, path: relative ? `${relative}/${item.name}` : item.name, type: item.type, sensitive: item.type === 'file' && isSensitive(item.name) }
    if (item.unreadable) return { ...base, size: 0, modified: '', unreadable: true }
    try {
      const info = await stat(item.full)
      return { ...base, size: item.type === 'file' ? info.size : 0, modified: info.mtime.toISOString() }
    } catch {
      return { ...base, size: 0, modified: '', unreadable: true }
    }
  }))
  return { profile: folder.profile, path: relative, entries: shown, truncated: typed.length > LIST_LIMIT, hiddenCount }
}

function looksBinary(buffer: Buffer): boolean {
  const sample = buffer.subarray(0, 8000)
  if (sample.includes(0)) return true
  let control = 0
  for (const byte of sample) if (byte < 7 || (byte > 13 && byte < 32)) control += 1
  return sample.length > 0 && control / sample.length > 0.1
}

export async function readFolderFile(folder: Pick<AgentFolder, 'profile' | 'directory'>, relativeInput: unknown, excluded: string[] = []): Promise<FolderFile> {
  const relative = safeRelativePath(relativeInput)
  if (!relative) throw new FolderError('Not a file.', 400)
  const name = path.posix.basename(relative)
  if (relative.split('/').some(isHidden)) throw new FolderError('File or folder not found.', 404)
  const target = await resolveInside(folder.directory, relative)
  if (insideAny(target, excluded)) throw new FolderError('File or folder not found.', 404)
  let info
  try { info = await stat(target) } catch (error) { throw fsError(error, `"${relative}"`, target) }
  if (!info.isFile()) throw new FolderError('Not a file.', 400)
  const base = { profile: folder.profile, path: relative, size: info.size, modified: info.mtime.toISOString() }
  if (isSensitive(name) || isSensitive(path.basename(target))) return { ...base, kind: 'sensitive' }
  let handle
  try { handle = await open(target, 'r') } catch (error) { throw fsError(error, `"${relative}"`, target) }
  try {
    const length = Math.min(info.size, PREVIEW_LIMIT)
    const buffer = Buffer.alloc(length)
    await handle.read(buffer, 0, length, 0)
    if (looksBinary(buffer)) return { ...base, kind: 'binary' }
    let redactions = 0
    const content = buffer.toString('utf8').split('\n').map((line) => {
      const redacted = redactLogLine(line, Number.POSITIVE_INFINITY)
      if (redacted !== line) redactions += 1
      return redacted
    }).join('\n')
    return { ...base, kind: info.size > PREVIEW_LIMIT ? 'too-large' : 'text', content, truncated: info.size > PREVIEW_LIMIT, redactions }
  } finally {
    await handle.close()
  }
}

function displayPath(directory: string, home: string): string {
  const relative = path.relative(home, directory)
  return !relative.startsWith('..') && !path.isAbsolute(relative) ? (relative ? `~/${relative}` : '~') : directory
}

async function firstDirectory(candidates: string[]): Promise<{ directory: string; real?: string; denied?: boolean }> {
  let denied: string | undefined
  for (const candidate of candidates) {
    const real = await realpath(candidate).catch((error: NodeJS.ErrnoException) => {
      if ((error.code === 'EACCES' || error.code === 'EPERM') && !denied) denied = candidate
      return undefined
    })
    if (real && (await stat(real).then((info) => info.isDirectory(), () => false))) return { directory: candidate, real }
  }
  return denied ? { directory: denied, denied: true } : { directory: candidates[0] }
}

/**
 * Resolves every agent to its own folder:
 * - Hermes profile <name> → <root>/profiles/<name>; `default` → <root>/profiles/default, or the
 *   Hermes root itself when that folder does not exist (stock Hermes layout);
 * - OpenCode → ~/.opencode, then ~/.config/opencode (RUANG_OPENCODE_DIR, or the older MISSION_CONTROL_OPENCODE_DIR, overrides).
 * A non-default agent that resolves to the Hermes root, or to another agent's folder, is not
 * opened: it would show files that are not its own.
 */
export async function resolveAgentFolders(profiles: string[], env: NodeJS.ProcessEnv = process.env, home = homedir()): Promise<AgentFolder[]> {
  const root = hermesRoot(env, home)
  // Every Hermes profile this machine reports; `default` always exists in Hermes, so it is the
  // fallback when the profile list cannot be read.
  const listed = profiles.filter((name) => name !== 'opencode' && PROFILE_NAME.test(name))
  const names = [...new Set(listed.length ? listed : ['default'])]
  const specs = [
    ...names.map((profile) => ({ profile, candidates: profile === 'default' ? [path.join(root, 'profiles', 'default'), root] : [path.join(root, 'profiles', profile)] })),
    { profile: 'opencode', candidates: (env.RUANG_OPENCODE_DIR ?? env.MISSION_CONTROL_OPENCODE_DIR) ? [path.resolve((env.RUANG_OPENCODE_DIR ?? env.MISSION_CONTROL_OPENCODE_DIR)!)] : [path.join(home, '.opencode'), path.join(home, '.config', 'opencode')] },
  ]
  const realRoot = await realpath(root).catch(() => root)
  const claimed = new Map<string, string>()
  const folders: AgentFolder[] = []
  for (const spec of specs) {
    const { directory, real, denied } = await firstDirectory(spec.candidates)
    const label = spec.profile
    const base = { profile: spec.profile, label, path: displayPath(directory, home), directory: real ?? directory }
    // OpenCode is optional: without its folder it is simply not listed.
    if (!real && spec.profile === 'opencode' && !denied) continue
    if (!real) { folders.push({ ...base, available: false, reason: denied ? `Permission denied for "${processUser()}" (a parent folder is not readable)` : 'Folder not found on this machine' }); continue }
    if (spec.profile !== 'default' && real === realRoot) { folders.push({ ...base, available: false, reason: 'Resolves to the shared Hermes root, not its own folder' }); continue }
    const owner = claimed.get(real)
    if (owner) { folders.push({ ...base, available: false, reason: `Same folder as ${owner}` }); continue }
    claimed.set(real, label)
    // Existence only needs the parent's permissions; listing needs read + execute on the folder.
    const readable = await access(real, constants.R_OK | constants.X_OK).then(() => true, () => false)
    folders.push({ ...base, available: true, ...(readable ? {} : { warning: `No read permission for "${processUser()}"` }) })
  }
  return folders
}

/** Real paths of every other agent folder that sits *inside* this agent's folder, hidden inside it. */
export function excludedFor(folder: AgentFolder, folders: AgentFolder[]): string[] {
  // Only a folder below this one may be hidden here. On the stock layout `default` resolves to the
  // Hermes root, which *contains* every other profile: counting those as exclusions rejects this
  // agent's own folder too (the requested path sits inside them), and every non-default agent ends
  // up unreadable — 404 on a folder the API just listed as available.
  return folders
    .filter((other) => other.available && other.profile !== folder.profile && insideAny(other.directory, [folder.directory]))
    .map((other) => other.directory)
}

export function publicAgent({ directory: _directory, ...agent }: AgentFolder): FolderAgent {
  void _directory
  return agent
}
