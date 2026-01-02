import { UserPreferences } from '@/types'

export const getMapDrawStyles = (prefs: UserPreferences) => [
    // POINT
    {
        'id': 'gl-draw-point-inactive',
        'type': 'circle',
        'filter': ['all',
            ['==', 'active', 'false'],
            ['==', '$type', 'Point'],
            ['!=', 'mode', 'static']
        ],
        'paint': {
            'circle-radius': prefs.point_size,
            'circle-color': prefs.point_color,
            'circle-stroke-width': prefs.point_outline_width,
            'circle-stroke-color': prefs.point_outline_color
        }
    },
    {
        'id': 'gl-draw-point-active',
        'type': 'circle',
        'filter': ['all',
            ['==', '$type', 'Point'],
            ['!=', 'mode', 'static'],
            ['==', 'active', 'true']
        ],
        'paint': {
            'circle-radius': prefs.point_size + 2, // Enlarge slightly when active
            'circle-color': '#fbb03b', // Active color - keep distinct to show selection
            'circle-stroke-width': prefs.point_outline_width,
            'circle-stroke-color': '#fff'
        }
    },

    // LINE (LineString)
    {
        'id': 'gl-draw-line-inactive',
        'type': 'line',
        'filter': ['all',
            ['==', 'active', 'false'],
            ['==', '$type', 'LineString'],
            ['!=', 'mode', 'static']
        ],
        'layout': {
            'line-cap': 'round',
            'line-join': 'round'
        },
        'paint': {
            'line-color': prefs.polyline_color,
            'line-width': prefs.polyline_width
        }
    },
    {
        'id': 'gl-draw-line-active',
        'type': 'line',
        'filter': ['all',
            ['==', '$type', 'LineString'],
            ['!=', 'mode', 'static'],
            ['==', 'active', 'true']
        ],
        'layout': {
            'line-cap': 'round',
            'line-join': 'round'
        },
        'paint': {
            'line-color': '#fbb03b',
            'line-dasharray': [0.2, 2],
            'line-width': prefs.polyline_width + 2
        }
    },

    // POLYGON
    {
        'id': 'gl-draw-polygon-fill-inactive',
        'type': 'fill',
        'filter': ['all',
            ['==', 'active', 'false'],
            ['==', '$type', 'Polygon'],
            ['!=', 'mode', 'static']
        ],
        'paint': {
            'fill-color': prefs.polygon_fill_color,
            'fill-outline-color': prefs.polygon_outline_color,
            'fill-opacity': prefs.polygon_fill_opacity
        }
    },
    {
        'id': 'gl-draw-polygon-fill-active',
        'type': 'fill',
        'filter': ['all',
            ['==', 'active', 'true'],
            ['==', '$type', 'Polygon'],
            ['!=', 'mode', 'static']
        ],
        'paint': {
            'fill-color': '#fbb03b',
            'fill-outline-color': '#fbb03b',
            'fill-opacity': 0.1
        }
    },
    {
        'id': 'gl-draw-polygon-stroke-inactive',
        'type': 'line',
        'filter': ['all',
            ['==', 'active', 'false'],
            ['==', '$type', 'Polygon'],
            ['!=', 'mode', 'static']
        ],
        'layout': {
            'line-cap': 'round',
            'line-join': 'round'
        },
        'paint': {
            'line-color': prefs.polygon_outline_color,
            'line-width': prefs.polygon_outline_width
        }
    },
    {
        'id': 'gl-draw-polygon-stroke-active',
        'type': 'line',
        'filter': ['all',
            ['==', 'active', 'true'],
            ['==', '$type', 'Polygon'],
            ['!=', 'mode', 'static']
        ],
        'layout': {
            'line-cap': 'round',
            'line-join': 'round'
        },
        'paint': {
            'line-color': '#fbb03b',
            'line-dasharray': [0.2, 2],
            'line-width': prefs.polygon_outline_width
        }
    },

    // VERTICES (Control Points)
    {
        'id': 'gl-draw-polygon-and-line-vertex-stroke-inactive',
        'type': 'circle',
        'filter': ['all',
            ['==', 'meta', 'vertex'],
            ['==', '$type', 'Point'],
            ['!=', 'mode', 'static']
        ],
        'paint': {
            'circle-radius': 5,
            'circle-color': '#fff'
        }
    },
    {
        'id': 'gl-draw-polygon-and-line-vertex-inactive',
        'type': 'circle',
        'filter': ['all',
            ['==', 'meta', 'vertex'],
            ['==', '$type', 'Point'],
            ['!=', 'mode', 'static']
        ],
        'paint': {
            'circle-radius': 3,
            'circle-color': '#fbb03b'
        }
    },
    // STATIC (Non-editable) - Fallback to user styles
    {
        'id': 'gl-draw-point-static',
        'type': 'circle',
        'filter': ['all',
            ['==', 'mode', 'static'],
            ['==', '$type', 'Point']
        ],
        'paint': {
            'circle-radius': prefs.point_size,
            'circle-color': prefs.point_color,
            'circle-stroke-width': prefs.point_outline_width,
            'circle-stroke-color': prefs.point_outline_color
        }
    },
    {
        'id': 'gl-draw-line-static',
        'type': 'line',
        'filter': ['all',
            ['==', 'mode', 'static'],
            ['==', '$type', 'LineString']
        ],
        'layout': {
            'line-cap': 'round',
            'line-join': 'round'
        },
        'paint': {
            'line-color': prefs.polyline_color,
            'line-width': prefs.polyline_width
        }
    },
    {
        'id': 'gl-draw-polygon-fill-static',
        'type': 'fill',
        'filter': ['all',
            ['==', 'mode', 'static'],
            ['==', '$type', 'Polygon']
        ],
        'paint': {
            'fill-color': prefs.polygon_fill_color,
            'fill-outline-color': prefs.polygon_outline_color,
            'fill-opacity': prefs.polygon_fill_opacity
        }
    },
    {
        'id': 'gl-draw-polygon-stroke-static',
        'type': 'line',
        'filter': ['all',
            ['==', 'mode', 'static'],
            ['==', '$type', 'Polygon']
        ],
        'layout': {
            'line-cap': 'round',
            'line-join': 'round'
        },
        'paint': {
            'line-color': prefs.polygon_outline_color,
            'line-width': prefs.polygon_outline_width
        }
    }
];
