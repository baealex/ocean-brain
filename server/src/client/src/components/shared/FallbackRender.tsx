interface FallbackRenderProps {
    fallback: React.ReactNode;
    children: React.ReactNode;
}

const FallbackRender = ({ children, fallback }: FallbackRenderProps) => {
    if (!children || children === 0) {
        return fallback;
    }
    return children;
};

export default FallbackRender;
