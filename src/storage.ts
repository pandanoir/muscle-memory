const STORAGE_KEY = 'muscle-memory:log'

export type LogRecord = {
  updatedAt: string
  content: string
}

const EMPTY: LogRecord = { updatedAt: '', content: '' }

export function loadLog(): LogRecord {
  const raw = localStorage.getItem(STORAGE_KEY)
  if (!raw) return EMPTY
  try {
    const parsed = JSON.parse(raw) as Partial<LogRecord>
    return {
      updatedAt: parsed.updatedAt ?? '',
      content: parsed.content ?? '',
    }
  } catch {
    return EMPTY
  }
}

export function saveLog(content: string): LogRecord {
  const record: LogRecord = {
    updatedAt: new Date().toISOString(),
    content,
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(record))
  return record
}
