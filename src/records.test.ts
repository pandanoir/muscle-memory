import { describe, expect, it } from 'vitest'
import { extractEntries, isValidIncoming, mergeIntoContent } from './records'

const PROMPT = `これは筋トレの記録です。
説明文の途中に - name: なども現れないはず。

=====

records:
`

const record0808 = `  - date: 2026-08-08
    exercises:
      - name: ベンチプレス
        weight: 20kg/手
        reps: [15, 15, 10]
`

const record0809 = `  - date: 2026-08-09
    exercises:
      - name: ワンハンドダンベルローイング
        weight: 26kg/手
        reps: [12, 12, 12]
`

const record0808_extraExercise = `  - date: 2026-08-08
    exercises:
      - name: ダンベルフライ
        weight: 10kg/手
        reps: [12, 12, 12]
`

const record0808_updated = `  - date: 2026-08-08
    exercises:
      - name: ベンチプレス
        weight: 22kg/手
        reps: [12, 12, 10]
`

describe('isValidIncoming', () => {
  it('正常な日付ブロックはtrue', () => {
    expect(isValidIncoming(record0808)).toBe(true)
  })

  it('日付が無いテキストはfalse', () => {
    expect(isValidIncoming('   ')).toBe(false)
    expect(isValidIncoming('メニュー: ベンチプレス 20kg 10回')).toBe(false)
  })

  it('日付はあるが種目が無ければfalse', () => {
    expect(isValidIncoming('  - date: 2026-08-08\n    exercises:\n')).toBe(false)
  })

  it('日付フォーマットが違えばfalse', () => {
    expect(isValidIncoming('  - date: 08/08\n    exercises:\n      - name: X\n')).toBe(false)
  })
})

describe('mergeIntoContent - プロンプト保護', () => {
  it('プロンプトは常に保存されたまま', () => {
    const base = PROMPT
    const merged = mergeIntoContent(base, record0808)
    expect(merged.startsWith('これは筋トレの記録です。')).toBe(true)
    expect(merged.includes('=====')).toBe(true)
  })

  it('既に記録があってもプロンプトは残る', () => {
    const base = mergeIntoContent(PROMPT, record0808)
    const merged = mergeIntoContent(base, record0809)
    expect(merged.startsWith('これは筋トレの記録です。')).toBe(true)
    expect(merged.includes('=====')).toBe(true)
  })
})

describe('mergeIntoContent - 追記・置換ロジック', () => {
  it('新しい日付は末尾に追記される', () => {
    const base = mergeIntoContent(PROMPT, record0808)
    const merged = mergeIntoContent(base, record0809)
    expect(merged.includes('date: 2026-08-08')).toBe(true)
    expect(merged.includes('date: 2026-08-09')).toBe(true)
    expect(merged.indexOf('2026-08-08')).toBeLessThan(merged.indexOf('2026-08-09'))
  })

  it('同一日付・新種目は追記される', () => {
    const base = mergeIntoContent(PROMPT, record0808)
    const merged = mergeIntoContent(base, record0808_extraExercise)
    expect(merged.includes('name: ベンチプレス')).toBe(true)
    expect(merged.includes('name: ダンベルフライ')).toBe(true)
    // 同一日付なので2026-08-08は1回のみ
    expect(merged.match(/date: 2026-08-08/g)?.length).toBe(1)
  })

  it('同一日付・同一種目は置換される', () => {
    const base = mergeIntoContent(PROMPT, record0808)
    const merged = mergeIntoContent(base, record0808_updated)
    expect(merged.match(/date: 2026-08-08/g)?.length).toBe(1)
    expect(merged.match(/name: ベンチプレス/g)?.length).toBe(1)
    expect(merged.includes('weight: 22kg/手')).toBe(true)
    expect(merged.includes('weight: 20kg/手')).toBe(false)
  })

  it('同じ記録を2回貼っても重複しない', () => {
    const base = mergeIntoContent(PROMPT, record0808)
    const merged = mergeIntoContent(base, record0808)
    expect(merged.match(/date: 2026-08-08/g)?.length).toBe(1)
    expect(merged.match(/name: ベンチプレス/g)?.length).toBe(1)
  })

  it('プロンプトが壊れていた（=====欠損）状態からでもプロンプトは失われずマージされる', () => {
    // 前のバグで壊れた記録だけの状態
    const broken = `records:\n${record0808}`
    const merged = mergeIntoContent(broken, record0809)
    // records部の情報は保持
    expect(merged.includes('date: 2026-08-08')).toBe(true)
    expect(merged.includes('date: 2026-08-09')).toBe(true)
  })

  it('extractEntries: weight/repsをパースし日付昇順で返す', () => {
    let content = PROMPT
    content = mergeIntoContent(content, record0809)
    content = mergeIntoContent(content, record0808)
    const entries = extractEntries(content)
    expect(entries.map((e) => e.date)).toEqual(['2026-08-08', '2026-08-09'])
    const bench = entries[0].exercises[0]
    expect(bench.name).toBe('ベンチプレス')
    expect(bench.weight).toBe(20)
    expect(bench.weightRaw).toBe('20kg/手')
    expect(bench.reps).toEqual([15, 15, 10])
    const row = entries[1].exercises[0]
    expect(row.weight).toBe(26)
    expect(row.reps).toEqual([12, 12, 12])
  })

  it('連続追記で余計な重複が発生しない', () => {
    let content = PROMPT
    content = mergeIntoContent(content, record0808)
    content = mergeIntoContent(content, record0808)
    content = mergeIntoContent(content, record0808)
    content = mergeIntoContent(content, record0809)
    expect(content.match(/date: 2026-08-08/g)?.length).toBe(1)
    expect(content.match(/date: 2026-08-09/g)?.length).toBe(1)
    expect(content.match(/name: ベンチプレス/g)?.length).toBe(1)
  })
})
