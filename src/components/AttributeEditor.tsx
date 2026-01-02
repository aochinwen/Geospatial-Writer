'use client'

import React, { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Plus, Trash, Save } from 'lucide-react'
import { toast } from 'sonner'
import { useTemplates } from '@/hooks/useTemplates'
import {
    Select,
    SelectContent,
    SelectGroup,
    SelectItem,
    SelectLabel,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"

import { Geometry } from '@/types'

export type KeyValue = {
    key: string
    value: string
}

interface AttributeEditorProps {
    featureId: string
    initialProperties: Record<string, unknown>
    featureGeometry?: Geometry // GeoJSON Geometry
    onSave: (id: string, properties: Record<string, unknown>) => Promise<void>
    onDelete?: () => void
    onCreateAnother: (geometryType: string, currentProps: Record<string, unknown>) => void
    onClose: () => void
}

export default function AttributeEditor({ featureId, initialProperties, featureGeometry, onSave, onDelete, onClose, onCreateAnother }: AttributeEditorProps) {
    const [attributes, setAttributes] = useState<KeyValue[]>(() =>
        Object.entries(initialProperties).map(([key, value]) => ({
            key,
            value: String(value)
        }))
    )
    const { templates, user } = useTemplates()
    const [showUnsavedAlert, setShowUnsavedAlert] = useState(false)
    const [selectedTemplate, setSelectedTemplate] = useState<string>('')
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
    const [isSaving, setIsSaving] = useState(false)

    // Helper to check dirtiness
    const checkDirty = (currentAttrs: KeyValue[], initialProps: Record<string, unknown>) => {
        const currentObj: Record<string, string> = {};
        currentAttrs.forEach(a => { if (a.key.trim()) currentObj[a.key] = a.value });

        const initialObj: Record<string, string> = {};
        Object.entries(initialProps).forEach(([k, v]) => initialObj[k] = String(v));

        if (Object.keys(currentObj).length !== Object.keys(initialObj).length) return true;
        for (const key in currentObj) {
            if (currentObj[key] !== initialObj[key]) return true;
        }
        return false;
    };

    const isDirty = checkDirty(attributes, initialProperties);

    const handleChange = (index: number, field: 'key' | 'value', value: string) => {
        const newAttrs = [...attributes]
        newAttrs[index][field] = value
        setAttributes(newAttrs)
    }

    const handleSave = async () => {
        setIsSaving(true)
        try {
            const props: Record<string, unknown> = {}
            for (const attr of attributes) {
                if (!attr.key.trim()) continue
                props[attr.key] = attr.value
            }
            await onSave(featureId, props)
        } finally {
            setIsSaving(false)
        }
    }

    const handleApplyTemplate = (templateId: string) => {
        const template = templates.find(t => t.id === templateId)
        if (!template) return

        setSelectedTemplate(templateId)

        const newAttrs = [...attributes];
        // Merge props: update if exists, append if not
        Object.entries(template.properties).forEach(([k, v]) => {
            const existing = newAttrs.find(a => a.key === k);
            if (existing) {
                existing.value = String(v);
            } else {
                newAttrs.push({ key: k, value: String(v) });
            }
        });
        setAttributes(newAttrs);
        toast.success(`Template "${template.name}" applied`)
    }

    // Proceed to create another feature
    // saveCurrent: if true, saves the current feature first
    const proceedCreateAnother = async (saveCurrent: boolean) => {
        if (saveCurrent) {
            await handleSave();
        }

        // Prep props for next feature (using current keys)
        const props: Record<string, unknown> = {}
        for (const attr of attributes) {
            if (!attr.key.trim()) continue
            props[attr.key] = '' // Reset values for new feature, keep keys
        }

        if (featureGeometry?.type) {
            onCreateAnother(featureGeometry.type, props)
        } else {
            toast.error("Unknown geometry type")
        }
        setShowUnsavedAlert(false);
    };

    const handleCreateAnotherClick = () => {
        if (isDirty) {
            setShowUnsavedAlert(true);
        } else {
            proceedCreateAnother(false);
        }
    };

    // Geometry Helper
    const getGeometryInfo = () => {
        if (!featureGeometry) return null;
        const type = featureGeometry.type;
        let details = '';
        if (type === 'Point') {
            const [lng, lat] = featureGeometry.coordinates as number[];
            details = `Lat: ${lat.toFixed(5)}, Lng: ${lng.toFixed(5)}`;
        } else if (type === 'LineString') {
            details = `${(featureGeometry.coordinates as number[][]).length} points`;
        } else if (type === 'Polygon') {
            details = `${(featureGeometry.coordinates as number[][][])[0].length} points (closed)`;
        }
        return { type, details };
    }

    const geoInfo = getGeometryInfo();

    const myTemplates = templates.filter(t => t.user_id === user?.id)
    const sharedTemplates = templates.filter(t => t.user_id !== user?.id)

    return (
        <div className="h-full flex flex-col">
            <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-semibold">Feature Attributes</h3>
                <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={onClose}>&times;</Button>
            </div>

            <div className="text-xs text-muted-foreground mb-4 font-mono bg-muted/30 p-1.5 rounded select-all truncate">
                ID: {featureId}
            </div>

            {geoInfo && (
                <div className="bg-muted/50 p-2 rounded mb-4 text-xs space-y-1">
                    <div className="flex justify-between">
                        <span className="font-medium text-muted-foreground">Type:</span>
                        <span>{geoInfo.type}</span>
                    </div>
                    <div className="flex justify-between">
                        <span className="font-medium text-muted-foreground">Location:</span>
                        <span className="truncate max-w-[150px]" title={geoInfo.details}>{geoInfo.details}</span>
                    </div>
                </div>
            )}

            <div className="space-y-3 flex-1 overflow-y-auto">
                {attributes.map((attr, index) => (
                    <div key={index} className="flex gap-2 items-center">
                        <Input
                            placeholder="Key"
                            className="h-8 text-xs font-mono bg-muted/50"
                            value={attr.key}
                            readOnly
                        />
                        <Input
                            placeholder="Value"
                            className="h-8 text-xs"
                            value={attr.value}
                            onChange={(e) => handleChange(index, 'value', e.target.value)}
                        />
                    </div>
                ))}
            </div>

            <div className="pt-4 mt-4 border-t space-y-2">
                {/* Template Selection */}
                <div className="flex flex-col gap-1">
                    <span className="text-[10px] uppercase font-semibold text-muted-foreground ml-1">Load Template</span>
                    <Select value={selectedTemplate} onValueChange={handleApplyTemplate}>
                        <SelectTrigger className="h-8 text-xs w-full">
                            <SelectValue placeholder="Select a template..." />
                        </SelectTrigger>
                        <SelectContent>
                            {myTemplates.length > 0 && (
                                <SelectGroup>
                                    <SelectLabel>My Templates</SelectLabel>
                                    {myTemplates.map(t => (
                                        <SelectItem key={t.id} value={t.id} className="text-xs">
                                            {t.name}
                                        </SelectItem>
                                    ))}
                                </SelectGroup>
                            )}
                            {sharedTemplates.length > 0 && (
                                <SelectGroup>
                                    <SelectLabel>Shared Templates</SelectLabel>
                                    {sharedTemplates.map(t => (
                                        <SelectItem key={t.id} value={t.id} className="text-xs">
                                            {t.name}
                                        </SelectItem>
                                    ))}
                                </SelectGroup>
                            )}
                            {templates.length === 0 && (
                                <div className="p-2 text-xs text-muted-foreground text-center">No templates available</div>
                            )}
                        </SelectContent>
                    </Select>
                    {selectedTemplate && (
                        <div className="text-[10px] text-muted-foreground px-1">
                            Applied: <span className="font-medium text-foreground">{templates.find(t => t.id === selectedTemplate)?.name}</span>
                        </div>
                    )}
                </div>

                <Button onClick={handleSave} size="sm" className="w-full" disabled={!isDirty || isSaving}>
                    <Save className="mr-2 h-3 w-3" /> {isSaving ? 'Saving...' : 'Save Changes'}
                </Button>


                <Button
                    variant="secondary"
                    size="sm"
                    className="w-full"
                    onClick={handleCreateAnotherClick}
                >
                    <Plus className="mr-2 h-3 w-3" /> Create Another {featureGeometry?.type}
                </Button>

                {onDelete && (
                    <>
                        <Button onClick={() => setShowDeleteConfirm(true)} variant="destructive" size="sm" className="w-full">
                            <Trash className="mr-2 h-3 w-3" /> Delete Feature
                        </Button>
                    </>
                )}
            </div>

            {/* Delete Dialog */}
            {onDelete && (
                <Dialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>Delete Feature?</DialogTitle>
                            <DialogDescription>
                                Are you sure you want to delete this feature? This action cannot be undone.
                            </DialogDescription>
                        </DialogHeader>
                        <DialogFooter>
                            <Button variant="outline" onClick={() => setShowDeleteConfirm(false)}>Cancel</Button>
                            <Button variant="destructive" onClick={() => {
                                onDelete();
                                setShowDeleteConfirm(false);
                            }}>Delete</Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            )}

            {/* Unsaved Changes Alert Dialog */}
            <Dialog open={showUnsavedAlert} onOpenChange={setShowUnsavedAlert}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Unsaved Changes</DialogTitle>
                        <DialogDescription>
                            You have unsaved changes to this feature. Do you want to save them before creating another feature?
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter className="sm:justify-between gap-2">
                        <div className="flex gap-2">
                            <Button variant="secondary" onClick={() => setShowUnsavedAlert(false)}>Cancel</Button>
                            <Button variant="destructive" onClick={() => proceedCreateAnother(false)}>Discard & Continue</Button>
                        </div>
                        <Button onClick={() => proceedCreateAnother(true)}>Save & Continue</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    )
}

