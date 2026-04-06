import { Link } from '@tanstack/react-router';

import { PageLayout } from '~/components/shared';
import * as Icon from '~/components/icon';
import { Text } from '~/components/ui';

import { useTheme } from '~/store/theme';
import {
    SETTINGS_MCP_ROUTE,
    SETTINGS_MANAGE_IMAGE_ROUTE,
    SETTINGS_PLACEHOLDER_ROUTE,
    SETTINGS_TRASH_ROUTE
} from '~/modules/url';

const Setting = () => {
    const { theme, toggleTheme } = useTheme(state => state);
    const cardClassName = 'surface-base flex flex-col items-center gap-3 p-6 text-center transition-colors hover:bg-hover-subtle';

    return (
        <PageLayout title="Settings" description="Customize your Ocean Brain experience">
            <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
                <button
                    type="button"
                    className={cardClassName}
                    onClick={toggleTheme}>
                    <span className="text-3xl">
                        {theme === 'dark' ? (
                            <Icon.Moon className="h-8 w-8 text-fg-secondary" weight="fill" />
                        ) : (
                            <Icon.Sun className="h-8 w-8 text-fg-secondary" weight="fill" />
                        )}
                    </span>
                    <Text variant="body" weight="semibold">Theme</Text>
                    <Text variant="label" weight="medium" tone="tertiary">
                        {theme === 'dark' ? 'Dark mode' : 'Light mode'}
                    </Text>
                </button>
                <Link
                    to={SETTINGS_MCP_ROUTE}
                    className={cardClassName}>
                    <Icon.LinkIcon className="h-8 w-8 text-fg-secondary" />
                    <Text variant="body" weight="semibold">MCP</Text>
                    <Text variant="label" weight="medium" tone="tertiary">
                        Manage AI integration access
                    </Text>
                </Link>
                <Link
                    to={SETTINGS_TRASH_ROUTE}
                    search={{ page: 1 }}
                    className={cardClassName}>
                    <Icon.TrashCan className="h-8 w-8 text-fg-secondary" />
                    <Text variant="body" weight="semibold">Trash</Text>
                    <Text variant="label" weight="medium" tone="tertiary">
                        Restore deleted notes
                    </Text>
                </Link>
                <Link
                    to={SETTINGS_MANAGE_IMAGE_ROUTE}
                    search={{ page: 1 }}
                    className={cardClassName}>
                    <Icon.Image className="h-8 w-8 text-fg-secondary" />
                    <Text variant="body" weight="semibold">Manage Image</Text>
                    <Text variant="label" weight="medium" tone="tertiary">
                        Upload and organize images
                    </Text>
                </Link>
                <Link
                    to={SETTINGS_PLACEHOLDER_ROUTE}
                    search={{ page: 1 }}
                    className={cardClassName}>
                    <Icon.Pencil className="h-8 w-8 text-fg-secondary" />
                    <Text variant="body" weight="semibold">Placeholder</Text>
                    <Text variant="label" weight="medium" tone="tertiary">
                        Manage template variables
                    </Text>
                </Link>
            </div>
        </PageLayout>
    );
};

export default Setting;
