export interface Geometry {
    type: string
    coordinates: number[] | number[][] | number[][][]
}

export interface Feature {
    id: string
    geometry: Geometry
    properties: Record<string, unknown>
    project_id: string
}

export interface Project {
    id: string
    name: string
    user_id: string
}

export interface FeatureTemplate {
    id: string
    user_id: string
    name: string
    properties: Record<string, unknown>
    created_at?: string
}
