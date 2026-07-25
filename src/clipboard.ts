export async function writeClipboard(text: string): Promise<void> {
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text)
      return
    } catch {
      // fall through to legacy method
    }
  }
  legacyCopy(text)
}

export async function readClipboard(): Promise<string> {
  if (navigator.clipboard?.readText) {
    return await navigator.clipboard.readText()
  }
  throw new Error(
    'このブラウザではペースト操作ができません。テキストエリアに手動で貼り付けてください。',
  )
}

function legacyCopy(text: string): void {
  const ta = document.createElement('textarea')
  ta.value = text
  ta.setAttribute('readonly', '')
  ta.style.position = 'fixed'
  ta.style.top = '0'
  ta.style.left = '0'
  ta.style.opacity = '0'
  document.body.appendChild(ta)
  ta.focus()
  ta.select()
  ta.setSelectionRange(0, text.length)
  const ok = document.execCommand('copy')
  document.body.removeChild(ta)
  if (!ok) throw new Error('copy command was rejected')
}
