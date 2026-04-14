import * as Icon from '~/components/icon';
import { Text } from '~/components/ui';

interface CalloutProps {
    children: React.ReactNode;
    className?: string;
}

const Callout = ({ children, className = '' }: CalloutProps) => {
    return (
        <div
            className={`flex items-start gap-2.5 rounded-[12px] border border-border-subtle bg-hover-subtle/50 px-4 py-3 ${className}`}
        >
            <Icon.Info className="mt-0.5 h-4 w-4 shrink-0 text-fg-tertiary" />
            <Text as="div" variant="meta" weight="medium" tone="secondary">
                {children}
            </Text>
        </div>
    );
};

export default Callout;
