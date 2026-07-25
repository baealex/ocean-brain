import type { PropertyValueType } from '~/models.js';

interface RestoredPropertyIdentity {
    key: string;
    valueType: PropertyValueType;
    optionValue?: string | null;
}

interface RestoredPropertyTargetDeps {
    findDefinitionByKey: (key: string) => Promise<{ id: number; valueType: PropertyValueType } | null>;
    findOptionByValue: (definitionId: number, value: string) => Promise<{ id: number } | null>;
}

export const resolveRestoredPropertyTarget = async (
    property: RestoredPropertyIdentity,
    deps: RestoredPropertyTargetDeps,
) => {
    const definition = await deps.findDefinitionByKey(property.key);

    if (!definition || definition.valueType !== property.valueType) {
        return null;
    }

    if (property.valueType !== 'select') {
        return {
            propertyDefinitionId: definition.id,
            optionId: null,
        };
    }

    if (!property.optionValue) {
        return null;
    }

    const option = await deps.findOptionByValue(definition.id, property.optionValue);

    if (!option) {
        return null;
    }

    return {
        propertyDefinitionId: definition.id,
        optionId: option.id,
    };
};
