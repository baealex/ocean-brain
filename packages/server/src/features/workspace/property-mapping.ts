import type { PropertyValueType } from '~/models.js';
import { WorkspaceError } from './scope.js';

export interface PropertyWorkspaceMapping {
    sourceKey: string;
    targetKey: string;
}

export const mapWorkspacePropertyKeys = <T extends { key: string; name: string; valueType: PropertyValueType }>(
    source: T[],
    targets: Array<{ key: string; name: string; valueType: PropertyValueType }>,
    mappings: PropertyWorkspaceMapping[],
): T[] => {
    if (
        mappings.length !== source.length ||
        new Set(mappings.map((mapping) => mapping.sourceKey)).size !== source.length ||
        new Set(mappings.map((mapping) => mapping.targetKey)).size !== source.length
    ) {
        throw new WorkspaceError(
            'NOTE_MOVE_PROPERTY_MAPPING_REQUIRED',
            'Map each property to a different destination field before continuing.',
        );
    }
    return source.map((property) => {
        const mapping = mappings.find((mapping) => mapping.sourceKey === property.key);
        const target = targets.find((definition) => definition.key === mapping?.targetKey);
        if (!target || target.valueType !== property.valueType) {
            throw new WorkspaceError(
                'NOTE_MOVE_PROPERTY_MAPPING_REQUIRED',
                `Choose a compatible destination field for ${property.name}.`,
            );
        }
        return { ...property, key: target.key, name: target.name };
    });
};
