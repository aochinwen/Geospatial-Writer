import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { ProjectProvider, useProject } from '../ProjectContext'
import React from 'react'

// Mock Supabase client
const mockSelect = vi.fn()
const mockOrder = vi.fn()
const mockEq = vi.fn()
const mockInsert = vi.fn()
const mockDelete = vi.fn()
const mockSingle = vi.fn()

const mockSupabase = {
    from: vi.fn(() => ({
        select: mockSelect,
        insert: mockInsert,
        delete: mockDelete,
    })),
}

// Chain mocks
mockSelect.mockReturnValue({ order: mockOrder, eq: mockEq })
mockOrder.mockReturnValue(Promise.resolve({ data: [], error: null }))
mockEq.mockReturnValue(Promise.resolve({ data: [], error: null }))
mockInsert.mockReturnValue({ select: () => ({ single: mockSingle }) })
mockSingle.mockReturnValue(Promise.resolve({ data: null, error: null }))
mockDelete.mockReturnValue({ eq: () => Promise.resolve({ error: null }) })


vi.mock('@/utils/supabase/client', () => ({
    createClient: () => mockSupabase
}))

// Test Component to consume context
const TestComponent = () => {
    const { projects, loading, createProject, features } = useProject()
    return (
        <div>
            {loading && <div>Loading...</div>}
            <ul>
                {projects.map(p => <li key={p.id}>{p.name}</li>)}
            </ul>
            <button onClick={() => createProject("New Project")}>Create</button>
            <div data-testid="features-count">{features.length}</div>
        </div>
    )
}

describe('ProjectContext', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mockUser = { id: 'user-123', email: 'test@example.com' } as any

    beforeEach(() => {
        vi.clearAllMocks()
        // Default mocks
        mockOrder.mockResolvedValue({ data: [{ id: 'p1', name: 'Project 1' }], error: null })
    })

    it('fetches projects on mount', async () => {
        render(
            <ProjectProvider initialUser={mockUser}>
                <TestComponent />
            </ProjectProvider>
        )

        expect(screen.getByText('Loading...')).toBeDefined()

        await waitFor(() => {
            expect(screen.getByText('Project 1')).toBeDefined()
        })

        expect(mockSupabase.from).toHaveBeenCalledWith('projects')
        expect(mockSelect).toHaveBeenCalled()
    })
})
