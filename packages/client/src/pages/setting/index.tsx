import { Link } from '@tanstack/react-router';
import * as Icon from '~/components/icon';
import { PageLayout } from '~/components/shared';
import { Text } from '~/components/ui';
import {
    SETTINGS_MANAGE_IMAGE_ROUTE,
    SETTINGS_MCP_ROUTE,
    SETTINGS_PLACEHOLDER_ROUTE,
    SETTINGS_TRASH_ROUTE,
} from '~/modules/url';
import { useTheme } from '~/store/theme';

const Setting = () => {
    const { theme, toggleTheme } = useTheme((state) => state);
    const itemClassName =
        'focus-ring-soft surface-base group flex items-start justify-between gap-3.5 px-4 py-3.5 text-left text-fg-default outline-none transition-colors hover:bg-hover-subtle';
    const leadingClassName =
        'inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-[15px] border border-border-subtle bg-muted text-fg-secondary transition-colors group-hover:border-border-secondary/70 group-hover:text-fg-default';
    const iconClassName = 'h-6 w-6';
    const sectionLabelClassName = 'text-fg-tertiary';
    const contentClassName = 'min-w-0 flex flex-col gap-0.5 pt-0.5';

    return (
        <PageLayout title="Settings" description="Manage appearance, integrations, and workspace tools">
            <div className="flex flex-col gap-6">
                <section className="flex flex-col gap-3">
                    <Text as="p" variant="label" weight="medium" className={sectionLabelClassName}>
                        Appearance
                    </Text>
                    <button type="button" className={itemClassName} onClick={toggleTheme}>
                        <div className="flex min-w-0 items-start gap-3">
                            <span className={leadingClassName}>
                                <Icon.Palette className={iconClassName} />
                            </span>
                            <div className={contentClassName}>
                                <Text as="div" variant="body" weight="medium">
                                    Theme
                                </Text>
                                <Text as="div" variant="meta" tone="secondary">
                                    Switch between light and dark mode.
                                </Text>
                            </div>
                        </div>
                        <div className="mt-0.5 flex shrink-0 items-center gap-2 text-fg-tertiary">
                            <Text as="span" variant="meta" weight="medium" tone="secondary">
                                {theme === 'dark' ? 'Dark' : 'Light'}
                            </Text>
                            {theme === 'dark' ? (
                                <Icon.Moon className="h-4 w-4" weight="fill" />
                            ) : (
                                <Icon.Sun className="h-4 w-4" weight="fill" />
                            )}
                        </div>
                    </button>
                </section>

                <section className="flex flex-col gap-3">
                    <Text as="p" variant="label" weight="medium" className={sectionLabelClassName}>
                        Integrations
                    </Text>
                    <Link to={SETTINGS_MCP_ROUTE} className={itemClassName}>
                        <div className="flex min-w-0 items-start gap-3">
                            <span className={leadingClassName}>
                                <Icon.LinkIcon className={iconClassName} />
                            </span>
                            <div className={contentClassName}>
                                <Text as="div" variant="body" weight="medium">
                                    MCP
                                </Text>
                                <Text as="div" variant="meta" tone="secondary">
                                    Manage AI integration access.
                                </Text>
                            </div>
                        </div>
                        <Icon.ChevronRight className="mt-0.5 h-4 w-4 shrink-0 text-fg-tertiary transition-transform group-hover:translate-x-0.5 group-hover:text-fg-secondary" />
                    </Link>
                </section>

                <section className="flex flex-col gap-3">
                    <Text as="p" variant="label" weight="medium" className={sectionLabelClassName}>
                        Workspace
                    </Text>
                    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                        <Link to={SETTINGS_TRASH_ROUTE} search={{ page: 1 }} className={itemClassName}>
                            <div className="flex min-w-0 items-start gap-3">
                                <span className={leadingClassName}>
                                    <Icon.TrashCan className={iconClassName} />
                                </span>
                                <div className={contentClassName}>
                                    <Text as="div" variant="body" weight="medium">
                                        Trash
                                    </Text>
                                    <Text as="div" variant="meta" tone="secondary">
                                        Restore deleted notes.
                                    </Text>
                                </div>
                            </div>
                            <Icon.ChevronRight className="mt-0.5 h-4 w-4 shrink-0 text-fg-tertiary transition-transform group-hover:translate-x-0.5 group-hover:text-fg-secondary" />
                        </Link>
                        <Link to={SETTINGS_MANAGE_IMAGE_ROUTE} search={{ page: 1 }} className={itemClassName}>
                            <div className="flex min-w-0 items-start gap-3">
                                <span className={leadingClassName}>
                                    <Icon.Image className={iconClassName} />
                                </span>
                                <div className={contentClassName}>
                                    <Text as="div" variant="body" weight="medium">
                                        Images
                                    </Text>
                                    <Text as="div" variant="meta" tone="secondary">
                                        Upload and organize images.
                                    </Text>
                                </div>
                            </div>
                            <Icon.ChevronRight className="mt-0.5 h-4 w-4 shrink-0 text-fg-tertiary transition-transform group-hover:translate-x-0.5 group-hover:text-fg-secondary" />
                        </Link>
                        <Link to={SETTINGS_PLACEHOLDER_ROUTE} search={{ page: 1 }} className={itemClassName}>
                            <div className="flex min-w-0 items-start gap-3">
                                <span className={leadingClassName}>
                                    <Icon.Pencil className={iconClassName} />
                                </span>
                                <div className={contentClassName}>
                                    <Text as="div" variant="body" weight="medium">
                                        Placeholders
                                    </Text>
                                    <Text as="div" variant="meta" tone="secondary">
                                        Manage template variables.
                                    </Text>
                                </div>
                            </div>
                            <Icon.ChevronRight className="mt-0.5 h-4 w-4 shrink-0 text-fg-tertiary transition-transform group-hover:translate-x-0.5 group-hover:text-fg-secondary" />
                        </Link>
                    </div>
                </section>
            </div>
        </PageLayout>
    );
};

export default Setting;
