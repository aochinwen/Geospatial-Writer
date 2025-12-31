'use client'

import React, { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogTrigger } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Plus } from 'lucide-react'

interface SaveTemplateDialogProps {
    properties: Record<string, any>
    onSave: (name: string, props: Record<string, any>) => Promise<void>
    trigger?: React.ReactNode
}

export function SaveTemplateDialog({ properties, onSave, trigger }: SaveTemplateDialogProps) {
    const [open, setOpen] = useState(false)
    const [name, setName] = useState('')
    const [saving, setSaving] = useState(false)
    const [includeValues, setIncludeValues] = useState(false)

    const handleSave = async () => {
        if (!name) return
        setSaving(true)

        const propsToSave = includeValues
            ? properties
            : Object.keys(properties).reduce((acc, key) => ({ ...acc, [key]: '' }), {})

        await onSave(name, propsToSave)
        setSaving(false)
        setOpen(false)
        setName('')
        setIncludeValues(false)
    }

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                {trigger || (
                    <Button variant="outline" size="sm" className="w-full flex-1">
                        <Plus className="mr-2 h-3 w-3" /> Save as Template
                    </Button>
                )}
            </DialogTrigger>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Save New Template</DialogTitle>
                    <DialogDescription>
                        Create a reusable template from this feature's attributes.
                    </DialogDescription>
                </DialogHeader>
                <div className="py-4 space-y-4">
                    <div className="text-xs text-muted-foreground bg-muted p-2 rounded">
                        Saving {Object.keys(properties).length} attributes
                    </div>
                    <Input
                        placeholder="Template Name (e.g., Park Bench Standard)"
                        value={name}
                        onChange={e => setName(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && handleSave()}
                        autoFocus
                    />
                    <div className="flex items-center gap-2">
                        <input
                            type="checkbox"
                            id="includeValues"
                            checked={includeValues}
                            onChange={e => setIncludeValues(e.target.checked)}
                            className="rounded border-gray-300 text-primary focus:ring-primary"
                        />
                        <label htmlFor="includeValues" className="text-sm text-muted-foreground cursor-pointer select-none">
                            Keep values (default is keys only)
                        </label>
                    </div>
                </div>
                <DialogFooter>
                    <Button onClick={handleSave} disabled={saving || !name}>
                        {saving ? 'Saving...' : 'Save Template'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
