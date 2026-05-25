import * as Icon from '~/components/icon';
import { Text } from '~/components/ui';

interface CalloutProps {
    children: React.ReactNode;
    className?: string;
    tone?: 'info' | 'danger';
}

const Callout = ({ children, className = '', tone = 'info' }: CalloutProps) => {
    const IconComponent = tone === 'danger' ? Icon.WarningCircle : Icon.Info;
    const toneClassName =
        tone === 'danger'
            ? 'border-border-error/70 bg-accent-soft-danger/60'
            : 'border-border-subtle bg-hover-subtle/50';
    const iconClassName = tone === 'danger' ? 'text-fg-error' : 'text-fg-tertiary';
    const textTone = tone === 'danger' ? 'error' : 'secondary';

    return (
        <div className={`flex items-center gap-2.5 rounded-[12px] border px-4 py-3 ${toneClassName} ${className}`}>
            <IconComponent className={`h-4 w-4 shrink-0 ${iconClassName}`} />
            <Text as="div" variant="meta" weight="medium" tone={textTone}>
                {children}
            </Text>
        </div>
    );
};

export default Callout;
