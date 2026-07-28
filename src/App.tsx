import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { loadLog, saveLog } from './storage'
import { INITIAL_PROMPT } from './initialPrompt'
import { readClipboard, writeClipboard } from './clipboard'
import './App.css'

type Toast = { kind: 'ok' | 'error'; message: string } | null

const CHATGPT_URL = 'chatgpt://'

function App() {
  const initial = loadLog().content || INITIAL_PROMPT
  const [text, setText] = useState(initial)
  const [savedText, setSavedText] = useState(initial)
  const [toast, setToast] = useState<Toast>(null)
  const [busy, setBusy] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (!toast) return
    const id = setTimeout(() => setToast(null), 2000)
    return () => clearTimeout(id)
  }, [toast])

  useLayoutEffect(() => {
    const el = textareaRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [savedText])

  const notify = useCallback((t: NonNullable<Toast>) => setToast(t), [])

  const dirty = text !== savedText

  const handleCopyAndOpen = useCallback(async () => {
    if (busy) return
    setBusy(true)
    try {
      await writeClipboard(text)
      window.location.href = CHATGPT_URL
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      notify({ kind: 'error', message: `コピー失敗: ${msg}` })
    } finally {
      setBusy(false)
    }
  }, [busy, text, notify])

  const handlePaste = useCallback(async () => {
    if (busy) return
    setBusy(true)
    try {
      const clip = await readClipboard()
      if (typeof clip !== 'string' || clip.length === 0) {
        notify({ kind: 'error', message: 'クリップボードが空です' })
        return
      }
      saveLog(clip)
      setText(clip)
      setSavedText(clip)
      notify({ kind: 'ok', message: '保存しました' })
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      notify({ kind: 'error', message: `貼り付け失敗: ${msg}` })
    } finally {
      setBusy(false)
    }
  }, [busy, notify])

  const handleSave = useCallback(() => {
    if (busy || !dirty) return
    saveLog(text)
    setSavedText(text)
    notify({ kind: 'ok', message: '保存しました' })
  }, [busy, dirty, text, notify])

  return (
    <div className="app">
      <header className="header">
        <h1>Muscle Memory</h1>
      </header>

      <textarea
        ref={textareaRef}
        className="editor"
        value={text}
        onChange={(e) => setText(e.target.value)}
        spellCheck={false}
      />

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
        <button
          type="button"
          className="btn btn-secondary"
          onClick={handleSave}
          disabled={busy || !dirty}
        >
          保存
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
