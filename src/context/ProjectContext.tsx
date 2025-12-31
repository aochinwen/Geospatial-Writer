'use client'

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { createClient } from '@/utils/supabase/client'
import { User } from '@supabase/supabase-js'
import { Project, Feature } from '@/types'

type ProjectContextType = {
    user: User | null
    projects: Project[]
    activeProject: Project | null
    features: Feature[]
    loading: boolean
    setActiveProject: (project: Project | null) => void
    refreshFeatures: () => Promise<void>
    createProject: (name: string) => Promise<Project | null>
    deleteProject: (id: string) => Promise<void>
}

const ProjectContext = createContext<ProjectContextType | undefined>(undefined)

export function ProjectProvider({ children, initialUser }: { children: React.ReactNode, initialUser: User | null }) {
    const [user] = useState<User | null>(initialUser)
    const [projects, setProjects] = useState<Project[]>([])
    const [activeProject, setActiveProject] = useState<Project | null>(null)
    const [features, setFeatures] = useState<Feature[]>([])
    const [loading, setLoading] = useState(true)

    const supabase = React.useMemo(() => createClient(), [])

    const fetchProjects = useCallback(async () => {
        setLoading(true)
        const { data } = await supabase.from('projects').select('*').order('created_at', { ascending: false })
        if (data) setProjects(data)
        setLoading(false)
    }, [supabase])

    const fetchFeatures = useCallback(async (projectId: string) => {
        setLoading(true)
        const { data } = await supabase.from('features').select('*').eq('project_id', projectId)
        if (data) setFeatures(data)
        setLoading(false)
    }, [supabase])

    const refreshFeatures = useCallback(async () => {
        if (activeProject) {
            await fetchFeatures(activeProject.id)
        }
    }, [activeProject, fetchFeatures])

    useEffect(() => {
        if (user) {
            // eslint-disable-next-line react-hooks/set-state-in-effect
            fetchProjects()
        }
    }, [user, fetchProjects])

    useEffect(() => {
        if (activeProject) {
            // eslint-disable-next-line react-hooks/set-state-in-effect
            fetchFeatures(activeProject.id)
        } else {
            setFeatures([])
        }
    }, [activeProject, fetchFeatures])

    const createProject = async (name: string) => {
        if (!user) return null
        const { data } = await supabase
            .from('projects')
            .insert({ name, user_id: user.id })
            .select()
            .single()

        if (data) {
            setProjects([data, ...projects])
            setActiveProject(data)
            return data
        }
        return null
    }

    const deleteProject = async (id: string) => {
        const { error } = await supabase.from('projects').delete().eq('id', id)
        if (!error) {
            setProjects(prev => prev.filter(p => p.id !== id))
            if (activeProject?.id === id) {
                setActiveProject(null)
                setFeatures([])
            }
        }
    }

    return (
        <ProjectContext.Provider value={{ user, projects, activeProject, features, loading, setActiveProject, refreshFeatures, createProject, deleteProject }}>
            {children}
        </ProjectContext.Provider>
    )
}

export function useProject() {
    const context = useContext(ProjectContext)
    if (context === undefined) {
        throw new Error('useProject must be used within a ProjectProvider')
    }
    return context
}
