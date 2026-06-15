import {
    fetchLocalDemoMcpAdminStatus,
    revokeLocalDemoMcpToken,
    rotateLocalDemoMcpToken,
    setLocalDemoMcpEnabled,
} from '~/modules/local-demo/client';

export const fetchMcpAdminStatus = fetchLocalDemoMcpAdminStatus;
export const setMcpEnabled = setLocalDemoMcpEnabled;
export const rotateMcpToken = rotateLocalDemoMcpToken;
export const revokeMcpToken = revokeLocalDemoMcpToken;
