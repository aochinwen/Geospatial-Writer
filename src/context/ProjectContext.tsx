'use client'

import React, { createContext, useContext, useEffect, useState } from 'react'
import { createClient } from '@/utils/supabase/client'
import { User } from '@supabase/supabase-js'

type Feature = {
    id: string
    geometry: any
    properties: any
    project_id: string
}

type Project = {
    id: string
    name: string
    user_id: string
}

type ProjectContextType = {
    user: User | null
    projects: Project[]
    activeProject: Project | null
    features: Feature[]
    loading: boolean
    setActiveProject: (project: Project | null) => void
    refreshFeatures: () => Promise<void>
    createProject: (name: string) => Promise<Project | null>
}

const ProjectContext = createContext<ProjectContextType | undefined>(undefined)

export function ProjectProvider({ children, initialUser }: { children: React.ReactNode, initialUser: User | null }) {
    const [user, setUser] = useState<User | null>(initialUser)
    const [projects, setProjects] = useState<Project[]>([])
    const [activeProject, setActiveProject] = useState<Project | null>(null)
    const [features, setFeatures] = useState<Feature[]>([])
    const [loading, setLoading] = useState(true)

    const supabase = createClient()

    useEffect(() => {
        if (user) {
            fetchProjects()
        }
    }, [user])

    useEffect(() => {
        if (activeProject) {
            fetchFeatures(activeProject.id)
        } else {
            setFeatures([])
        }
    }, [activeProject])

    const fetchProjects = async () => {
        setLoading(true)
        const { data, error } = await supabase.from('projects').select('*').order('created_at', { ascending: false })
        if (data) setProjects(data)
        setLoading(false)
    }

    const fetchFeatures = async (projectId: string) => {
        setLoading(true)
        const { data, error } = await supabase.from('features').select('*').eq('project_id', projectId)
        if (data) setFeatures(data)
        setLoading(false)
    }

    const refreshFeatures = async () => {
        if (activeProject) {
            await fetchFeatures(activeProject.id)
        }
    }

    const createProject = async (name: string) => {
        if (!user) return null
        const { data, error } = await supabase
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

    return (
        <ProjectContext.Provider value={{ user, projects, activeProject, features, loading, setActiveProject, refreshFeatures, createProject }}>
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
