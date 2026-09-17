export {
    connectIntegration,
    disconnectIntegration,
    fetchIntegrations,
    revokeIntegrationToken,
    rotateIntegrationToken,
    updateIntegration,
} from '~/apis/integration-adapter';
export type {
    IntegrationConnection,
    IntegrationManifest,
    IntegrationPermission,
    IntegrationUpdate,
} from './integration.types';
export { INTEGRATION_PERMISSIONS } from './integration.types';

import axios from 'axios';

export const getIntegrationErrorMessage = (error: unknown) => {
    if (axios.isAxiosError<{ message?: string }>(error) && error.response?.data?.message) {
        return error.response.data.message;
    }
    return error instanceof Error ? error.message : 'The integration request failed.';
};
