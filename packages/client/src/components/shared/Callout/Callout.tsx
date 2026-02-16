import * as Icon from '~/components/icon';

interface CalloutProps {
    children: React.ReactNode;
    className?: string;
}

const Callout = ({ children, className = '' }: CalloutProps) => {
    return (
        <div className={`bg-elevated py-3 px-4 rounded-[12px_4px_13px_3px/4px_10px_4px_12px] border-2 border-border-secondary shadow-sketchy ${className}`}>
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 flex-1">
                    <Icon.Info className="h-5 w-5 text-fg-muted" />
                    <div className="text-sm font-bold flex-1 text-fg-default">
                        {children}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Callout;
