'use client'

import React, { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { TemplateListContent } from './TemplateListContent'

interface TemplateManagerProps {
    onApplyParams?: (properties: Record<string, unknown>) => void
    trigger?: React.ReactNode
}

export function TemplateManager({ onApplyParams, trigger }: TemplateManagerProps) {
    const [open, setOpen] = useState(false)

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                {trigger || <Button variant="outline" size="sm">Manage Templates</Button>}
            </DialogTrigger>
            <DialogContent className="max-w-md max-h-[80vh] flex flex-col">
                <DialogHeader>
                    <DialogTitle>Feature Templates</DialogTitle>
                    <DialogDescription>
                        Manage your global feature templates here.
                    </DialogDescription>
                </DialogHeader>

                <div className="flex-1 overflow-hidden flex flex-col">
                    <TemplateListContent onApplyParams={onApplyParams} onClose={() => setOpen(false)} />
                </div>
            </DialogContent>
        </Dialog>
    )
}


