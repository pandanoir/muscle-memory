import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { loadLog, saveLog } from './storage'
import { INITIAL_PROMPT } from './initialPrompt'
import { readClipboard, writeClipboard } from './clipboard'
import { buildRecentCopy, isValidIncoming, mergeIntoContent } from './records'
import './App.css'

type Toast = { kind: 'ok' | 'error'; message: string } | null

const CHATGPT_URL = 'chatgpt://'

function ensurePromptBase(saved: string): string {
  if (saved.includes('=====')) return saved
  const stripped = saved.replace(/^\s*records:\s*/, '')
  return INITIAL_PROMPT + stripped
}

function App() {
  const initial = loadLog().content || INITIAL_PROMPT
  const [savedText, setSavedText] = useState(initial)
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(initial)
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
  }, [savedText, editing])

  const notify = useCallback((t: NonNullable<Toast>) => setToast(t), [])

  const handleCopyAndOpen = useCallback(async () => {
    if (busy) return
    setBusy(true)
    try {
      const payload = buildRecentCopy(savedText, 14)
      await writeClipboard(payload)
      window.location.href = CHATGPT_URL
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      notify({ kind: 'error', message: `コピー失敗: ${msg}` })
    } finally {
      setBusy(false)
    }
  }, [busy, savedText, notify])

  const handleRecord = useCallback(async () => {
    if (busy) return
    setBusy(true)
    try {
      const clip = await readClipboard()
      if (typeof clip !== 'string' || clip.length === 0) {
        notify({ kind: 'error', message: 'クリップボードが空です' })
        return
      }
      if (!isValidIncoming(clip)) {
        notify({ kind: 'error', message: '正しい記録フォーマットではありません' })
        return
      }
      const baseText = ensurePromptBase(savedText)
      const merged = mergeIntoContent(baseText, clip)
      saveLog(merged)
      setSavedText(merged)
      notify({ kind: 'ok', message: '記録しました' })
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      notify({ kind: 'error', message: `記録失敗: ${msg}` })
    } finally {
      setBusy(false)
    }
  }, [busy, savedText, notify])

  const handleEditStart = useCallback(() => {
    if (busy) return
    setDraft(savedText)
    setEditing(true)
  }, [busy, savedText])

  const handleEditCancel = useCallback(() => {
    if (busy) return
    if (draft !== savedText && !window.confirm('編集を破棄しますか？')) return
    setEditing(false)
    setDraft(savedText)
  }, [busy, draft, savedText])

  const handleEditSave = useCallback(() => {
    if (busy) return
    saveLog(draft)
    setSavedText(draft)
    setEditing(false)
    notify({ kind: 'ok', message: '保存しました' })
  }, [busy, draft, notify])

  const handleShare = useCallback(async () => {
    if (busy) return
    if (typeof navigator.share !== 'function') {
      notify({ kind: 'error', message: 'この端末では共有できません' })
      return
    }
    setBusy(true)
    try {
      await navigator.share({ text: savedText })
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') return
      const msg = e instanceof Error ? e.message : String(e)
      notify({ kind: 'error', message: `共有失敗: ${msg}` })
    } finally {
      setBusy(false)
    }
  }, [busy, savedText, notify])

  const displayText = editing ? draft : savedText

  return (
    <div className="app">
      <header className="header">
        <h1>Muscle Memory</h1>
        <button
          type="button"
          className="icon-btn"
          onClick={handleShare}
          disabled={busy || editing}
          aria-label="共有"
        >
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M12 3v13" />
            <path d="M7 8l5-5 5 5" />
            <path d="M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7" />
          </svg>
        </button>
      </header>

      <textarea
        ref={textareaRef}
        className="editor"
        value={displayText}
        onChange={(e) => setDraft(e.target.value)}
        readOnly={!editing}
        spellCheck={false}
      />

      <div className="actions">
        {editing ? (
          <>
            <button
              type="button"
              className="btn btn-primary"
              onClick={handleEditSave}
              disabled={busy}
            >
              保存して終了
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={handleEditCancel}
              disabled={busy}
            >
              編集をキャンセル
            </button>
          </>
        ) : (
          <>
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
              onClick={handleRecord}
              disabled={busy}
            >
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M9 3h6a1 1 0 0 1 1 1v2H8V4a1 1 0 0 1 1-1z" />
                <path d="M8 6H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-2" />
                <path d="M9 14l2 2 4-4" />
              </svg>
              貼り付けて記録
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={handleEditStart}
              disabled={busy}
            >
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M12 20h9" />
                <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z" />
                <path d="M15 6l3 3" />
              </svg>
              手動で編集
            </button>
          </>
        )}
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
