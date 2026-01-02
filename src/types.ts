export interface Geometry {
    type: string
    coordinates: number[] | number[][] | number[][][]
}

export interface Feature {
    type?: string
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

export interface UserPreferences {
    user_id?: string
    point_color: string
    point_size: number
    point_outline_color: string
    point_outline_width: number
    polyline_color: string
    polyline_width: number
    polygon_fill_color: string
    polygon_fill_opacity: number
    polygon_outline_color: string
    polygon_outline_width: number
}
