'use client'

import * as React from 'react'
import MapGL, { NavigationControl, useControl, MapRef, Popup, ControlPosition } from 'react-map-gl/mapbox'
import MapboxDraw from '@mapbox/mapbox-gl-draw'
import 'mapbox-gl/dist/mapbox-gl.css'
import '@mapbox/mapbox-gl-draw/dist/mapbox-gl-draw.css'
import { useProject } from '@/context/ProjectContext'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Plus, FolderOpen, MapPin, Route, Square, Trash2, LogOut, User, Map as MapIcon, Check, X, Edit, ChevronLeft, BookTemplate } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog'
import { createClient } from '@/utils/supabase/client'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'

import AttributeEditor from './AttributeEditor'
import { TemplateManager } from './TemplateManager'
import { TemplateListContent } from './TemplateListContent'
import { Feature } from '@/types'
import { convertGeoJSON, SPATIAL_REFERENCES, SpatialReference } from '@/utils/coordinates'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { ConfigModal } from '@/components/ConfigModal'
import { getMapDrawStyles } from '@/components/map-styles'
import { UserPreferences } from '@/types'

const TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN

interface DrawEvent {
    features: Feature[]
}

interface DrawControlProps {
    onCreate?: (e: DrawEvent) => void
    onUpdate?: (e: DrawEvent) => void
    onDelete?: (e: DrawEvent) => void
    onSelectionChange?: (e: DrawEvent) => void
    position?: ControlPosition
    displayControlsDefault?: boolean
    controls?: Record<string, boolean>
    forwardedRef?: React.Ref<MapboxDraw>
    styles?: object[]
}

function DrawControl(props: DrawControlProps) {
    const { onCreate, onUpdate, onDelete, onSelectionChange, forwardedRef, ...drawOptions } = props;

    const draw = useControl<MapboxDraw>(
        () => new MapboxDraw({ ...drawOptions, userProperties: true }),
        ({ map }: { map: MapRef }) => {
            if (onCreate) map.on('draw.create', onCreate)
            if (onUpdate) map.on('draw.update', onUpdate)
            if (onDelete) map.on('draw.delete', onDelete)
            if (onSelectionChange) map.on('draw.selectionchange', onSelectionChange)
        },
        ({ map }: { map: MapRef }) => {
            if (onCreate) map.off('draw.create', onCreate)
            if (onUpdate) map.off('draw.update', onUpdate)
            if (onDelete) map.off('draw.delete', onDelete)
            if (onSelectionChange) map.off('draw.selectionchange', onSelectionChange)
        },
        {
            position: props.position
        }
    )

    // Expose the draw instance via ref
    React.useImperativeHandle(forwardedRef, () => draw, [draw]);

    return null
}

