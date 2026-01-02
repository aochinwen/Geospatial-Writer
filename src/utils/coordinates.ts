
import proj4 from 'proj4';

// Define SVY21 (EPSG:3414)
// Source: https://epsg.io/3414
const SVY21 = '+proj=tmerc +lat_0=1.366666666666667 +lon_0=103.8333333333333 +k=1 +x_0=28001.642 +y_0=38744.572 +ellps=WGS84 +units=m +no_defs';
const WGS84 = 'EPSG:4326';

// Register standard projections
proj4.defs('EPSG:3414', SVY21);
proj4.defs('EPSG:4326', '+proj=longlat +datum=WGS84 +no_defs');

export type SpatialReference = 'WGS84' | 'SVY21';

export const SPATIAL_REFERENCES: { label: string, value: SpatialReference }[] = [
    { label: 'WGS84 (Lat/Lon)', value: 'WGS84' },
    { label: 'SVY21 (Singapore)', value: 'SVY21' },
];

/**
 * Recursively projects coordinates in a geometry
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const projectCoordinate = (coords: any[], from: string, to: string): any[] => {
    // If it's a simple point pair [x, y] or [x, y, z]
    if (typeof coords[0] === 'number') {
        return proj4(from, to, coords);
    }
    // If it's an array of coordinates (LineString, Polygon rings, etc.)
    return coords.map(c => projectCoordinate(c, from, to));
};

/**
 * Converts a GeoJSON FeatureCollection to the target Spatial Reference
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const convertGeoJSON = (geoJSON: any, targetCRS: SpatialReference) => {
    if (targetCRS === 'WGS84') {
        return geoJSON;
    }

    const targetProj = 'EPSG:3414';
    const sourceProj = WGS84;

    const newFeatures = geoJSON.features.map((f: any) => {
        const newGeometry = { ...f.geometry };
        newGeometry.coordinates = projectCoordinate(f.geometry.coordinates, sourceProj, targetProj);

        return {
            ...f,
            geometry: newGeometry
        };
    });

    const result = {
        ...geoJSON,
        features: newFeatures,
        // Add CRS object for GIS software compatibility
        crs: {
            type: 'name',
            properties: {
                name: 'urn:ogc:def:crs:EPSG::3414'
            }
        }
    };

    return result;
};
