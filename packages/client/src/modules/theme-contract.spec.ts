// @vitest-environment node
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

import { THEME_VARIABLE_NAMES } from './theme-contract';

describe('theme contract', () => {
    it('keeps the public JSON schema aligned with the runtime allowlist', () => {
        const schema = JSON.parse(
            readFileSync(new URL('../../public/schemas/ocean-brain-theme-v1.schema.json', import.meta.url), 'utf8'),
        );
        const schemaVariables = schema.$defs.variables.propertyNames.enum as string[];

        expect([...schemaVariables].sort()).toEqual([...THEME_VARIABLE_NAMES].sort());
    });

    it('provides a Studio fallback for every public variable', () => {
        const styles = readFileSync(new URL('../styles/tailwind.css', import.meta.url), 'utf8');

        for (const variableName of THEME_VARIABLE_NAMES) {
            expect(styles).toContain(`${variableName}:`);
        }
    });
});
