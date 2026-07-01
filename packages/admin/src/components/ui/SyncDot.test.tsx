import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { SyncDot } from './SyncDot'

describe('SyncDot', () => {
  it('affiche un point orange quand pending=true', () => {
    const { container } = render(<SyncDot pending={true} />)
    const span = container.firstChild as HTMLElement
    expect(span).toHaveAttribute('title', 'En attente de synchronisation')
    expect(span.style.background).toBe('rgb(249, 115, 22)')
  })

  it('affiche un point vert quand pending=false', () => {
    const { container } = render(<SyncDot pending={false} />)
    const span = container.firstChild as HTMLElement
    expect(span).toHaveAttribute('title', 'Synchronisé')
    expect(span.style.background).toBe('rgb(34, 197, 94)')
  })
})
