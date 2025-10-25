
import styles from './Progress.module.scss';

interface ProgressProps {
    value: number;
    max: number;
    color?: 'primary' | 'success' | 'danger';
}

export default function Progress({ value, max, color = 'primary' }: ProgressProps) {
    const percentage = Math.min(100, Math.max(0, (value / max) * 100));

    return (
        <div className={styles.progressContainer}>
            <div
                className={`${styles.progressBar} ${styles[color]}`}
                style={{ width: `${percentage}%` }}
            />
        </div>
    );
}
