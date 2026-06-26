import axios from 'axios';
import { resetAuthCsrfRetryStateForTests, retryCsrfRequest, shouldRetryCsrfRequest } from './auth-csrf-retry';
import { redirectToLogin, resetAuthNavigationStateForTests, shouldRedirectToLogin } from './auth-navigation';
import { resetAuthSessionRecoveryStateForTests } from './auth-session-recovery';

let authRedirectInterceptorId: number | undefined;

export const resetAuthRedirectStateForTests = () => {
    authRedirectInterceptorId = undefined;
    resetAuthNavigationStateForTests();
    resetAuthSessionRecoveryStateForTests();
    resetAuthCsrfRetryStateForTests();
};

export const installAuthRedirectInterceptor = () => {
    if (authRedirectInterceptorId !== undefined) {
        return;
    }

    authRedirectInterceptorId = axios.interceptors.response.use(
        (response) => response,
        (error) => {
            if (shouldRedirectToLogin(error)) {
                redirectToLogin();
            } else if (shouldRetryCsrfRequest(error)) {
                return retryCsrfRequest(error);
            }

            return Promise.reject(error);
        },
    );
};

export { isCsrfTokenInvalidFailure, shouldRetryCsrfRequest } from './auth-csrf-retry';
export { buildAuthLoginPath, redirectToLogin, shouldRedirectToLogin } from './auth-navigation';
export {
    isExpiredAuthSession,
    redirectToLoginIfSessionExpired,
    reloadForSessionGenerationChange,
    rememberSessionGeneration,
} from './auth-session-recovery';
