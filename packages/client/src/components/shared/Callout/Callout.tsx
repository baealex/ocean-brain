import * as Icon from '~/components/icon';

interface CalloutProps {
    children: React.ReactNode;
    className?: string;
}

const Callout = ({ children, className = '' }: CalloutProps) => {
    return (
        <div className={`flex items-start gap-2.5 rounded-[12px] border border-border-subtle bg-hover-subtle/50 px-4 py-3 ${className}`}>
            <Icon.Info className="mt-0.5 h-4 w-4 shrink-0 text-fg-tertiary" />
            <div className="text-sm font-medium text-fg-secondary">
                {children}
            </div>
        </div>
    );
};

export default Callout;
