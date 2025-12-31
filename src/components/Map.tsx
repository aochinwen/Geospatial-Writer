'use client'

import * as React from 'react'
import MapGL, { NavigationControl, useControl, MapRef, Popup } from 'react-map-gl/mapbox'
import MapboxDraw from '@mapbox/mapbox-gl-draw'
import 'mapbox-gl/dist/mapbox-gl.css'
import '@mapbox/mapbox-gl-draw/dist/mapbox-gl-draw.css'
import { useProject } from '@/context/ProjectContext'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Plus, FolderOpen, MapPin, Route, Square, Trash2, LogOut, User } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog'
import { createClient } from '@/utils/supabase/client'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'

import AttributeEditor from './AttributeEditor'
import { TemplateManager } from './TemplateManager'
import { Feature, Geometry } from '@/types'

const TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN

// Define minimal Draw types
interface DrawFeature {
    id: string
    type: string
    geometry: Geometry
    properties: Record<string, unknown>
}

interface DrawEvent {
    features: DrawFeature[]
}

// Minimal type for Mapbox Draw Control options
interface DrawControlProps {
    onCreate?: (e: DrawEvent) => void
    onUpdate?: (e: DrawEvent) => void
    onDelete?: (e: DrawEvent) => void
    onSelectionChange?: (e: DrawEvent) => void
    position?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right'
    displayControlsDefault?: boolean
    controls?: {
        point?: boolean
        line_string?: boolean
        polygon?: boolean
        trash?: boolean
        combine_features?: boolean
        uncombine_features?: boolean
    }
}

// Add ref to props
interface ForwardedDrawControlProps extends DrawControlProps {
    forwardedRef: React.Ref<MapboxDraw>
}

function DrawControl(props: ForwardedDrawControlProps) {
    const { onCreate, onUpdate, onDelete, onSelectionChange, forwardedRef, ...drawOptions } = props;

    const draw = useControl(
        () => new MapboxDraw(drawOptions),
        ({ map }: { map: MapRef }) => {
            const mapInstance = map.getMap();
            if (onCreate) mapInstance.on('draw.create', onCreate)
            if (onUpdate) mapInstance.on('draw.update', onUpdate)
            if (onDelete) mapInstance.on('draw.delete', onDelete)
            if (onSelectionChange) mapInstance.on('draw.selectionchange', onSelectionChange)
        },
        ({ map }: { map: MapRef }) => {
            const mapInstance = map.getMap();
            if (onCreate) mapInstance.off('draw.create', onCreate)
            if (onUpdate) mapInstance.off('draw.update', onUpdate)
            if (onDelete) mapInstance.off('draw.delete', onDelete)
            if (onSelectionChange) mapInstance.off('draw.selectionchange', onSelectionChange)
        },
        {
            position: props.position
        }
    )

    // Expose the draw instance via ref
    React.useImperativeHandle(forwardedRef, () => draw, [draw]);

    return null
}

const ForwardedDrawControl = React.forwardRef<MapboxDraw, DrawControlProps>((props, ref) => (
    <DrawControl {...props} forwardedRef={ref} />
));
ForwardedDrawControl.displayName = 'ForwardedDrawControl';

