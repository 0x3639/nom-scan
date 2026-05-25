import styles from "./Skeleton.module.css";

interface Props {
  width?: number | string;
  height?: number | string;
  radius?: number | string;
  className?: string;
  inline?: boolean;
}

export function Skeleton({ width = "100%", height = 14, radius = 4, className = "", inline = false }: Props) {
  return (
    <span
      aria-hidden
      className={`${styles.skeleton} ${inline ? styles.inline : ""} ${className}`}
      style={{
        width: typeof width === "number" ? `${width}px` : width,
        height: typeof height === "number" ? `${height}px` : height,
        borderRadius: typeof radius === "number" ? `${radius}px` : radius,
      }}
    />
  );
}

export function SkeletonRows({ rows = 5, height = 14 }: { rows?: number; height?: number }) {
  return (
    <div role="status" aria-live="polite" aria-label="Loading">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} style={{ marginBottom: 10 }}>
          <Skeleton height={height} />
        </div>
      ))}
    </div>
  );
}
