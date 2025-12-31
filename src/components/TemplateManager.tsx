'use client'

import React, { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Plus, Trash2, Search } from 'lucide-react'
import { useTemplates } from '@/hooks/useTemplates'

interface TemplateManagerProps {
    onApplyParams?: (properties: Record<string, unknown>) => void
    trigger?: React.ReactNode
}

export function TemplateManager({ onApplyParams, trigger }: TemplateManagerProps) {
    const { templates, deleteTemplate, createTemplate, user } = useTemplates()
    const [search, setSearch] = useState('')
    const [view, setView] = useState<'list' | 'create'>('list')

    // Create Form State
    const [newName, setNewName] = useState('')

    const filteredTemplates = templates.filter(t =>
        t.name.toLowerCase().includes(search.toLowerCase())
    )

    // Better State for Editor
    const [editorRows, setEditorRows] = useState<{ key: string, value: string }[]>([{ key: '', value: '' }])

    const handleEditorChange = (index: number, field: 'key' | 'value', val: string) => {
        const rows = [...editorRows]
        rows[index][field] = val
        setEditorRows(rows)
    }

    const saveFromRows = async () => {
        if (!newName.trim()) return

        const props: Record<string, unknown> = {}
        editorRows.forEach(r => {
            if (r.key.trim()) props[r.key] = r.value
        })

        try {
            await createTemplate(newName, props)
            setView('list')
            setNewName('')
            setEditorRows([{ key: '', value: '' }])
        } catch (err) {
            console.error(err)
        }
    }


    return (
        <Dialog>
            <DialogTrigger asChild>
                {trigger}
            </DialogTrigger>
            <DialogContent className="max-w-3xl max-h-[80vh] flex flex-col">
                <DialogHeader>
                    <DialogTitle>Template Library</DialogTitle>
                    <DialogDescription>Manage and apply feature templates.</DialogDescription>
                </DialogHeader>

                <div className="flex gap-4 h-full min-h-[400px]">
                    {/* Left: List */}
                    <div className="w-1/3 flex flex-col gap-2 border-r pr-4">
                        <div className="relative">
                            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                            <Input
                                placeholder="Search templates..."
                                className="pl-8"
                                value={search}
                                onChange={e => setSearch(e.target.value)}
                            />
                        </div>
                        <Button className="w-full justify-start" variant="outline" onClick={() => setView('create')}>
                            <Plus className="mr-2 h-4 w-4" /> New Template
                        </Button>
                        <div className="flex-1 overflow-y-auto">
                            <div className="space-y-2 pr-2">
                                {filteredTemplates.map(t => (
                                    <div
                                        key={t.id}
                                        className="p-2 border rounded hover:bg-muted group relative cursor-pointer"
                                        onClick={() => {
                                            if (onApplyParams) onApplyParams(t.properties)
                                        }}
                                    >
                                        <div className="font-medium text-sm">{t.name}</div>
                                        <div className="text-xs text-muted-foreground">{Object.keys(t.properties).length} properties</div>
                                        {user?.id === t.user_id && (
                                            <Button
                                                variant="destructive"
                                                size="icon"
                                                className="h-6 w-6 absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity"
                                                onClick={(e) => {
                                                    e.stopPropagation()
                                                    if (confirm('Delete template?')) deleteTemplate(t.id)
                                                }}
                                            >
                                                <Trash2 className="h-3 w-3" />
                                            </Button>
                                        )}
                                        {user?.id !== t.user_id && (
                                            <span className="absolute top-2 right-2 text-[10px] inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80">
                                                Shared
                                            </span>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Right: Preview / Create */}
                    <div className="flex-1 pl-2">
                        {view === 'create' ? (
                            <div className="space-y-4">
                                <h4 className="font-semibold">Create New Template</h4>
                                <div className="space-y-1">
                                    <label className="text-xs font-medium">Template Name</label>
                                    <Input value={newName} onChange={e => setNewName(e.target.value)} placeholder="e.g. Park Bench" />
                                </div>
                                <div className="space-y-2">
                                    <div className="flex justify-between items-center">
                                        <label className="text-xs font-medium">Default Properties</label>
                                        <Button size="sm" variant="ghost" onClick={() => setEditorRows([...editorRows, { key: '', value: '' }])}>
                                            <Plus className="h-3 w-3 mr-1" /> Add Field
                                        </Button>
                                    </div>
                                    <div className="border rounded p-2 max-h-[300px] overflow-y-auto space-y-2">
                                        {editorRows.map((row, i) => (
                                            <div key={i} className="flex gap-2">
                                                <Input
                                                    placeholder="Key"
                                                    className="h-8 text-xs font-mono"
                                                    value={row.key}
                                                    onChange={e => handleEditorChange(i, 'key', e.target.value)}
                                                />
                                                <Input
                                                    placeholder="Default Value"
                                                    className="h-8 text-xs"
                                                    value={row.value}
                                                    onChange={e => handleEditorChange(i, 'value', e.target.value)}
                                                />
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-8 w-8 text-muted-foreground hover:text-destructive"
                                                    onClick={() => {
                                                        const newRows = [...editorRows]
                                                        newRows.splice(i, 1)
                                                        setEditorRows(newRows)
                                                    }}
                                                >
                                                    <Trash2 className="h-3 w-3" />
                                                </Button>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                                <div className="flex justify-end gap-2 pt-4">
                                    <Button variant="ghost" onClick={() => setView('list')}>Cancel</Button>
                                    <Button onClick={saveFromRows} disabled={!newName.trim()}>Save Template</Button>
                                </div>
                            </div>
                        ) : (
                            <div className="h-full flex items-center justify-center text-muted-foreground text-sm">
                                Select a template to view details or create a new one.
                            </div>
                        )}
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    )
}
