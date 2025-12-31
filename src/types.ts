
export interface Geometry {
    type: 'Point' | 'LineString' | 'Polygon' | 'MultiPoint' | 'MultiLineString' | 'MultiPolygon'
    coordinates: unknown[]
}

export interface Feature {
    id: string
    geometry: Geometry
    properties: Record<string, unknown>
    project_id: string
    created_at?: string
}

export interface Project {
    id: string
    name: string
    user_id: string
    created_at?: string
}

export interface FeatureTemplate {
    id: string
    user_id: string
    name: string
    properties: Record<string, unknown>
    created_at?: string
}