const ForwardedDrawControl = React.forwardRef<MapboxDraw, Omit<DrawControlProps, 'forwardedRef'>>((props, ref) => (
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
    const [featuresList, setFeaturesList] = React.useState<Feature[]>([])
    // New: for "Create Another" workflow
    const [pendingTemplate, setPendingTemplate] = React.useState<Record<string, unknown> | null>(null)
    const [showUserMenu, setShowUserMenu] = React.useState(false)

    // Mobile State
    const [mobileTab, setMobileTab] = React.useState<'map' | 'projects' | 'profile' | 'templates'>('map')
    const [isDrawingMobile, setIsDrawingMobile] = React.useState(false)
    const [mobileEditMode, setMobileEditMode] = React.useState(false)
    const [showMobileDrawMenu, setShowMobileDrawMenu] = React.useState(false)

    // User Preferences
    const [isConfigOpen, setIsConfigOpen] = React.useState(false)
    const [userPreferences, setUserPreferences] = React.useState<UserPreferences>({
        point_color: '#3bb2d0',
        point_size: 5,
        point_outline_color: '#ffffff',
        point_outline_width: 2,
        polyline_color: '#3bb2d0',
        polyline_width: 2,
        polygon_fill_color: '#3bb2d0',
        polygon_fill_opacity: 0.1,
        polygon_outline_color: '#3bb2d0',
        polygon_outline_width: 2
    })

    const drawStyles = React.useMemo(() => getMapDrawStyles(userPreferences), [userPreferences])

    // Capture features from Context (DB) OR from Draw updates
    // Actually, simple solution: whenever Draw updates (Create, Delete, Update), we set 'featuresList' 
    // from drawRef.current.getAll().
    const syncFeaturesList = React.useCallback(() => {
        if (drawRef.current) {
            const allFeatures = drawRef.current.getAll().features.map(f => ({
                ...f,
                project_id: (f.properties?.project_id as string) || activeProject?.id || ''
            })) as Feature[]
            setFeaturesList(allFeatures)
        }
    }, [activeProject])

    const supabase = createClient()
    const router = useRouter()
    const { user } = useProject()



    const isSwapping = React.useRef(false)
    const [hoverInfo, setHoverInfo] = React.useState<{ longitude: number, latitude: number, feature: Feature } | null>(null)
    const [exportCRS, setExportCRS] = React.useState<SpatialReference>('WGS84')

    // EFFECT: Fetch User Preferences
    React.useEffect(() => {
        const fetchPreferences = async () => {
            const { data: { user } } = await supabase.auth.getUser()
            if (user) {
                const { data } = await supabase
                    .from('user_preferences')
                    .select('*')
                    .eq('user_id', user.id)
                    .single()

                if (data) {
                    // Normalize keys to match UserPreferences interface if needed, 
                    // dependent on how Supabase returns data vs TypeScript type.
                    // Assuming direct match for now.
                    setUserPreferences(prev => ({ ...prev, ...data }))
                }
            }
        }
        fetchPreferences()
    }, [supabase])

    // EFFECT: Handle Project Switching - Load Data
    const selectedFeatureIdRef = React.useRef(selectedFeatureId)
    React.useEffect(() => {
        selectedFeatureIdRef.current = selectedFeatureId
    }, [selectedFeatureId])

    React.useEffect(() => {
        const draw = drawRef.current;
        if (draw && activeProject && dbFeatures) {
            // Smart Sync: Diff instead of clear-all

            // Skip sync if user is currently drawing (prevents interrupting "Create Another" or active drawing)
            const mode = draw.getMode();
            if (mode.startsWith('draw_')) {
                return;
            }

            // 1. Get current Draw IDs
            const collection = draw?.getAll?.() || { features: [] };
            const currentIds = new Set(collection.features.map(f => f.id as string));

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
                    if (id === selectedFeatureIdRef.current) {
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
                    type: 'FeatureCollection' as const,
                    features: dbFeatures.map(f => ({
                        type: 'Feature' as const,
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
    }, [activeProject, dbFeatures, syncFeaturesList, userPreferences]) // Dependency list separate from logic


    // Supabase Helpers
    const insertFeature = React.useCallback(async (feature: Feature, projectId: string) => {
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

    const updateFeature = React.useCallback(async (id: string, updates: Partial<Feature>) => {
        try {
            // whitelist allowed fields
            const allowed = ['geometry', 'properties', 'project_id'];
            const payload: Record<string, unknown> = {};
            for (const k of allowed) {
                if (k in updates) payload[k] = updates[k as keyof Feature];
            }
            if (Object.keys(payload).length === 0) return null;

            const { data, error } = await supabase.from('features')
                .update(payload)
                .eq('id', id)
                .select()
                .maybeSingle()

            if (error) throw error
            if (!data) return null
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
                    } catch {
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
                        type: 'Feature',
                        properties: initialProps
                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    } as any)
                }
                syncFeaturesList()
                return;
            }

            // Generate UUID client-side immediately
            const newId = crypto.randomUUID();
            const tempId = feature.id as string;

            // Immediate swap in Mapbox Draw to prevent race conditions
            if (drawRef.current) {
                isSwapping.current = true;
                try {
                    drawRef.current.delete(tempId);
                    const newFeature: Feature = {
                        type: 'Feature' as const,
                        id: newId,
                        geometry: feature.geometry,
                        properties: initialProps as Record<string, unknown>,
                        project_id: activeProject?.id || ''
                    };
                    // Mapbox Draw expects a specific format, Feature matches enough
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
    }, [activeProject, refreshFeatures, syncFeaturesList, pendingTemplate, insertFeature]) // Added pendingTemplate dep

    // New Handler for "Create Another"
    const handleCreateAnother = (geometryType: string, currentProps: Record<string, unknown>) => {
        if (!drawRef.current) return;

        // set pending template keys (values empty)
        const templateKeys = Object.keys(currentProps).reduce((acc, key) => {
            acc[key] = '';
            return acc;
        }, {} as Record<string, unknown>);

        setPendingTemplate(templateKeys);

        // Start drawing mode
        let mode = 'simple_select';
        if (geometryType === 'Point') mode = 'draw_point';
        else if (geometryType === 'LineString') mode = 'draw_line_string';
        else if (geometryType === 'Polygon') mode = 'draw_polygon';

        // Cast to any because Mapbox Draw types are not fully compatible with string literals sometimes
        // or just use correct type if available. 'simple_select' | 'draw_point' ...
        drawRef.current.changeMode(mode as string);
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
                    } catch {
                        toast.error('Failed to delete feature from DB')
                    }
                }
            }
        }
        if (activeProject) refreshFeatures()
        setSelectedFeatureId(null)
        syncFeaturesList()
    }, [activeProject, refreshFeatures, syncFeaturesList, deleteFeature])

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
            } catch {
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
                properties: { ...feature.properties, ...newProps },
                project_id: activeProject.id
            } as Feature;

            try {
                const data = await insertFeature(featureToSave, activeProject.id);

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
                    type: 'Feature',
                    properties: newProps
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                } as any)
            }
        }

        syncFeaturesList()
    }


    const handleCreateProject = async () => {
        if (!newProjectName) return
        await createProject(newProjectName)
        setNewProjectName('')
        setIsProjectDialogOpen(false)
        toast.success('Project created and active')
    }

    const handleSignOut = async () => {
        await supabase.auth.signOut()
        router.push('/login')
        toast.success('Signed out successfully')
    }

    const handleFeatureClick = (feature: Feature) => {
        if (!drawRef.current) return;

        // Select in Draw
        // This highlights it.
        drawRef.current.changeMode('simple_select', { featureIds: [feature.id] });

        // Update Local State
        setSelectedFeatureId(feature.id);
        setSelectedFeatureProps(feature.properties || {});

        // Fly to feature
        const geom = feature.geometry;
        if (geom.type === 'Point') {
            mapRef.current?.flyTo({ center: geom.coordinates as [number, number], zoom: 15 });
        } else if (geom.type === 'LineString' && geom.coordinates.length > 0) {
            const coords = geom.coordinates as number[][];
            mapRef.current?.flyTo({ center: coords[0] as [number, number], zoom: 15 });
        } else if (geom.type === 'Polygon' && geom.coordinates.length > 0) {
            const coords = geom.coordinates as number[][][];
            if (coords[0].length > 0) {
                mapRef.current?.flyTo({ center: coords[0][0] as [number, number], zoom: 15 });
            }
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

    const getFeatureName = (f: Feature, index: number) => {
        if (f.properties?.name) return f.properties.name as string;
        if (f.properties?.title) return f.properties.title as string;
        // Search for any string property
        const firstString = Object.values(f.properties || {}).find(v => typeof v === 'string');
        if (firstString) return firstString as string;
        return `${f.geometry.type} ${index + 1}`
    }

    // Create a robust lookup map for features (DB + Local)
    const featureLookup = React.useMemo(() => {
        const map = new Map<string, Feature>();

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

    const onHover = React.useCallback((event: mapboxgl.MapLayerMouseEvent) => {
        const { point, lngLat } = event;
        // Query features under the cursor
        // We filter for features that are likely ours (e.g. have an ID or geometry)
        // Note: mapbox-gl-draw layers usually start with 'gl-draw'
        if (!event.target.isStyleLoaded()) return;

        let features;
        try {
            features = event.target.queryRenderedFeatures(point);
        } catch (e) {
            console.warn('Map query failed:', e);
            return;
        }
        const drawFeature = features.find((f) => f.source && String(f.source).includes('mapbox-gl-draw'));

        if (drawFeature) {
            setHoverInfo({
                longitude: lngLat.lng,
                latitude: lngLat.lat,
                feature: drawFeature as unknown as Feature
            });
            event.target.getCanvas().style.cursor = 'pointer';
        } else {
            setHoverInfo(null);
            event.target.getCanvas().style.cursor = '';
        }
    }, []);

    return (
        <div className="relative w-full h-full flex">
            {/* Top Left Project Controls */}
            <div className="hidden md:flex absolute top-4 left-4 z-10 w-80 space-y-2 flex-col max-h-[calc(100%-2rem)]">
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

                                            onDelete({ features: [f] });
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
            <div className="hidden md:flex absolute bottom-4 left-4 z-10 flex-col-reverse items-start gap-2">
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
                            <Button variant="outline" size="sm" className="w-full text-xs h-8" onClick={() => setIsConfigOpen(true)}>
                                <Edit className="mr-2 h-3 w-3" /> Settings
                            </Button>
                        </CardContent>
                    </Card>
                )}
            </div>

            <ConfigModal
                open={isConfigOpen}
                onOpenChange={setIsConfigOpen}
                initialPreferences={userPreferences}
                onSave={(prefs) => {
                    setUserPreferences(prefs)
                    // Force refresh of map styles if needed, though data-driven styles should update 
                    // automatically if we were using 'setPaintProperty', but here we are using Draw styles
                    // which read from feature properties. 

                    // WAIT: The map styles use ['get', 'user_point_color']. This means they read from the FEATURE properties.
                    // But changing global preferences shouldn't necessarily change EXISTING features unless we update them 
                    // or if we want the "default" to apply to features that don't have overrides.
                    // 
                    // However, my map styles use 'coalesce' with a hardcoded fallback. 
                    // To make global prefs apply to existing features that use defaults, we'd need to update the style definition dynamically.
                    // Mapbox Draw doesn't easily support dynamic style updates at runtime without re-creating the control.
                    //
                    // ALTERNATIVE: We can update the FEATURE properties of all features to match new defaults? 
                    // Or better, we should inject the Current Global Prefs as the 'fallback' in the style itself? 
                    // But 'styles' prop is passed to DrawControl once. 
                    //
                    // Valid approach: Remount DrawControl when styles change? Or just use feature properties for everything.
                    // User requested: "change default properties". This usually implies for NEW features. 
                    // If they want to change existing ones, they might expect that too.
                    // Let's stick to "Defaults for NEW features" for now as per "change the default properties".
                    // But if I want to see the change immediately, I might expect it to apply to things I just drew.

                    // For now, I will just update the state so NEW features get these props.
                    toast.success('Preferences updated for new features')
                }}
            />

            <Dialog open={isPreviewOpen} onOpenChange={setIsPreviewOpen}>
                <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
                    <DialogHeader>
                        <DialogTitle>GeoJSON Preview & Export</DialogTitle>
                    </DialogHeader>

                    <div className="flex items-center gap-4 py-2">
                        <div className="grid w-full max-w-sm items-center gap-1.5">
                            <Label htmlFor="crs-select">Spatial Reference System</Label>
                            <Select value={exportCRS} onValueChange={(v) => setExportCRS(v as SpatialReference)}>
                                <SelectTrigger id="crs-select" className="w-[280px]">
                                    <SelectValue placeholder="Select Coordinate System" />
                                </SelectTrigger>
                                <SelectContent>
                                    {SPATIAL_REFERENCES.map((ref) => (
                                        <SelectItem key={ref.value} value={ref.value}>
                                            {ref.label}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    <div className="flex-1 overflow-auto bg-neutral-100 dark:bg-neutral-900 p-4 rounded text-xs font-mono">
                        <pre>{React.useMemo(() => {
                            const baseValues = {
                                type: 'FeatureCollection',
                                features: dbFeatures.map(f => ({
                                    type: 'Feature',
                                    geometry: f.geometry,
                                    properties: f.properties
                                }))
                            };
                            return JSON.stringify(convertGeoJSON(baseValues, exportCRS), null, 2);
                        }, [dbFeatures, exportCRS])}</pre>
                    </div>
                    <div className="flex justify-end pt-4">
                        <Button onClick={() => {
                            try {
                                const baseValues = {
                                    type: 'FeatureCollection',
                                    features: dbFeatures.map(f => ({
                                        type: 'Feature',
                                        geometry: f.geometry,
                                        properties: f.properties
                                    }))
                                };

                                const transformedData = convertGeoJSON(baseValues, exportCRS);
                                const data = JSON.stringify(transformedData, null, 2)

                                const blob = new Blob([data], { type: 'application/geo+json' })
                                const url = URL.createObjectURL(blob)
                                const a = document.createElement('a')
                                a.href = url
                                a.download = `${activeProject?.name || 'export'}_${exportCRS}.geojson`
                                document.body.appendChild(a)
                                a.click()
                                document.body.removeChild(a)
                                URL.revokeObjectURL(url)
                                setIsPreviewOpen(false)
                                toast.success(`Exported as ${exportCRS}`)
                            } catch (e) {
                                console.error(e);
                                toast.error('Export failed: ' + (e as Error).message);
                            }
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
                    <div className="hidden md:block">
                        <NavigationControl position="bottom-right" />
                    </div>
                    <ForwardedDrawControl
                        ref={drawRef}
                        key={JSON.stringify(userPreferences)}
                        position="top-right"
                        displayControlsDefault={false}
                        controls={{
                            point: true,
                            line_string: true,
                            polygon: true,
                            trash: true
                        }}
                        styles={drawStyles}
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

            {/* Attribute Editor - Floating Panel (Desktop) */}
            {
                selectedFeatureId && (
                    <div className="hidden md:block absolute top-4 right-14 z-20 w-96 bg-background/95 backdrop-blur-sm shadow-lg rounded-lg border p-4 max-h-[80vh] overflow-y-auto">
                        <AttributeEditor
                            key={selectedFeatureId}
                            featureId={selectedFeatureId}
                            initialProperties={selectedFeatureProps}
                            featureGeometry={
                                featuresList.find(f => f.id === selectedFeatureId)?.geometry ||
                                dbFeatures.find(f => f.id === selectedFeatureId)?.geometry
                            } // Pass geometry
                            onSave={handleAttributeSave}
                            onDelete={() => {
                                // Double confirmation removed - AttributeEditor handles the UI
                                // Call onDelete with structure expected by Mapbox Draw / our handler
                                onDelete({ features: [{ id: selectedFeatureId } as Feature] })
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

            {/* Mobile Feature Summary Sheet */}
            {selectedFeatureId && mobileTab === 'map' && !mobileEditMode && (
                <div className="md:hidden fixed bottom-16 left-0 right-0 z-30 bg-background border-t p-4 pb-6 shadow-2xl animate-in slide-in-from-bottom-4">
                    <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-3">
                            {(() => {
                                const f = featuresList.find(f => f.id === selectedFeatureId) || dbFeatures.find(f => f.id === selectedFeatureId);
                                if (!f) return <MapPin className="h-5 w-5" />;
                                return getFeatureIcon(f.geometry.type);
                            })()}
                            <div>
                                <h4 className="font-semibold text-sm">
                                    {(() => {
                                        const f = featuresList.find(f => f.id === selectedFeatureId) || dbFeatures.find(f => f.id === selectedFeatureId);
                                        if (!f) return 'Unknown Feature';
                                        return getFeatureName(f, 0);
                                    })()}
                                </h4>
                                <p className="text-xs text-muted-foreground">Tap edit to view full details</p>
                            </div>
                        </div>
                        <Button variant="ghost" size="sm" onClick={() => setSelectedFeatureId(null)}>
                            <X className="h-4 w-4" />
                        </Button>
                    </div>

                    {/* Mobile Read-only Properties List */}
                    <div className="max-h-40 overflow-y-auto mb-4 bg-muted/30 rounded p-2 text-xs space-y-1">
                        {(() => {
                            const f = featuresList.find(f => f.id === selectedFeatureId) || dbFeatures.find(f => f.id === selectedFeatureId);
                            const props = f?.properties || {};
                            const entries = Object.entries(props).filter(([k]) => {
                                const lower = k.toLowerCase();
                                return !['id', 'meta', 'active', 'mode', 'project_id'].some(x => lower.includes(x));
                            });

                            if (entries.length === 0) return <div className="text-muted-foreground italic">No properties set</div>;

                            return entries.map(([k, v]) => (
                                <div key={k} className="flex gap-2 border-b border-border/50 pb-1 last:border-0">
                                    <span className="font-semibold text-muted-foreground min-w-[30%] truncate">{k}:</span>
                                    <span className="break-all">{String(v)}</span>
                                </div>
                            ));
                        })()}
                    </div>

                    <div className="flex gap-2">
                        <Button className="flex-1" onClick={() => setMobileEditMode(true)}>
                            <Edit className="mr-2 h-4 w-4" /> Edit Attributes
                        </Button>
                    </div>
                </div>
            )}

            {/* Mobile Full Screen Attribute Editor */}
            {selectedFeatureId && mobileEditMode && (
                <div className="md:hidden fixed inset-0 z-50 bg-background flex flex-col">
                    <div className="flex items-center p-4 border-b">
                        <Button variant="ghost" size="icon" onClick={() => setMobileEditMode(false)}>
                            <ChevronLeft className="h-5 w-5" />
                        </Button>
                        <h2 className="font-semibold ml-2">Edit Feature</h2>
                    </div>
                    <div className="flex-1 overflow-hidden p-4">
                        <AttributeEditor
                            key={`mobile-${selectedFeatureId}`}
                            featureId={selectedFeatureId}
                            initialProperties={selectedFeatureProps}
                            featureGeometry={
                                featuresList.find(f => f.id === selectedFeatureId)?.geometry ||
                                dbFeatures.find(f => f.id === selectedFeatureId)?.geometry
                            }
                            onSave={handleAttributeSave}
                            onDelete={() => {
                                onDelete({ features: [{ id: selectedFeatureId } as Feature] })
                                if (drawRef.current) {
                                    drawRef.current.delete(selectedFeatureId)
                                    setSelectedFeatureId(null)
                                    setMobileEditMode(false)
                                }
                            }}
                            onClose={() => setMobileEditMode(false)}
                            onCreateAnother={(type, props) => {
                                setMobileEditMode(false)
                                handleCreateAnother(type, props)
                            }}
                        />
                    </div>
                </div>
            )}

            {/* Mobile Map Controls (FAB) */}
            {mobileTab === 'map' && !isDrawingMobile && !mobileEditMode && !selectedFeatureId && (
                <div className="md:hidden fixed bottom-20 right-4 z-30 flex flex-col gap-2">
                    <Dialog open={showMobileDrawMenu} onOpenChange={setShowMobileDrawMenu}>
                        {/* Trigger handled manually or via a button that opens state */}
                    </Dialog>

                    {showMobileDrawMenu && (
                        <div className="absolute bottom-14 right-0 flex flex-col gap-2 animate-in slide-in-from-bottom-2 fade-in duration-200">
                            <Button size="icon" className="rounded-full shadow-lg h-10 w-10" onClick={() => {
                                if (drawRef.current) {
                                    drawRef.current.changeMode('draw_point');
                                    setIsDrawingMobile(true);
                                    setShowMobileDrawMenu(false);
                                    toast.info('Tap map to place point');
                                }
                            }}>
                                <MapPin className="h-4 w-4" />
                            </Button>
                            <Button size="icon" className="rounded-full shadow-lg h-10 w-10" onClick={() => {
                                if (drawRef.current) {
                                    drawRef.current.changeMode('draw_line_string');
                                    setIsDrawingMobile(true);
                                    setShowMobileDrawMenu(false);
                                    toast.info('Tap to draw line');
                                }
                            }}>
                                <Route className="h-4 w-4" />
                            </Button>
                            <Button size="icon" className="rounded-full shadow-lg h-10 w-10" onClick={() => {
                                if (drawRef.current) {
                                    drawRef.current.changeMode('draw_polygon');
                                    setIsDrawingMobile(true);
                                    setShowMobileDrawMenu(false);
                                    toast.info('Tap to draw area');
                                }
                            }}>
                                <Square className="h-4 w-4" />
                            </Button>
                        </div>
                    )}

                    <Button
                        size="icon"
                        className={`h-14 w-14 rounded-full shadow-lg transition-transform ${showMobileDrawMenu ? 'rotate-45' : ''}`}
                        onClick={() => setShowMobileDrawMenu(!showMobileDrawMenu)}
                    >
                        <Plus className="h-6 w-6" />
                    </Button>
                </div>
            )}

            {/* Mobile Drawing Actions (Finish/Cancel) */}
            {isDrawingMobile && (
                <div className="md:hidden fixed top-4 left-1/2 -translate-x-1/2 z-40 flex gap-4 bg-background/80 backdrop-blur rounded-full p-2 shadow-lg border">
                    <Button variant="ghost" size="icon" className="h-10 w-10 rounded-full text-destructive" onClick={() => {
                        if (drawRef.current) {
                            drawRef.current.changeMode('simple_select');
                            drawRef.current.deleteAll(); // Or just delete the one in progress? usually deleting all clears temp
                            setIsDrawingMobile(false);
                        }
                    }}>
                        <X className="h-6 w-6" />
                    </Button>
                    <Button variant="default" size="icon" className="h-10 w-10 rounded-full bg-green-500 hover:bg-green-600" onClick={() => {
                        // Mapbox Draw finishes on 'enter' or double click.
                        // We can programmatically change mode to simple_select to 'finish'
                        if (drawRef.current) {
                            drawRef.current.changeMode('simple_select');
                            // The 'create' event will fire if valid
                            setIsDrawingMobile(false);
                        }
                    }}>
                        <Check className="h-6 w-6" />
                    </Button>
                </div>
            )}

            {/* Mobile Bottom Navigation */}
            <div className="md:hidden fixed bottom-0 left-0 right-0 h-16 bg-background border-t z-40 flex justify-around items-center pb-2">
                <Button
                    variant="ghost"
                    className={`flex flex-col items-center gap-1 h-auto py-2 ${mobileTab === 'map' ? 'text-primary' : 'text-muted-foreground'}`}
                    onClick={() => setMobileTab('map')}
                >
                    <MapIcon className="h-5 w-5" />
                    <span className="text-[10px]">Map</span>
                </Button>
                <Button
                    variant="ghost"
                    className={`flex flex-col items-center gap-1 h-auto py-2 ${mobileTab === 'projects' ? 'text-primary' : 'text-muted-foreground'}`}
                    onClick={() => setMobileTab('projects')}
                >
                    <FolderOpen className="h-5 w-5" />
                    <span className="text-[10px]">Projects</span>
                </Button>
                <Button
                    variant="ghost"
                    className={`flex flex-col items-center gap-1 h-auto py-2 ${mobileTab === 'templates' ? 'text-primary' : 'text-muted-foreground'}`}
                    onClick={() => setMobileTab('templates')}
                >
                    <BookTemplate className="h-5 w-5" />
                    <span className="text-[10px]">Templates</span>
                </Button>
                <Button
                    variant="ghost"
                    className={`flex flex-col items-center gap-1 h-auto py-2 ${mobileTab === 'profile' ? 'text-primary' : 'text-muted-foreground'}`}
                    onClick={() => setMobileTab('profile')}
                >
                    <User className="h-5 w-5" />
                    <span className="text-[10px]">Profile</span>
                </Button>
            </div>

            {/* Mobile Projects View */}
            {mobileTab === 'projects' && (
                <div className="md:hidden fixed inset-0 z-30 bg-background flex flex-col pb-16">
                    <div className="p-4 border-b flex justify-between items-center bg-card">
                        <h2 className="text-lg font-semibold">Projects</h2>
                    </div>
                    <div className="p-4 flex-1 overflow-y-auto space-y-4">
                        {/* New Project Input */}
                        <div className="flex gap-2 mb-6">
                            <Input placeholder="New Project Name" value={newProjectName} onChange={e => setNewProjectName(e.target.value)} />
                            <Button onClick={handleCreateProject} size="icon"><Plus className="h-4 w-4" /></Button>
                        </div>

                        {/* Current Project Card */}
                        <Card>
                            <CardHeader className="p-4 pb-2">
                                <CardTitle className="text-sm font-medium uppercase text-muted-foreground">Current</CardTitle>
                            </CardHeader>
                            <CardContent className="p-4 pt-2">
                                {activeProject ? (
                                    <div className="flex items-center justify-between">
                                        <span className="font-bold truncate">{activeProject.name}</span>
                                        <Button size="sm" variant="outline" onClick={() => setIsPreviewOpen(true)}>
                                            Export
                                        </Button>
                                    </div>
                                ) : (
                                    <span className="text-muted-foreground italic">None selected</span>
                                )}
                            </CardContent>
                        </Card>

                        {/* Project List */}
                        <div>
                            <h4 className="text-sm font-medium mb-2 text-muted-foreground uppercase">All Projects</h4>
                            <div className="space-y-2">
                                {projects.length === 0 && <p className="text-sm text-neutral-500">No projects found.</p>}
                                {projects.map(p => (
                                    <Card key={p.id} className={`overflow-hidden ${activeProject?.id === p.id ? 'border-primary' : ''}`}>
                                        <div className="flex items-center p-3">
                                            <div
                                                className="flex-1 font-medium truncate cursor-pointer"
                                                onClick={() => {
                                                    setActiveProject(p);
                                                    setMobileTab('map');
                                                    toast.success(`Switched to ${p.name}`);
                                                }}
                                            >
                                                {p.name}
                                            </div>
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-8 w-8 text-muted-foreground hover:text-destructive"
                                                onClick={() => setProjectToDelete(p)}
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    </Card>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Mobile Templates View */}
            {mobileTab === 'templates' && (
                <div className="md:hidden fixed inset-0 z-30 bg-background flex flex-col pb-16">
                    <div className="p-4 border-b flex justify-between items-center bg-card">
                        <h2 className="text-lg font-semibold">Template Library</h2>
                    </div>
                    <div className="flex-1 overflow-hidden p-4">
                        <TemplateListContent onApplyParams={(props) => {
                            if (drawRef.current) {
                                setPendingTemplate(props);
                                setMobileTab('map');
                                // Could activate draw mode here too if we wanted
                                setShowMobileDrawMenu(true);
                                toast.info('Template applied. Select a tool to draw.');
                            }
                        }} />
                    </div>
                </div>
            )}

            {/* Mobile Profile View */}
            {mobileTab === 'profile' && (
                <div className="md:hidden fixed inset-0 z-30 bg-background flex flex-col pb-16">
                    <div className="p-4 border-b flex justify-between items-center bg-card">
                        <h2 className="text-lg font-semibold">Profile</h2>
                    </div>
                    <div className="p-4 space-y-4">
                        <Card>
                            <CardHeader>
                                <CardTitle className="text-base">{user?.email}</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <Button variant="destructive" className="w-full" onClick={handleSignOut}>
                                    <LogOut className="mr-2 h-4 w-4" /> Sign Out
                                </Button>
                            </CardContent>
                        </Card>
                    </div>
                </div>
            )}

        </div >
    )
}
