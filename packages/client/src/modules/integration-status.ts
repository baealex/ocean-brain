import type { IntegrationConnection } from '~/apis/integration.types';

export function getIntegrationStatus(integration: IntegrationConnection, now = Date.now()) {
    if (integration.manifest.launch?.mode === 'proxied' && !integration.proxyConfigured) {
        return {
            kind: 'address',
            label: 'App address needed',
            detail: 'Add an address in App settings.',
        };
    }
    if (integration.manifest.launch && integration.manifest.permissions.length === 0) {
        return {
            kind: integration.enabled ? 'page' : 'paused',
            label: integration.enabled ? 'App enabled' : 'Access paused',
            detail: null,
        };
    }
    if (!integration.token) {
        return {
            kind: 'setup',
            label: 'Setup needed',
            detail: null,
        };
    }
    if (integration.manifest.permissions.length > 0 && !integration.grantedPermissions.includes('notes:read')) {
        return {
            kind: 'permissions',
            label: 'No note access',
            detail: null,
        };
    }
    if (!integration.enabled) {
        return {
            kind: 'paused',
            label: 'Access paused',
            detail: null,
        };
    }
    const report = integration.statusReport;
    if (report) {
        if (report.state === 'running' && now - new Date(report.reportedAt).getTime() > 5 * 60_000) {
            return {
                kind: 'overdue',
                label: 'Progress update overdue',
                detail: 'Check the app before retrying.',
            };
        }
        const labels = {
            running: 'Working',
            succeeded: 'Completed',
            failed: 'Needs attention',
        };
        return { kind: report.state, label: labels[report.state], detail: report.message };
    }
    if (!integration.token.lastUsedAt) {
        return {
            kind: 'waiting',
            label: 'Waiting for first access',
            detail: null,
        };
    }
    return {
        kind: 'recorded',
        label: 'Connection recorded',
        detail: null,
    };
}
