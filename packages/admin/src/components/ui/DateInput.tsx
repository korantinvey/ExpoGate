import { useState, useRef, useEffect } from 'react'
import { DayPicker } from 'react-day-picker'
import { fr } from 'react-day-picker/locale'
import 'react-day-picker/style.css'
import './DateInput.css'

function toDisplay(iso: string): string {
  if (!iso) return ''
  const [y, m, d] = iso.split('-')
  if (!y || !m || !d) return ''
  return `${d}/${m}/${y}`
}

function toIso(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function fromIso(iso: string): Date | undefined {
  if (!iso) return undefined
  const [y, m, d] = iso.split('-').map(Number)
  if (!y || !m || !d) return undefined
  return new Date(y, m - 1, d)
}

interface DateInputProps {
  value: string
  onChange: (isoDate: string) => void
  placeholder?: string
  defaultMonth?: string
}

export function DateInput({ value, onChange, placeholder = 'JJ/MM/AAAA', defaultMonth }: DateInputProps) {
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState({ top: 0, left: 0 })
  const inputRef = useRef<HTMLDivElement>(null)
  const selected = fromIso(value)

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (inputRef.current && !inputRef.current.contains(e.target as Node)) {
        const picker = document.getElementById('rdp-popover')
        if (!picker || !picker.contains(e.target as Node)) setOpen(false)
      }
    }
    if (open) document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open])

  function handleOpen() {
    if (inputRef.current) {
      const rect = inputRef.current.getBoundingClientRect()
      setPos({ top: rect.bottom + 4, left: rect.left })
    }
    setOpen(o => !o)
  }

  function handleSelect(date: Date | undefined) {
    if (date) { onChange(toIso(date)); setOpen(false) }
  }

  return (
    <>
      <div ref={inputRef} style={{ position: 'relative' }}>
        <input
          readOnly
          value={toDisplay(value)}
          placeholder={placeholder}
          onClick={handleOpen}
          style={{ cursor: 'pointer', paddingRight: 32 }}
        />
        <span style={{
          position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
          pointerEvents: 'none', color: 'var(--text-muted)', fontSize: 15,
        }}>📅</span>
      </div>

      {open && (
        <div
          id="rdp-popover"
          style={{
            position: 'fixed',
            top: pos.top,
            left: pos.left,
            zIndex: 9999,
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 8,
            boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
            padding: '4px 6px 6px',
          }}
        >
          <DayPicker
            mode="single"
            selected={selected}
            onSelect={handleSelect}
            defaultMonth={selected ?? fromIso(defaultMonth ?? '') ?? new Date()}
            locale={fr}
            weekStartsOn={1}
          />
        </div>
      )}
    </>
  )
}