export default function MapComponent() {
    const mapRef = React.useRef<MapRef>(null)
    const drawRef = React.useRef<MapboxDraw | null>(null)
    const { activeProject, projects, createProject, deleteProject, setActiveProject, refreshFeatures, features: dbFeatures } = useProject()
    const [viewState, setViewState] = React.useState({
        longitude: 103.8198,
        latitude: 1.3521,
        zoom: 11
    })
    const [newProjectName, setNewProjectName] = React.useState('')
    const [isProjectDialogOpen, setIsProjectDialogOpen] = React.useState(false)
    const [projectToDelete, setProjectToDelete] = React.useState<{ id: string, name: string } | null>(null)
    const [isPreviewOpen, setIsPreviewOpen] = React.useState(false)
    const [selectedFeatureId, setSelectedFeatureId] = React.useState<string | null>(null)
    const [selectedFeatureProps, setSelectedFeatureProps] = React.useState<Record<string, unknown>>({})
    const [featuresList, setFeaturesList] = React.useState<DrawFeature[]>([])
    // New: for "Create Another" workflow
    const [pendingTemplate, setPendingTemplate] = React.useState<Record<string, unknown> | null>(null)
    const [showUserMenu, setShowUserMenu] = React.useState(false)

    // Capture features from Context (DB) OR from Draw updates
    // Actually, simple solution: whenever Draw updates (Create, Delete, Update), we set 'featuresList' 
    // from drawRef.current.getAll().
    const syncFeaturesList = React.useCallback(() => {
        if (drawRef.current) {
            setFeaturesList(drawRef.current.getAll().features as DrawFeature[])
        }
    }, [])

    const supabase = createClient()
    const router = useRouter()
    const { user } = useProject()



    const isSwapping = React.useRef(false)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const [hoverInfo, setHoverInfo] = React.useState<{ longitude: number, latitude: number, feature: any } | null>(null)

    // EFFECT: Handle Project Switching - Load Data
    React.useEffect(() => {
        const draw = drawRef.current;
        if (draw && activeProject && dbFeatures) {
            // Smart Sync: Diff instead of clear-all

            // 1. Get current Draw IDs
            const collection = draw?.getAll?.() || { features: [] };
            const currentIds = new Set(collection.features.map((f: { id?: string | number }) => String(f.id)));

            // 2. Identify DB IDs
            const dbIds = new Set(dbFeatures.map(f => f.id));

            // 3. Delete features in Draw but not in DB
            const toDelete: string[] = [];
            currentIds.forEach(id => {
                // Check if it's a UUID (DB feature) or Temp
                const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);

                // Only delete if it IS a UUID (claiming to be from DB) but NOT in the DB list.
                // FAILSAFE: Never delete the currently selected feature during sync (prevents UI disappear on race conditions)
                if (id && isUUID && !dbIds.has(id)) {
                    if (id === selectedFeatureId) {
                        console.log('SAFEGUARD: Prevented Deletion of Selected Feature', id);
                    } else {
                        toDelete.push(id);
                    }
                }
            });

            if (toDelete.length > 0) {
                isSwapping.current = true;
                draw?.delete?.(toDelete);
                isSwapping.current = false;
            }

            // 4. Add/Update Features
            if (dbFeatures.length > 0) {
                const fc = {
                    type: 'FeatureCollection',
                    features: dbFeatures.map(f => ({
                        type: 'Feature',
                        id: f.id,
                        geometry: f.geometry,
                        properties: f.properties
                    }))
                }

                // Prevent selection change handlers from firing during this sync
                isSwapping.current = true;
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                draw?.add?.(fc as any);
                isSwapping.current = false;
            }
            syncFeaturesList()
        }
    }, [activeProject, dbFeatures, syncFeaturesList, selectedFeatureId]) // Added selectedFeatureId and syncFeaturesList


    // Supabase Helpers
    const insertFeature = React.useCallback(async (feature: Partial<DrawFeature>, projectId: string) => {
        try {
            const { data, error } = await supabase.from('features').insert({
                project_id: projectId,
                geometry: feature.geometry,
                properties: feature.properties || {}
            }).select().single()

            if (error) throw error
            return data
        } catch (error) {
            console.error('Insert error:', error)
            throw error
        }
    }, [supabase])

    const updateFeature = React.useCallback(async (id: string, updates: Record<string, unknown>) => {
        try {
            // whitelist allowed fields
            const allowed = ['geometry', 'properties', 'project_id'];
            const payload: Record<string, unknown> = {};
            for (const k of allowed) {
                if (k in updates) payload[k] = updates[k];
            }
            if (Object.keys(payload).length === 0) return null;

            const { data, error } = await supabase.from('features')
                .update(payload)
                .eq('id', id)
                .select()
                .single()

            if (error) throw error
            return data
        } catch (error) {
            console.error('Update error:', error)
            throw error
        }
    }, [supabase])

    const deleteFeature = React.useCallback(async (id: string) => {
        try {
            const { error } = await supabase.from('features').delete().eq('id', id)
            if (error) throw error
        } catch (error) {
            console.error('Delete error:', error)
            throw error
        }
    }, [supabase])

    // Handlers
    const onUpdate = React.useCallback(async (e: DrawEvent) => {
        const { features } = e
        for (const feature of features) {
            if (activeProject && feature.id) {
                // Ensure it's a valid UUID before trying to update DB
                // (Mapbox Draw creates short IDs for new features, but our 'onCreate' should have swapped them)
                // If we somehow get a non-UUID here, it means it's a local session feature or sync failed.
                const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(feature.id as string);

                if (isUUID) {
                    try {
                        await updateFeature(feature.id, { geometry: feature.geometry })
                    } catch (err) {
                        // err is unknown, so we can't just access it.
                        console.error(err)
                        toast.error('Failed to sync update')
                    }
                }
            }
        }
        syncFeaturesList()
    }, [activeProject, syncFeaturesList, updateFeature])

    const onCreate = React.useCallback(async (e: DrawEvent) => {
        console.log('onCreate triggered', e);
        const { features } = e
        for (const feature of features) {

            // Apply pending template if exists (from "Create Another")
            let initialProps = feature.properties || {};
            if (pendingTemplate) {
                console.log('Applying pending template to new feature', pendingTemplate);
                initialProps = { ...initialProps, ...pendingTemplate };
                // Reset pending template
                setPendingTemplate(null);
            }

            if (!activeProject) {
                console.log('No active project - keeping feature local');
                toast.info('Feature added to local session')
                // Update local props in draw if needed
                if (drawRef.current) {
                    drawRef.current.add({
                        ...feature,
                        properties: initialProps
                    } as any) // eslint-disable-line @typescript-eslint/no-explicit-any
                }
                syncFeaturesList()
                return;
            }

            // Generate UUID client-side immediately
            const newId = crypto.randomUUID();
            const tempId = feature.id;

            // Immediate swap in Mapbox Draw to prevent race conditions
            if (drawRef.current) {
                isSwapping.current = true;
                try {
                    drawRef.current.delete(tempId);
                    const newFeature = {
                        type: 'Feature' as const,
                        id: newId,
                        geometry: feature.geometry,
                        properties: initialProps // Use merged props
                    };
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    drawRef.current.add(newFeature as any);

                    // Select the new feature immediately so UI is ready
                    drawRef.current.changeMode('simple_select', { featureIds: [newId] });
                    setSelectedFeatureId(newId);
                    setSelectedFeatureProps(newFeature.properties);
                } finally {
                    setTimeout(() => {
                        isSwapping.current = false;
                    }, 50);
                }
            }

            try {
                // Now insert to DB with the correct ID
                const featureWithId = { ...feature, id: newId, properties: initialProps };
                const data = await insertFeature(featureWithId, activeProject.id)
                console.log('Feature saved to DB:', data);
                toast.success('Feature saved')

                refreshFeatures() // Sync context
            } catch {
                toast.error('Failed to save attribute changes')
            }    // Optional: Revert UI if save fails?
            // For now, we leave it as local feature (with UUID) but unsaved.
            syncFeaturesList()
        }
        syncFeaturesList()
    }, [activeProject, refreshFeatures, syncFeaturesList, pendingTemplate, insertFeature])

    // New Handler for "Create Another"
    const handleCreateAnother = (geometryType: string, currentProps: Record<string, unknown>) => {
        if (!drawRef.current) return;

        // set pending template keys (values empty)
        const templateKeys = Object.keys(currentProps).reduce((acc, key) => {
            acc[key] = '';
            return acc;
        }, {} as Record<string, string>);

        setPendingTemplate(templateKeys);

        // Start drawing mode
        let mode = 'simple_select';
        if (geometryType === 'Point') mode = 'draw_point';
        else if (geometryType === 'LineString') mode = 'draw_line_string';
        else if (geometryType === 'Polygon') mode = 'draw_polygon';

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        drawRef.current.changeMode(mode as any);
        toast.info(`Draw a new ${geometryType} to apply template`);
    }

    const onDelete = React.useCallback(async (e: DrawEvent) => {
        if (isSwapping.current) return;

        const { features } = e
        for (const feature of features) {
            if (!feature.id) continue

            if (activeProject) {
                // Only try to delete from DB if it looks like a DB ID
                const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(feature.id as string);
                if (isUUID) {
                    try {
                        await deleteFeature(feature.id)
                    } catch (err) {
                        console.error(err);
                        toast.error('Failed to delete feature from DB')
                    }
                }
            }
        }
        if (activeProject) refreshFeatures()
        setSelectedFeatureId(null)
        syncFeaturesList()
    }, [activeProject, refreshFeatures, syncFeaturesList, deleteFeature])

    const handleSignOut = async () => {
        await supabase.auth.signOut()
        router.push('/login')
        toast.success('Signed out successfully')
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const handleFeatureClick = (feature: Feature | any) => {
        if (!drawRef.current) return;

        // Select in Draw
        // This highlights it.
        drawRef.current.changeMode('simple_select', { featureIds: [feature.id] });

        // Update Local State
        setSelectedFeatureId(feature.id);
        setSelectedFeatureProps(feature.properties || {});

        // Fly to feature
        const geom = feature.geometry;
        if (geom.type === 'Point' && Array.isArray(geom.coordinates) && geom.coordinates.length >= 2) {
             const [lng, lat] = geom.coordinates as [number, number];
            mapRef.current?.flyTo({ center: [lng, lat], zoom: 15 });
        } else if (geom.type === 'LineString' && Array.isArray(geom.coordinates) && geom.coordinates.length > 0) {
             const [lng, lat] = geom.coordinates[0] as [number, number];
            mapRef.current?.flyTo({ center: [lng, lat], zoom: 15 });
        } else if (geom.type === 'Polygon' && Array.isArray(geom.coordinates) && geom.coordinates.length > 0 && Array.isArray(geom.coordinates[0]) && geom.coordinates[0].length > 0) {
            const [lng, lat] = geom.coordinates[0][0] as [number, number];
            mapRef.current?.flyTo({ center: [lng, lat], zoom: 15 });
        }
    }

    const getFeatureIcon = (type: string) => {
        switch (type) {
            case 'Point': return <MapPin className="h-4 w-4" />;
            case 'LineString': return <Route className="h-4 w-4" />;
            case 'Polygon': return <Square className="h-4 w-4" />;
            default: return <MapPin className="h-4 w-4" />;
        }
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const getFeatureName = (f: Feature | any, index: number) => {
        if (f.properties?.name && typeof f.properties.name === 'string') return f.properties.name;
        if (f.properties?.title && typeof f.properties.title === 'string') return f.properties.title;
        // Search for any string property
        const firstString = Object.values(f.properties || {}).find(v => typeof v === 'string');
        if (firstString) return firstString as string;
        return `${f.geometry.type} ${index + 1}`
    }

    const handleCreateProject = async () => {
        if (!newProjectName) return
        await createProject(newProjectName)
        setNewProjectName('')
        setIsProjectDialogOpen(false)
        toast.success('Project created and active')
    }

    // Safely get geometry for Attribute Editor
    const getEditorGeometry = () => {
        const found = featuresList.find(f => f.id === selectedFeatureId);
        if (found) {
            return { type: found.geometry.type as Geometry['type'], coordinates: found.geometry.coordinates };
        }
        const dbFound = dbFeatures.find(f => f.id === selectedFeatureId);
        if (dbFound) {
            return dbFound.geometry;
        }
        return undefined;
    }

    // Create a robust lookup map for features (DB + Local)
    const featureLookup = React.useMemo(() => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const map = new Map<string, any>();

        // 1. Add DB features (Authoritative)
        dbFeatures.forEach(f => {
            if (f.id) map.set(String(f.id), f);
        });

        // 2. Add/Override with Local features (Newer/Unsaved)
        featuresList.forEach(f => {
            if (f.id) map.set(String(f.id), f);
        });

        return map;
    }, [dbFeatures, featuresList]);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const onHover = React.useCallback((event: any) => {
        const { point, lngLat } = event;
        // Query features under the cursor
        // We filter for features that are likely ours (e.g. have an ID or geometry)
        // Note: mapbox-gl-draw layers usually start with 'gl-draw'
        const features = event.target.queryRenderedFeatures(point);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const drawFeature = features.find((f: any) => f.source && f.source.includes('mapbox-gl-draw'));

        if (drawFeature) {
            setHoverInfo({
                longitude: lngLat.lng,
                latitude: lngLat.lat,
                feature: drawFeature
            });
            event.target.getCanvas().style.cursor = 'pointer';
        } else {
            setHoverInfo(null);
            event.target.getCanvas().style.cursor = '';
        }
    }, []);

    const onSelectionChange = React.useCallback((e: DrawEvent) => {
        if (isSwapping.current) return;

        const { features } = e
        console.log('onSelectionChange', features.length, features[0]?.id);

        if (features.length > 0) {
            const f = features[0]
            setSelectedFeatureId(f.id)
            setSelectedFeatureProps(f.properties || {})
        } else {
            setSelectedFeatureId(null)
        }
    }, [])

    // Event Refs to avoid stale closures in Mapbox listeners
    const onCreateRef = React.useRef(onCreate);
    const onUpdateRef = React.useRef(onUpdate);
    const onDeleteRef = React.useRef(onDelete);
    const onSelectionChangeRef = React.useRef(onSelectionChange);

    // Update refs whenever callbacks change
    React.useEffect(() => { onCreateRef.current = onCreate; }, [onCreate]);
    React.useEffect(() => { onUpdateRef.current = onUpdate; }, [onUpdate]);
    React.useEffect(() => { onDeleteRef.current = onDelete; }, [onDelete]);
    React.useEffect(() => { onSelectionChangeRef.current = onSelectionChange; }, [onSelectionChange]);

    // Stable handlers to pass to DrawControl
    const stableOnCreate = React.useCallback((e: DrawEvent) => onCreateRef.current(e), []);
    const stableOnUpdate = React.useCallback((e: DrawEvent) => onUpdateRef.current(e), []);
    const stableOnDelete = React.useCallback((e: DrawEvent) => onDeleteRef.current(e), []);
    const stableOnSelectionChange = React.useCallback((e: DrawEvent) => onSelectionChangeRef.current(e), []);

    const handleAttributeSave = async (id: string, newProps: Record<string, unknown>) => {
        if (!activeProject) return;

        const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);

        if (isUUID) {
            // Existing Feature: Update
            try {
                await updateFeature(id, { properties: newProps })
                refreshFeatures() // REFRESH CONTEXT so Popup sees new props immediately
                toast.success('Changes saved successfully')
            } catch (err) {
                console.error(err)
                toast.error('Failed to update attributes')
                return;
            }
        } else {
            // Draft Feature: Insert (Deferred Save)
            if (!drawRef.current) return;
            const feature = drawRef.current.get(id);
            if (!feature) {
                toast.error('Feature not found in local state');
                return;
            }

            // Merge new props into feature for the insert payload
            const featureToSave = {
                ...feature,
                properties: { ...feature.properties, ...newProps }
            };

            try {
                const data = await insertFeature(featureToSave as Partial<DrawFeature>, activeProject.id);

                // Swap ID in Mapbox Draw to the real UUID
                isSwapping.current = true;
                drawRef.current.delete(id);

                const newFeatureLocal = {
                    type: 'Feature' as const,
                    id: data.id,
                    geometry: data.geometry,
                    properties: data.properties
                };
                drawRef.current.add(newFeatureLocal);
                setTimeout(() => {
                    isSwapping.current = false;
                }, 50);

                // Update UI selection
                drawRef.current.changeMode('simple_select', { featureIds: [data.id] });
                setSelectedFeatureId(data.id);
                setSelectedFeatureProps(data.properties);

                toast.success('Changes saved successfully');
                refreshFeatures();

            } catch (err) {
                console.error(err);
                toast.error('Failed to create feature in DB');
                return;
            }
        }

        // Update Local Map State (if not already handled by swap)
        // If we swapped, we already added newFeatureLocal with newProps.
        // If we updated, we need to update local props.
        if (drawRef.current && isUUID) {
            const f = drawRef.current.get(id)
            if (f) {
                drawRef.current.add({
                    ...f,
                    properties: newProps
                })
            }
        }

        syncFeaturesList()
    }

    return (
        <div className="relative w-full h-full flex">
            {/* Top Left Project Controls */}
            <div className="absolute top-4 left-4 z-10 w-80 space-y-2 flex flex-col max-h-[calc(100%-2rem)]">
                {/* Template Database Component */}
                <Card className="shrink-0">
                    <CardHeader className="p-4 pb-2">
                        <CardTitle className="text-sm font-medium uppercase text-muted-foreground flex items-center gap-2">
                            Template Library
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="p-4 pt-2">
                        <TemplateManager trigger={
                            <Button variant="secondary" size="sm" className="w-full">
                                <FolderOpen className="mr-2 h-4 w-4" /> Manage Global Templates
                            </Button>
                        } />
                    </CardContent>
                </Card>

                <Card className="shrink-0">
                    <CardHeader className="p-4 pb-2">
                        <CardTitle className="text-sm font-medium uppercase text-muted-foreground">Current Project</CardTitle>
                    </CardHeader>
                    <CardContent className="p-4 pt-2 space-y-2">
                        {activeProject ? (
                            <>
                                <div className="flex items-center justify-between">
                                    <span className="font-bold truncate">{activeProject.name}</span>
                                    <Button variant="ghost" size="sm" onClick={() => setIsProjectDialogOpen(true)}>Switch</Button>
                                </div>

                                <div className="flex gap-2">
                                    <Button size="sm" variant="outline" onClick={() => setIsPreviewOpen(true)} className="flex-1">
                                        Export
                                    </Button>
                                </div>
                            </>
                        ) : (
                            <div className="text-center">
                                <p className="text-sm text-muted-foreground mb-3">No project selected</p>
                                <Button size="sm" className="w-full" onClick={() => setIsProjectDialogOpen(true)}>
                                    <FolderOpen className="mr-2 h-4 w-4" /> Open / Create Project
                                </Button>
                            </div>
                        )}
                    </CardContent>
                </Card>


                <Card className="flex-1 min-h-0 flex flex-col backdrop-blur-sm bg-background/95">
                    <CardHeader className="p-4 pb-2 shrink-0">
                        <div className="flex items-center justify-between">
                            <CardTitle className="text-sm font-medium uppercase text-muted-foreground">Features ({dbFeatures.length})</CardTitle>
                        </div>
                    </CardHeader>
                    <CardContent className="p-2 pt-0 overflow-y-auto flex-1">
                        <div className="space-y-1">
                            {dbFeatures.length === 0 && <p className="text-xs text-muted-foreground p-2">No features added yet.</p>}
                            {dbFeatures.map((f, i) => (
                                <div
                                    key={f.id}
                                    className={`flex items-center justify-between p-2 rounded cursor-pointer text-sm hover:bg-accent transition-colors ${selectedFeatureId === f.id ? 'bg-accent text-accent-foreground' : ''}`}
                                    onClick={() => handleFeatureClick(f)}
                                >
                                    <div className="flex items-center gap-2 truncate">
                                        {getFeatureIcon(f.geometry.type)}
                                        <span className="truncate max-w-[150px]">{getFeatureName(f, i)}</span>
                                    </div>
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-6 w-6 opacity-0 group-hover:opacity-50 hover:!opacity-100"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            const confirmDelete = window.confirm("Delete this feature?");
                                            if (!confirmDelete) return;

                                            // Construct event for onDelete
                                            const mockEvent: DrawEvent = { features: [{ id: f.id, type: 'Feature', geometry: f.geometry, properties: f.properties || {} }] };
                                            onDelete(mockEvent);

                                            if (drawRef.current) drawRef.current.delete(f.id);
                                        }}
                                    >
                                        <Trash2 className="h-3 w-3" />
                                    </Button>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>

            </div>

            {/* User Account FAB */}
            <div className="absolute bottom-4 left-4 z-10 flex flex-col-reverse items-start gap-2">
                <Button
                    variant="outline"
                    size="icon"
                    className="h-10 w-10 rounded-full shadow-lg bg-background"
                    onClick={() => setShowUserMenu(!showUserMenu)}
                    title="Account"
                >
                    <User className="h-5 w-5" />
                </Button>

                {showUserMenu && (
                    <Card className="mb-2 w-64 animate-in slide-in-from-bottom-2 fade-in duration-200">
                        <CardContent className="p-3 space-y-3">
                            <div className="text-xs text-muted-foreground font-medium truncate px-1" title={user?.email}>
                                {user?.email}
                            </div>
                            <Button variant="destructive" size="sm" className="w-full text-xs h-8" onClick={handleSignOut}>
                                <LogOut className="mr-2 h-3 w-3" /> Sign Out
                            </Button>
                        </CardContent>
                    </Card>
                )}
            </div>

            <Dialog open={isPreviewOpen} onOpenChange={setIsPreviewOpen}>
                <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
                    <DialogHeader>
                        <DialogTitle>GeoJSON Preview</DialogTitle>
                    </DialogHeader>
                    <div className="flex-1 overflow-auto bg-neutral-100 dark:bg-neutral-900 p-4 rounded text-xs font-mono">
                        <pre>{JSON.stringify({
                            type: 'FeatureCollection',
                            features: dbFeatures.map(f => ({
                                type: 'Feature',
                                geometry: f.geometry,
                                properties: f.properties
                            }))
                        }, null, 2)}</pre>
                    </div>
                    <div className="flex justify-end pt-4">
                        <Button onClick={() => {
                            const data = JSON.stringify({
                                type: 'FeatureCollection',
                                features: dbFeatures.map(f => ({
                                    type: 'Feature',
                                    geometry: f.geometry,
                                    properties: f.properties
                                }))
                            }, null, 2)
                            const blob = new Blob([data], { type: 'application/geo+json' })
                            const url = URL.createObjectURL(blob)
                            const a = document.createElement('a')
                            a.href = url
                            a.download = `${activeProject?.name || 'export'}.geojson`
                            document.body.appendChild(a)
                            a.click()
                            document.body.removeChild(a)
                            URL.revokeObjectURL(url)
                            setIsPreviewOpen(false)
                            toast.success('Export downloaded')
                        }}>
                            Download .geojson
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>

            <Dialog open={isProjectDialogOpen} onOpenChange={setIsProjectDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Select or Create Project</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4">
                        <div className="flex gap-2">
                            <Input placeholder="New Project Name" value={newProjectName} onChange={e => setNewProjectName(e.target.value)} />
                            <Button onClick={handleCreateProject}><Plus className="mr-2 h-4 w-4" /> Create</Button>
                        </div>
                        <div className="border-t pt-4">
                            <h4 className="text-sm font-medium mb-2">Your Projects</h4>
                            <div className="max-h-60 overflow-y-auto space-y-2">
                                {projects.length === 0 && <p className="text-sm text-neutral-500">No projects found.</p>}
                                {projects.map(p => (
                                    <div key={p.id} className="flex items-center gap-2 group">
                                        <Button
                                            variant={activeProject?.id === p.id ? "secondary" : "ghost"}
                                            className="flex-1 justify-start text-left min-w-0 truncate"
                                            onClick={() => { setActiveProject(p); setIsProjectDialogOpen(false); }}
                                        >
                                            <span className="truncate">{p.name}</span>
                                        </Button>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-8 w-8 text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
                                            onClick={(e) => {
                                                e.stopPropagation()
                                                setProjectToDelete(p)
                                            }}
                                        >
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>

            <Dialog open={!!projectToDelete} onOpenChange={(open) => !open && setProjectToDelete(null)}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Delete Project?</DialogTitle>
                        <DialogDescription>
                            Are you sure you want to delete <span className="font-semibold text-foreground">{projectToDelete?.name}</span>?
                            This action cannot be undone and all associated features will be lost.
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setProjectToDelete(null)}>Cancel</Button>
                        <Button
                            variant="destructive"
                            onClick={() => {
                                if (projectToDelete) {
                                    deleteProject(projectToDelete.id)
                                    toast.success('Project deleted')
                                    setProjectToDelete(null)
                                }
                            }}
                        >
                            Delete Project
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <div className="flex-1 relative">
                <MapGL
                    ref={mapRef}
                    {...viewState}
                    onMove={evt => setViewState(evt.viewState)}
                    onMouseMove={onHover}
                    onMouseLeave={() => setHoverInfo(null)}
                    style={{ width: '100%', height: '100%' }}
                    mapStyle="mapbox://styles/mapbox/streets-v11"
                    mapboxAccessToken={TOKEN}
                >
                    <NavigationControl position="bottom-right" />
                    <ForwardedDrawControl
                        ref={drawRef}
                        position="top-right"
                        displayControlsDefault={false}
                        controls={{
                            polygon: true,
                            trash: true,
                            point: true,
                            line_string: true
                        }}
                        onCreate={stableOnCreate}
                        onUpdate={stableOnUpdate}
                        onDelete={stableOnDelete}
                        onSelectionChange={stableOnSelectionChange}
                    />
                    {/* Hover Popup */}
                    {hoverInfo && (() => {
                        // 1. Look up feature in our session Map
                        //    Mapbox Draw features might have ID in properties if not at top level
                        const rawId = hoverInfo.feature.id || hoverInfo.feature.properties?.id;
                        const id = String(rawId);
                        const sessionFeature = featureLookup.get(id);

                        // 2. Determine reliable props
                        // If found in session (DB or Local List), use that.
                        // Else fallback to Mapbox Draw event props (rarely needed if sync is good)
                        const reliableProps = sessionFeature ? sessionFeature.properties : (hoverInfo.feature.properties || {});



                        // 3. Filter out internal Mapbox Draw properties
                        const displayProps = Object.entries(reliableProps as Record<string, unknown>).filter(([k]) => {
                            const lower = k.toLowerCase();
                            // Filter system keys
                            if (['id', 'meta', 'meta:type', 'active', 'mode', 'parent', 'coord_path'].includes(lower)) return false;
                            // Filter empty strings if desired (optional, maybe user wants to see them?)
                            return true;
                        });

                        return (
                            <Popup
                                longitude={hoverInfo.longitude}
                                latitude={hoverInfo.latitude}
                                closeButton={false}
                                closeOnClick={false}
                                className="z-50"
                                offset={10}
                            >
                                <div className="text-xs max-w-[200px] break-words">
                                    <div className="font-semibold mb-1 border-b pb-1">Properties</div>
                                    {displayProps.length === 0 ? (
                                        <div className="text-muted-foreground italic">No properties</div>
                                    ) : (
                                        displayProps.map(([k, v]) => (
                                            <div key={k} className="flex gap-2">
                                                <span className="font-medium text-muted-foreground">{k}:</span>
                                                <span>{String(v)}</span>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </Popup>
                        );
                    })()}
                </MapGL>
            </div>

            {/* Attribute Editor - Floating Panel */}
            {
                selectedFeatureId && (
                    <div className="absolute top-4 right-14 z-20 w-96 bg-background/95 backdrop-blur-sm shadow-lg rounded-lg border p-4 max-h-[80vh] overflow-y-auto">
                        <AttributeEditor
                            key={selectedFeatureId} // Force remount on feature change
                            featureId={selectedFeatureId}
                            initialProperties={selectedFeatureProps}
                            featureGeometry={getEditorGeometry()}
                            onSave={handleAttributeSave}
                            onDelete={() => {
                                // Double confirmation removed - AttributeEditor handles the UI
                                // Call onDelete with structure expected by Mapbox Draw / our handler
                                // We need to mock the event structure
                                const f = featuresList.find(feat => feat.id === selectedFeatureId) || dbFeatures.find(feat => feat.id === selectedFeatureId);
                                if (f) {
                                    // Ensure f is compatible with DrawFeature
                                    // dbFeatures have 'properties' as Record<string, unknown>, which fits DrawFeature
                                    // geometry is also compatible
                                     const drawFeature: DrawFeature = {
                                        id: f.id,
                                        type: 'Feature',
                                        geometry: f.geometry,
                                        properties: f.properties || {}
                                    };
                                    onDelete({ features: [drawFeature] })
                                }

                                // Also remove from draw instance locally
                                if (drawRef.current) {
                                    drawRef.current.delete(selectedFeatureId)
                                    // Clear selection
                                    setSelectedFeatureId(null)
                                }
                            }}
                            onClose={() => {
                                setSelectedFeatureId(null)
                                if (drawRef.current) {
                                    drawRef.current.changeMode('simple_select', { featureIds: [] })
                                }
                            }}
                            onCreateAnother={handleCreateAnother}
                        />
                    </div>
                )
            }


        </div >
    )
}
