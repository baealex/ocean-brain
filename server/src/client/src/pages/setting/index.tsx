import { Link } from 'react-router-dom';

import { PageLayout } from '~/components/shared';
import * as Icon from '~/components/icon';

import { useTheme } from '~/store/theme';

const Setting = () => {
    const { theme, toggleTheme } = useTheme(state => state);

    return (
        <PageLayout title="Settings" description="Customize your Ocean Brain experience">
            <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
                <button
                    type="button"
                    className="flex flex-col items-center gap-3 bg-subtle p-6 rounded-[12px_4px_13px_3px/4px_10px_4px_12px] border-2 border-border-secondary font-bold hover:shadow-sketchy hover:-translate-y-0.5 active:translate-y-0 active:shadow-none transition-all"
                    onClick={toggleTheme}>
                    <span className="text-3xl">
                        {theme === 'dark' ? (
                            <Icon.Moon className="h-8 w-8 text-pastel-yellow-200" weight="fill" />
                        ) : (
                            <Icon.Sun className="h-8 w-8 text-pastel-orange-200" weight="fill" />
                        )}
                    </span>
                    <span>Theme</span>
                    <span className="text-xs text-fg-tertiary font-medium">
                        {theme === 'dark' ? 'Dark mode' : 'Light mode'}
                    </span>
                </button>
                <Link
                    to="manage-image"
                    className="flex flex-col items-center gap-3 bg-subtle p-6 rounded-[12px_4px_13px_3px/4px_10px_4px_12px] border-2 border-border-secondary font-bold hover:shadow-sketchy hover:-translate-y-0.5 active:translate-y-0 active:shadow-none transition-all">
                    <Icon.Image className="h-8 w-8 text-fg-secondary" />
                    <span>Manage Image</span>
                    <span className="text-xs text-fg-tertiary font-medium">
                        Upload and organize images
                    </span>
                </Link>
                <Link
                    to="placeholder"
                    className="flex flex-col items-center gap-3 bg-subtle p-6 rounded-[12px_4px_13px_3px/4px_10px_4px_12px] border-2 border-border-secondary font-bold hover:shadow-sketchy hover:-translate-y-0.5 active:translate-y-0 active:shadow-none transition-all">
                    <Icon.Pencil className="h-8 w-8 text-fg-secondary" />
                    <span>Placeholder</span>
                    <span className="text-xs text-fg-tertiary font-medium">
                        Manage template variables
                    </span>
                </Link>
            </div>
        </PageLayout>
    );
};

export default Setting;
