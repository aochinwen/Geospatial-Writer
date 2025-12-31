'use client'

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { createClient } from '@/utils/supabase/client'
import { FeatureTemplate } from '@/types'
import { toast } from 'sonner'
import { User } from '@supabase/supabase-js'

type TemplateContextType = {
    templates: FeatureTemplate[]
    loading: boolean
    createTemplate: (name: string, properties: Record<string, unknown>) => Promise<FeatureTemplate | undefined>
    deleteTemplate: (id: string) => Promise<void>
    refreshTemplates: () => Promise<void>
    user: User | null
}

const TemplateContext = createContext<TemplateContextType | undefined>(undefined)

export function TemplateProvider({ children, user }: { children: React.ReactNode, user: User | null }) {
    const [templates, setTemplates] = useState<FeatureTemplate[]>([])
    const [loading, setLoading] = useState(true)
    const supabase = React.useMemo(() => createClient(), [])

    const fetchTemplates = useCallback(async () => {
        if (!user) {
            setTemplates([])
            setLoading(false)
            return
        }

        try {
            setLoading(true)
            const { data, error } = await supabase
                .from('feature_templates')
                .select('*')
                .order('created_at', { ascending: false })

            if (error) throw error
            setTemplates(data || [])
        } catch (err) {
            console.error('Error fetching templates:', err)
            toast.error('Failed to load templates')
        } finally {
            setLoading(false)
        }
    }, [supabase, user])

    useEffect(() => {
        fetchTemplates()
    }, [fetchTemplates])

    const createTemplate = async (name: string, properties: Record<string, unknown>) => {
        if (!user) {
            toast.error('You must be logged in to create templates')
            return
        }

        try {
            const { data, error } = await supabase
                .from('feature_templates')
                .insert({
                    name,
                    properties,
                    user_id: user.id
                })
                .select()
                .single()

            if (error) throw error

            setTemplates(prev => [data, ...prev])
            toast.success('Template created')
            return data
        } catch (err) {
            console.error('Error creating template:', err)
            toast.error('Failed to create template')
            throw err
        }
    }

    const deleteTemplate = async (id: string) => {
        try {
            const { error } = await supabase
                .from('feature_templates')
                .delete()
                .eq('id', id)

            if (error) throw error

            setTemplates(prev => prev.filter(t => t.id !== id))
            toast.success('Template deleted')
        } catch (err) {
            console.error('Error deleting template:', err)
            toast.error('Failed to delete template')
        }
    }

    return (
        <TemplateContext.Provider value={{ templates, loading, createTemplate, deleteTemplate, refreshTemplates: fetchTemplates, user }}>
            {children}
        </TemplateContext.Provider>
    )
}

export function useTemplates() {
    const context = useContext(TemplateContext)
    if (context === undefined) {
        throw new Error('useTemplates must be used within a TemplateProvider')
    }
    return context
}
