const APPLE_PLATFORM_PATTERN = /Mac|iPhone|iPad|iPod/i;

const getCurrentPlatform = () => {
    if (typeof navigator === 'undefined') {
        return '';
    }

    return `${navigator.platform} ${navigator.userAgent}`;
};

export const getSearchShortcutLabel = (platform = getCurrentPlatform()) =>
    APPLE_PLATFORM_PATTERN.test(platform) ? '⌘K' : 'Ctrl+K';
