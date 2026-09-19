// @vitest-environment node
import { normalizeIntegrationAppLocation, resolveIntegrationAppSource } from './integration-app-bridge';

describe('integration app bridge locations', () => {
    it('normalizes relative app locations and rejects paths that can escape the app root', () => {
        expect(normalizeIntegrationAppLocation('/results?query=coral#match')).toBe('/results?query=coral#match');
        expect(normalizeIntegrationAppLocation('https://example.com/results')).toBeUndefined();
        expect(normalizeIntegrationAppLocation('//example.com/results')).toBeUndefined();
        expect(normalizeIntegrationAppLocation('/%252e%252e/settings')).toBeUndefined();
        expect(normalizeIntegrationAppLocation('/results%252fsettings')).toBeUndefined();
    });

    it('keeps the launch root while applying app history state', () => {
        expect(resolveIntegrationAppSource('https://app.example/search?setup=true', '/')).toBe(
            'https://app.example/search?setup=true',
        );
        expect(resolveIntegrationAppSource('https://app.example/search?setup=true', '/?query=coral&page=2')).toBe(
            'https://app.example/search?query=coral&page=2',
        );
        expect(resolveIntegrationAppSource('https://app.example/search', '/details/42?tab=links')).toBe(
            'https://app.example/search/details/42?tab=links',
        );
    });
});
