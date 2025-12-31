'use client'

import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Plus, Trash, Save } from 'lucide-react'
import { toast } from 'sonner'

export type KeyValue = {
    key: string
    value: string
}

interface AttributeEditorProps {
    featureId: string
    initialProperties: Record<string, any>
    featureGeometry?: any // GeoJSON Geometry
    onSave: (id: string, properties: Record<string, any>) => void
    onClose: () => void
}

export default function AttributeEditor({ featureId, initialProperties, featureGeometry, onSave, onClose }: AttributeEditorProps) {
    const [attributes, setAttributes] = useState<KeyValue[]>([])

    useEffect(() => {
        const attrs = Object.entries(initialProperties).map(([key, value]) => ({
            key,
            value: String(value)
        }))
        setAttributes(attrs)
    }, [initialProperties, featureId])

    const handleAdd = () => {
        setAttributes([...attributes, { key: '', value: '' }])
    }

    const handleDelete = (index: number) => {
        const newAttrs = [...attributes]
        newAttrs.splice(index, 1)
        setAttributes(newAttrs)
    }

    const handleChange = (index: number, field: 'key' | 'value', value: string) => {
        const newAttrs = [...attributes]
        newAttrs[index][field] = value
        setAttributes(newAttrs)
    }

    const handleSave = () => {
        const props: Record<string, any> = {}
        for (const attr of attributes) {
            if (!attr.key.trim()) continue
            props[attr.key] = attr.value
        }
        onSave(featureId, props)
        // toast moved to parent for async success accuracy
    }

    // Geometry Helper
    const getGeometryInfo = () => {
        if (!featureGeometry) return null;
        const type = featureGeometry.type;
        let details = '';
        if (type === 'Point') {
            const [lng, lat] = featureGeometry.coordinates;
            details = `Lat: ${lat.toFixed(5)}, Lng: ${lng.toFixed(5)}`;
        } else if (type === 'LineString') {
            details = `${featureGeometry.coordinates.length} points`; // Maybe show first/last?
        } else if (type === 'Polygon') {
            details = `${featureGeometry.coordinates[0].length} points (closed)`;
        }
        return { type, details };
    }

    const geoInfo = getGeometryInfo();

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

            <div className="space-y-3 flex-1">
                {attributes.map((attr, index) => (
                    <div key={index} className="flex gap-2 items-center">
                        <Input
                            placeholder="Key"
                            className="h-8 text-xs font-mono"
                            value={attr.key}
                            onChange={(e) => handleChange(index, 'key', e.target.value)}
                        />
                        <Input
                            placeholder="Value"
                            className="h-8 text-xs"
                            value={attr.value}
                            onChange={(e) => handleChange(index, 'value', e.target.value)}
                        />
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive hover:bg-destructive/10"
                            onClick={() => handleDelete(index)}
                        >
                            <Trash className="h-3 w-3" />
                        </Button>
                    </div>
                ))}
                <Button onClick={handleAdd} variant="outline" size="sm" className="w-full">
                    <Plus className="mr-2 h-3 w-3" /> Add Attribute
                </Button>
            </div>
            <div className="pt-4 mt-4 border-t">
                <Button onClick={handleSave} size="sm" className="w-full">
                    <Save className="mr-2 h-3 w-3" /> Save Changes
                </Button>
            </div>
        </div>
    )
}
