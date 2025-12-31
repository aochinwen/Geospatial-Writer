'use client'

import React, { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useTemplates } from '@/hooks/useTemplates'
import { Trash2, Check, Plus, ArrowLeft } from 'lucide-react'

interface TemplateManagerProps {
    onApplyParams?: (properties: Record<string, any>) => void
    trigger?: React.ReactNode
}

export function TemplateManager({ onApplyParams, trigger }: TemplateManagerProps) {
    const { templates, loading, deleteTemplate, createTemplate } = useTemplates()
    const [open, setOpen] = useState(false)
    const [view, setView] = useState<'list' | 'create'>('list')

    // Create Form State
    const [newName, setNewName] = useState('')
    const [newAttributes, setNewAttributes] = useState<{ key: string, value: string }[]>([{ key: '', value: '' }])

    const handleCreate = async () => {
        if (!newName) return

        const props = newAttributes.reduce((acc, curr) => {
            if (curr.key.trim()) acc[curr.key.trim()] = curr.value
            return acc
        }, {} as Record<string, any>)

        await createTemplate(newName, props)
        // Reset and go back to list
        setView('list')
        setNewName('')
        setNewAttributes([{ key: '', value: '' }])
    }

    // Reset view when dialog closes
    const onOpenChange = (isOpen: boolean) => {
        setOpen(isOpen)
        if (!isOpen) {
            setTimeout(() => setView('list'), 300) // Small delay to avoid flicker during cloud
        }
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogTrigger asChild>
                {trigger || <Button variant="outline" size="sm">Manage Templates</Button>}
            </DialogTrigger>
            <DialogContent className="max-w-md max-h-[80vh] flex flex-col">
                <DialogHeader>
                    <DialogTitle>{view === 'list' ? 'Feature Templates' : 'New Template'}</DialogTitle>
                    <DialogDescription>
                        {view === 'list'
                            ? 'Manage your global feature templates here.'
                            : 'Define a new template schema from scratch.'}
                    </DialogDescription>
                </DialogHeader>

                <div className="flex-1 overflow-hidden flex flex-col">
                    {view === 'list' ? (
                        <>
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
                                    <div className="space-y-2 p-1">
                                        {templates.map(template => (
                                            <div key={template.id} className="flex flex-col border rounded-lg p-3 hover:bg-accent/50 transition-colors">
                                                <div className="flex items-center justify-between mb-2">
                                                    <span className="font-medium text-sm">{template.name}</span>
                                                    <div className="flex gap-2">
                                                        <Button size="icon" variant="ghost" className="h-6 w-6 text-destructive" onClick={(e) => {
                                                            e.stopPropagation()
                                                            if (confirm('Delete template?')) deleteTemplate(template.id)
                                                        }}>
                                                            <Trash2 className="h-3 w-3" />
                                                        </Button>
                                                        {onApplyParams && (
                                                            <Button size="sm" onClick={() => {
                                                                onApplyParams(template.properties)
                                                                setOpen(false)
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
                        </>
                    ) : (
                        <div className="flex-col flex h-full">
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
                    )}
                </div>
            </DialogContent>
        </Dialog>
    )
}


