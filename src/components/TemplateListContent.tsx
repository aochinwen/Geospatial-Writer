'use client'

import React, { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Trash2, Check, Plus, ArrowLeft, X } from 'lucide-react'
import { useTemplates } from '@/hooks/useTemplates'

interface TemplateListContentProps {
    onApplyParams?: (properties: Record<string, unknown>) => void
    onClose?: () => void
}

export function TemplateListContent({ onApplyParams, onClose }: TemplateListContentProps) {
    const { templates, loading, deleteTemplate, createTemplate, user } = useTemplates()
    const [view, setView] = useState<'list' | 'create'>('list')
    const [templateToDelete, setTemplateToDelete] = useState<string | null>(null)

    // Create Form State
    const [newName, setNewName] = useState('')
    const [newAttributes, setNewAttributes] = useState<{ key: string, value: string }[]>([{ key: '', value: '' }])

    const handleCreate = async () => {
        if (!newName) return

        const props = newAttributes.reduce((acc, curr) => {
            if (curr.key.trim()) acc[curr.key.trim()] = curr.value
            return acc
        }, {} as Record<string, unknown>)

        await createTemplate(newName, props)
        // Reset and go back to list
        setView('list')
        setNewName('')
        setNewAttributes([{ key: '', value: '' }])
    }

    if (view === 'create') {
        return (
            <div className="flex-col flex h-full">
                 <div className="flex items-center mb-4 md:hidden">
                    <Button variant="ghost" size="sm" onClick={() => setView('list')}>
                        <ArrowLeft className="h-4 w-4 mr-1" /> Back
                    </Button>
                    <span className="font-semibold ml-2">New Template</span>
                </div>
                <Input
                    placeholder="Template Name"
                    value={newName}
                    onChange={e => setNewName(e.target.value)}
                    className="mb-4"
                    autoFocus
                />
                <div className="flex-1 overflow-y-auto space-y-2 pr-2">
                    {newAttributes.map((attr, idx) => (
                        <div key={idx} className="flex gap-2 items-center">
                            <Input
                                placeholder="Key"
                                className="font-mono text-xs"
                                value={attr.key}
                                onChange={e => {
                                    const copy = [...newAttributes]
                                    copy[idx].key = e.target.value
                                    setNewAttributes(copy)
                                }}
                            />
                            <Input
                                placeholder="Default Value"
                                className="text-xs"
                                value={attr.value}
                                onChange={e => {
                                    const copy = [...newAttributes]
                                    copy[idx].value = e.target.value
                                    setNewAttributes(copy)
                                }}
                            />
                            <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive" onClick={() => {
                                if (newAttributes.length > 1) {
                                    setNewAttributes(newAttributes.filter((_, i) => i !== idx))
                                } else {
                                    setNewAttributes([{ key: '', value: '' }])
                                }
                            }}>
                                <Trash2 className="h-3 w-3" />
                            </Button>
                        </div>
                    ))}
                    <Button variant="outline" size="sm" className="w-full mt-2" onClick={() => setNewAttributes([...newAttributes, { key: '', value: '' }])}>
                        <Plus className="mr-2 h-3 w-3" /> Add Attribute
                    </Button>
                </div>
                <div className="mt-4 flex gap-2">
                    <Button variant="outline" className="flex-1" onClick={() => setView('list')}>
                        <ArrowLeft className="mr-2 h-3 w-3" /> Back
                    </Button>
                    <Button className="flex-1" onClick={handleCreate} disabled={!newName}>
                        Save Template
                    </Button>
                </div>
            </div>
        )
    }

    return (
        <div className="flex flex-col h-full">
            <div className="mb-4">
                <Button className="w-full" size="sm" onClick={() => setView('create')}>
                    <Plus className="mr-2 h-4 w-4" /> Create New Template
                </Button>
            </div>

            {loading ? (
                <div className="p-4 text-center text-sm text-muted-foreground">Loading...</div>
            ) : templates.length === 0 ? (
                <div className="p-8 text-center text-sm text-muted-foreground border-2 border-dashed rounded-lg m-2">
                    No templates found.
                </div>
            ) : (
                <div className="flex-1 overflow-y-auto pr-4">
                    {/* My Templates */}
                    {templates.some(t => t.user_id === user?.id) && (
                        <div className="mb-4">
                            <h3 className="text-xs font-semibold text-muted-foreground mb-2 px-1 uppercase tracking-wider">My Templates</h3>
                            <div className="space-y-2 p-1">
                                {templates.filter(t => t.user_id === user?.id).map(template => (
                                    <div key={template.id} className="flex flex-col border rounded-lg p-3 hover:bg-accent/50 transition-colors">
                                        <div className="flex items-center justify-between mb-2">
                                            <span className="font-medium text-sm">{template.name}</span>
                                            <div className="flex gap-2">
                                                {templateToDelete === template.id ? (
                                                    <div className="flex items-center gap-1 bg-destructive/10 rounded px-1">
                                                        <span className="text-[10px] text-destructive font-semibold px-1">Confirm?</span>
                                                        <Button size="icon" variant="ghost" className="h-6 w-6 text-destructive hover:bg-destructive/20" onClick={(e) => {
                                                            e.stopPropagation()
                                                            deleteTemplate(template.id)
                                                            setTemplateToDelete(null)
                                                        }}>
                                                            <Check className="h-3 w-3" />
                                                        </Button>
                                                        <Button size="icon" variant="ghost" className="h-6 w-6 text-muted-foreground hover:text-foreground" onClick={(e) => {
                                                            e.stopPropagation()
                                                            setTemplateToDelete(null)
                                                        }}>
                                                            <X className="h-3 w-3" />
                                                        </Button>
                                                    </div>
                                                ) : (
                                                    <Button size="icon" variant="ghost" className="h-6 w-6 text-muted-foreground hover:text-destructive" onClick={(e) => {
                                                        e.stopPropagation()
                                                        setTemplateToDelete(template.id)
                                                    }}>
                                                        <Trash2 className="h-3 w-3" />
                                                    </Button>
                                                )}
                                                {onApplyParams && (
                                                    <Button size="sm" onClick={() => {
                                                        onApplyParams(template.properties)
                                                        if (onClose) onClose()
                                                    }}>
                                                        <Check className="mr-2 h-3 w-3" /> Apply
                                                    </Button>
                                                )}
                                            </div>
                                        </div>
                                        <div className="text-xs text-muted-foreground font-mono bg-muted p-2 rounded max-h-20 overflow-hidden text-ellipsis">
                                            {Object.entries(template.properties).map(([k, v]) => (
                                                <div key={k} className="truncate">{k}: {String(v)}</div>
                                            ))}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Other Templates */}
                    {templates.some(t => t.user_id !== user?.id) && (
                        <div>
                            <h3 className="text-xs font-semibold text-muted-foreground mb-2 px-1 uppercase tracking-wider">Shared Templates</h3>
                            <div className="space-y-2 p-1">
                                {templates.filter(t => t.user_id !== user?.id).map(template => (
                                    <div key={template.id} className="flex flex-col border rounded-lg p-3 hover:bg-accent/50 transition-colors opacity-90">
                                        <div className="flex items-center justify-between mb-2">
                                            <div className="flex flex-col">
                                                <span className="font-medium text-sm">{template.name}</span>
                                                <span className="text-[10px] text-muted-foreground">by others</span>
                                            </div>
                                            <div className="flex gap-2">
                                                {onApplyParams && (
                                                    <Button size="sm" variant="secondary" onClick={() => {
                                                        onApplyParams(template.properties)
                                                        if (onClose) onClose()
                                                    }}>
                                                        <Check className="mr-2 h-3 w-3" /> Apply
                                                    </Button>
                                                )}
                                            </div>
                                        </div>
                                        <div className="text-xs text-muted-foreground font-mono bg-muted p-2 rounded max-h-20 overflow-hidden text-ellipsis">
                                            {Object.entries(template.properties).map(([k, v]) => (
                                                <div key={k} className="truncate">{k}: {String(v)}</div>
                                            ))}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    )
}
