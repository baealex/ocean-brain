import styles from './Skeleton.module.scss';
import classNames from 'classnames';

interface SkeletonProps {
    className?: string;
    width?: string;
    height?: string;
    opacity?: number;
}

const Skeleton = ({ className, ...style }: SkeletonProps) => {
    return (
        <div className={classNames(styles.skeleton, className)} style={style}/>
    );
};

export default Skeleton;
