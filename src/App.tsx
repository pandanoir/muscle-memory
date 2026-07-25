import { useCallback, useEffect, useState } from 'react'
import { loadLog, saveLog, type LogRecord } from './storage'
import { INITIAL_PROMPT } from './initialPrompt'
import { readClipboard, writeClipboard } from './clipboard'
import './App.css'

type Toast = { kind: 'ok' | 'error'; message: string } | null

const PREVIEW_LIMIT = 400
const CHATGPT_URL = 'chatgpt://'

function formatDate(iso: string): string {
  if (!iso) return '未保存'
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function App() {
  const [log, setLog] = useState<LogRecord>(() => loadLog())
  const [toast, setToast] = useState<Toast>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!toast) return
    const id = setTimeout(() => setToast(null), 2000)
    return () => clearTimeout(id)
  }, [toast])

  const notify = useCallback((t: NonNullable<Toast>) => setToast(t), [])

  const displayContent = log.content || INITIAL_PROMPT

  const handleCopyAndOpen = useCallback(async () => {
    if (busy) return
    setBusy(true)
    try {
      await writeClipboard(displayContent)
      window.location.href = CHATGPT_URL
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      notify({ kind: 'error', message: `コピー失敗: ${msg}` })
    } finally {
      setBusy(false)
    }
  }, [busy, displayContent, notify])

  const handlePaste = useCallback(async () => {
    if (busy) return
    setBusy(true)
    try {
      const text = await readClipboard()
      if (typeof text !== 'string' || text.length === 0) {
        notify({ kind: 'error', message: 'クリップボードが空です' })
        return
      }
      const next = saveLog(text)
      setLog(next)
      notify({ kind: 'ok', message: '保存しました' })
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      notify({ kind: 'error', message: `貼り付け失敗: ${msg}` })
    } finally {
      setBusy(false)
    }
  }, [busy, notify])

  const preview = displayContent.slice(0, PREVIEW_LIMIT)
  const hasMore = displayContent.length > PREVIEW_LIMIT

  return (
    <div className="app">
      <header className="header">
        <h1>Muscle Memory</h1>
      </header>

      <section className="meta">
        <div className="meta-row">
          <span className="meta-label">最終更新</span>
          <span className="meta-value">{formatDate(log.updatedAt)}</span>
        </div>
        <div className="meta-row">
          <span className="meta-label">文字数</span>
          <span className="meta-value">{displayContent.length.toLocaleString()}</span>
        </div>
      </section>

      <section className="preview">
        <pre className="preview-body">{preview}</pre>
        {hasMore && <div className="preview-more">…（省略）</div>}
      </section>

      <div className="actions">
        <button
          type="button"
          className="btn btn-primary"
          onClick={handleCopyAndOpen}
          disabled={busy}
        >
          コピーしてChatGPTを開く
        </button>
        <button
          type="button"
          className="btn btn-secondary"
          onClick={handlePaste}
          disabled={busy}
        >
          貼り付けして保存
        </button>
      </div>

      {toast && (
        <div className={`toast toast-${toast.kind}`} role="status">
          {toast.message}
        </div>
      )}
    </div>
  )
}

export default App
