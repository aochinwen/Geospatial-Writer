export interface Feature {
    id: string
    geometry: any
    properties: any
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
    properties: Record<string, any>
    created_at?: string
}
