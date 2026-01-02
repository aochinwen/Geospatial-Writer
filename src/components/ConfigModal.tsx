'use client'

import React from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { createClient } from '@/utils/supabase/client'
import { toast } from 'sonner'
import { UserPreferences } from '@/types'

interface ConfigModalProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    initialPreferences?: UserPreferences
    onSave?: (prefs: UserPreferences) => void
}

export function ConfigModal({ open, onOpenChange, initialPreferences, onSave }: ConfigModalProps) {
    const [preferences, setPreferences] = React.useState<UserPreferences>({
        point_color: '#3bb2d0',
        point_size: 5,
        point_outline_color: '#ffffff',
        point_outline_width: 2,
        polyline_color: '#3bb2d0',
        polyline_width: 2,
        polygon_fill_color: '#3bb2d0',
        polygon_fill_opacity: 0.1,
        polygon_outline_color: '#3bb2d0',
        polygon_outline_width: 2,
        ...initialPreferences
    })

    // Sync state with props when they load/change
    React.useEffect(() => {
        setPreferences(prev => ({ ...prev, ...initialPreferences }))
    }, [initialPreferences])

    // UI State for custom tabs
    const [activeTab, setActiveTab] = React.useState('point')

    const handleChange = (key: keyof UserPreferences, value: string | number) => {
        setPreferences(prev => ({ ...prev, [key]: value }))
    }

    const handleSave = async () => {
        try {
            const supabase = createClient()
            const { data: { user } } = await supabase.auth.getUser()

            if (!user) {
                toast.error('You must be logged in to save preferences')
                return
            }

            const { error } = await supabase
                .from('user_preferences')
                .upsert({ user_id: user.id, ...preferences }, { onConflict: 'user_id' })

            if (error) throw error

            onSave?.(preferences)
            toast.success('Preferences saved')
            onOpenChange(false)
        } catch (error) {
            console.error('Error saving preferences:', error)
            toast.error('Failed to save preferences')
        }
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-md">
                <DialogHeader>
                    <DialogTitle>Map Configuration</DialogTitle>
                </DialogHeader>

                <div className="flex w-full space-x-2 border-b">
                    {['point', 'line', 'polygon'].map((tab) => (
                        <Button
                            key={tab}
                            variant={activeTab === tab ? 'default' : 'ghost'}
                            onClick={() => setActiveTab(tab)}
                            className="flex-1 capitalize rounded-b-none"
                        >
                            {tab}
                        </Button>
                    ))}
                </div>

                <div className="py-4">
                    {activeTab === 'point' && (
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>Color</Label>
                                <div className="flex gap-2">
                                    <Input
                                        type="color"
                                        value={preferences.point_color}
                                        onChange={(e) => handleChange('point_color', e.target.value)}
                                        className="w-12 p-1 h-9"
                                    />
                                    <Input
                                        value={preferences.point_color}
                                        onChange={(e) => handleChange('point_color', e.target.value)}
                                        className="flex-1"
                                    />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <Label>Size</Label>
                                <Input
                                    type="number"
                                    value={preferences.point_size}
                                    onChange={(e) => handleChange('point_size', parseFloat(e.target.value))}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>Outline Color</Label>
                                <div className="flex gap-2">
                                    <Input
                                        type="color"
                                        value={preferences.point_outline_color}
                                        onChange={(e) => handleChange('point_outline_color', e.target.value)}
                                        className="w-12 p-1 h-9"
                                    />
                                    <Input
                                        value={preferences.point_outline_color}
                                        onChange={(e) => handleChange('point_outline_color', e.target.value)}
                                        className="flex-1"
                                    />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <Label>Outline Width</Label>
                                <Input
                                    type="number"
                                    value={preferences.point_outline_width}
                                    onChange={(e) => handleChange('point_outline_width', parseFloat(e.target.value))}
                                />
                            </div>
                        </div>
                    )}

                    {activeTab === 'line' && (
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>Color</Label>
                                <div className="flex gap-2">
                                    <Input
                                        type="color"
                                        value={preferences.polyline_color}
                                        onChange={(e) => handleChange('polyline_color', e.target.value)}
                                        className="w-12 p-1 h-9"
                                    />
                                    <Input
                                        value={preferences.polyline_color}
                                        onChange={(e) => handleChange('polyline_color', e.target.value)}
                                        className="flex-1"
                                    />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <Label>Width</Label>
                                <Input
                                    type="number"
                                    value={preferences.polyline_width}
                                    onChange={(e) => handleChange('polyline_width', parseFloat(e.target.value))}
                                />
                            </div>
                        </div>
                    )}

                    {activeTab === 'polygon' && (
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>Fill Color</Label>
                                <div className="flex gap-2">
                                    <Input
                                        type="color"
                                        value={preferences.polygon_fill_color}
                                        onChange={(e) => handleChange('polygon_fill_color', e.target.value)}
                                        className="w-12 p-1 h-9"
                                    />
                                    <Input
                                        value={preferences.polygon_fill_color}
                                        onChange={(e) => handleChange('polygon_fill_color', e.target.value)}
                                        className="flex-1"
                                    />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <Label>Fill Opacity</Label>
                                <Input
                                    type="number"
                                    step="0.1"
                                    min="0"
                                    max="1"
                                    value={preferences.polygon_fill_opacity}
                                    onChange={(e) => handleChange('polygon_fill_opacity', parseFloat(e.target.value))}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>Outline Color</Label>
                                <div className="flex gap-2">
                                    <Input
                                        type="color"
                                        value={preferences.polygon_outline_color}
                                        onChange={(e) => handleChange('polygon_outline_color', e.target.value)}
                                        className="w-12 p-1 h-9"
                                    />
                                    <Input
                                        value={preferences.polygon_outline_color}
                                        onChange={(e) => handleChange('polygon_outline_color', e.target.value)}
                                        className="flex-1"
                                    />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <Label>Outline Width</Label>
                                <Input
                                    type="number"
                                    value={preferences.polygon_outline_width}
                                    onChange={(e) => handleChange('polygon_outline_width', parseFloat(e.target.value))}
                                />
                            </div>
                        </div>
                    )}
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
                    <Button onClick={handleSave}>Save Changes</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
