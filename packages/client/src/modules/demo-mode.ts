export const IS_LOCAL_ONLY_DEMO_MODE = import.meta.env.VITE_DEMO_MODE === 'local-only';

export const isLocalOnlyDemoMode = () => IS_LOCAL_ONLY_DEMO_MODE;
