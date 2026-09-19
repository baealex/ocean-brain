import { EventEmitter } from 'node:events';

const INTEGRATION_ACCESS_CHANGE_CHANNEL = 'integration-access-change';
const integrationAccessEmitter = new EventEmitter();

integrationAccessEmitter.setMaxListeners(0);

export const emitIntegrationAccessChanged = (connectionId: string) => {
    integrationAccessEmitter.emit(INTEGRATION_ACCESS_CHANGE_CHANNEL, connectionId);
};

export const subscribeIntegrationAccessChanges = (listener: (connectionId: string) => void) => {
    integrationAccessEmitter.on(INTEGRATION_ACCESS_CHANGE_CHANNEL, listener);
    return () => {
        integrationAccessEmitter.off(INTEGRATION_ACCESS_CHANGE_CHANNEL, listener);
    };
};
