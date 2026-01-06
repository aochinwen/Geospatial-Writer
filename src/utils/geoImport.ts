import { Feature } from '@/types';
import { convertToWGS84 } from './coordinates';
import { v4 as uuidv4 } from 'uuid';

export interface ImportResult {
    validFeatures: Feature[];
    errors: string[];
    totalFound: number;
}

export const processGeoJSON = async (file: File, projectId: string): Promise<ImportResult> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const text = e.target?.result as string;
                const json = JSON.parse(text);
                const result = validateAndPrepareFeatures(json, projectId);
                resolve(result);
            } catch (err) {
                reject(new Error('Invalid JSON file format.'));
            }
        };
        reader.onerror = () => reject(new Error('Failed to read file.'));
        reader.readAsText(file);
    });
};

const validateAndPrepareFeatures = (json: any, projectId: string): ImportResult => {
    const errors: string[] = [];
    let validFeatures: Feature[] = [];

    // 1. Handle CRS Conversion if needed
    let processedJson = json;
    try {
        // convertToWGS84 returns a new object with converted coordinates if CRS is present
        processedJson = convertToWGS84(json);
    } catch (e) {
        errors.push(`CRS Conversion failed: ${(e as Error).message}`);
        return { validFeatures: [], errors, totalFound: 0 };
    }

    // 2. Extract Features
    let featuresArray: any[] = [];
    if (processedJson.type === 'FeatureCollection' && Array.isArray(processedJson.features)) {
        featuresArray = processedJson.features;
    } else if (processedJson.type === 'Feature') {
        featuresArray = [processedJson];
    } else {
        errors.push('File does not contain a valid FeatureCollection or Feature.');
        return { validFeatures: [], errors, totalFound: 0 };
    }

    // 3. Validate and Format Each Feature
    featuresArray.forEach((f, index) => {
        // Identifier for error messages
        const featureId = f.id || f.properties?.id || `Index ${index}`;

        if (!f.geometry || !f.geometry.type || !f.geometry.coordinates) {
            errors.push(`Feature [${featureId}]: Missing geometry data.`);
            return;
        }

        const validTypes = ['Point', 'LineString', 'Polygon', 'MultiPoint', 'MultiLineString', 'MultiPolygon'];
        if (!validTypes.includes(f.geometry.type)) {
            errors.push(`Feature [${featureId}]: Unsupported geometry type '${f.geometry.type}'.`);
            return;
        }

        // Prepare valid feature
        // Note: We generate a new UUID for the system, but keep original ID in properties if user wants it
        const newId = uuidv4();
        const properties = f.properties || {};

        // If the feature had an ID, ensure it's preserved in properties
        if (f.id && !properties.original_id) {
            properties.original_id = f.id;
        }

        validFeatures.push({
            type: 'Feature',
            id: newId,
            geometry: f.geometry,
            properties: properties,
            project_id: projectId
        });
    });

    return {
        validFeatures,
        errors,
        totalFound: featuresArray.length
    };
};
