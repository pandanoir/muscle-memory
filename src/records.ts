const SEPARATOR = '====='
const DATE_LINE = /^\s*-\s*date:\s*(\d{4}-\d{2}-\d{2})/
const NAME_LINE = /^\s*-\s*name:\s*(.+?)\s*$/

export type Exercise = {
  name: string
  raw: string
}

export type DateBlock = {
  date: string
  headerRaw: string
  exercises: Exercise[]
}

export type ParsedContent = {
  prompt: string
  recordsHeader: string
  blocks: DateBlock[]
  hasSeparator: boolean
}

function splitLines(s: string): string[] {
  if (s === '') return []
  const parts = s.split('\n')
  return parts.map((p, i) => (i < parts.length - 1 ? p + '\n' : p))
}

function ensureTrailingNewline(s: string): string {
  if (s === '') return s
  return s.endsWith('\n') ? s : s + '\n'
}

export function parseContent(content: string): ParsedContent {
  const sepIndex = content.indexOf(SEPARATOR)
  if (sepIndex < 0) {
    const { header, blocks } = parseRecordsSection(content)
    return { prompt: '', recordsHeader: header, blocks, hasSeparator: false }
  }
  const promptEnd = sepIndex + SEPARATOR.length
  const prompt = content.slice(0, promptEnd)
  const recordsSection = content.slice(promptEnd)
  const { header, blocks } = parseRecordsSection(recordsSection)
  return { prompt, recordsHeader: header, blocks, hasSeparator: true }
}

function parseRecordsSection(section: string): { header: string; blocks: DateBlock[] } {
  const lines = splitLines(section)
  const boundaries: number[] = []
  for (let i = 0; i < lines.length; i++) {
    if (DATE_LINE.test(lines[i])) boundaries.push(i)
  }
  if (boundaries.length === 0) {
    return { header: section, blocks: [] }
  }
  const header = lines.slice(0, boundaries[0]).join('')
  const blocks: DateBlock[] = []
  for (let b = 0; b < boundaries.length; b++) {
    const start = boundaries[b]
    const end = b + 1 < boundaries.length ? boundaries[b + 1] : lines.length
    const blockLines = lines.slice(start, end)
    const dateMatch = blockLines[0].match(DATE_LINE)
    if (!dateMatch) continue
    const date = dateMatch[1]
    const { headerRaw, exercises } = parseExercises(blockLines)
    blocks.push({ date, headerRaw, exercises })
  }
  return { header, blocks }
}

function parseExercises(blockLines: string[]): {
  headerRaw: string
  exercises: Exercise[]
} {
  const nameIdx: number[] = []
  for (let i = 0; i < blockLines.length; i++) {
    if (NAME_LINE.test(blockLines[i])) nameIdx.push(i)
  }
  if (nameIdx.length === 0) {
    return { headerRaw: blockLines.join(''), exercises: [] }
  }
  const headerRaw = blockLines.slice(0, nameIdx[0]).join('')
  const exercises: Exercise[] = []
  for (let i = 0; i < nameIdx.length; i++) {
    const start = nameIdx[i]
    const end = i + 1 < nameIdx.length ? nameIdx[i + 1] : blockLines.length
    const exLines = blockLines.slice(start, end)
    const nameMatch = exLines[0].match(NAME_LINE)
    if (!nameMatch) continue
    exercises.push({ name: nameMatch[1], raw: exLines.join('') })
  }
  return { headerRaw, exercises }
}

export function formatContent(parsed: ParsedContent): string {
  return parsed.prompt + formatRecords(parsed.recordsHeader, parsed.blocks)
}

function formatRecords(header: string, blocks: DateBlock[]): string {
  if (blocks.length === 0) return header
  const normalizedHeader = ensureTrailingNewline(header)
  const blockTexts = blocks.map((b) => {
    const exercisesText = b.exercises.map((e) => e.raw).join('')
    return ensureTrailingNewline(b.headerRaw + exercisesText)
  })
  return normalizedHeader + blockTexts.join('')
}

export function mergeIncoming(base: ParsedContent, incomingText: string): ParsedContent {
  const incoming = parseRecordsFromRaw(incomingText)
  const merged: DateBlock[] = base.blocks.map((b) => ({ ...b, exercises: [...b.exercises] }))
  for (const incBlock of incoming) {
    const existing = merged.find((b) => b.date === incBlock.date)
    if (!existing) {
      merged.push(incBlock)
      continue
    }
    for (const incEx of incBlock.exercises) {
      const idx = existing.exercises.findIndex((e) => e.name === incEx.name)
      if (idx >= 0) existing.exercises[idx] = incEx
      else existing.exercises.push(incEx)
    }
  }
  return { ...base, blocks: merged }
}

function parseRecordsFromRaw(text: string): DateBlock[] {
  const sepIndex = text.indexOf(SEPARATOR)
  const body = sepIndex >= 0 ? text.slice(sepIndex + SEPARATOR.length) : text
  return parseRecordsSection(body).blocks
}

export function filterRecent(blocks: DateBlock[], days = 14): DateBlock[] {
  if (blocks.length === 0) return blocks
  const dates = blocks.map((b) => b.date).sort()
  const latest = dates[dates.length - 1]
  const cutoff = subtractDays(latest, days)
  return blocks.filter((b) => b.date >= cutoff)
}

function subtractDays(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split('-').map(Number)
  const dt = new Date(Date.UTC(y, m - 1, d))
  dt.setUTCDate(dt.getUTCDate() - days)
  const yy = dt.getUTCFullYear()
  const mm = String(dt.getUTCMonth() + 1).padStart(2, '0')
  const dd = String(dt.getUTCDate()).padStart(2, '0')
  return `${yy}-${mm}-${dd}`
}

export function buildRecentCopy(content: string, days = 14): string {
  const parsed = parseContent(content)
  if (!parsed.hasSeparator || parsed.blocks.length === 0) return content
  const recent = filterRecent(parsed.blocks, days)
  return formatContent({ ...parsed, blocks: recent })
}

export function mergeIntoContent(baseContent: string, incomingText: string): string {
  const base = parseContent(baseContent)
  const merged = mergeIncoming(base, incomingText)
  return formatContent(merged)
}

export function isValidIncoming(text: string): boolean {
  const blocks = parseRecordsFromRaw(text)
  if (blocks.length === 0) return false
  return blocks.every((b) => b.exercises.length > 0)
}
