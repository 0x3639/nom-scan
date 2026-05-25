import { Fragment } from "react";
import { Link } from "react-router-dom";
import { ChevronRight } from "lucide-react";
import styles from "./Breadcrumb.module.css";

export interface BreadcrumbItem {
  label: string;
  /** Omit `to` for the current/leaf item (renders as plain text). */
  to?: string;
}

interface Props {
  items: BreadcrumbItem[];
  /** Optional content rendered on the right side of the breadcrumb row (e.g. momentum badge). */
  rightSlot?: React.ReactNode;
}

export function Breadcrumb({ items, rightSlot }: Props) {
  return (
    <div className={styles.row}>
      <nav className={styles.crumb} aria-label="Breadcrumb">
        <ol className={styles.list}>
          {items.map((item, idx) => {
            const isLast = idx === items.length - 1;
            return (
              <Fragment key={`${item.label}-${idx}`}>
                <li className={styles.item}>
                  {item.to && !isLast ? (
                    <Link to={item.to} className={styles.link}>{item.label}</Link>
                  ) : (
                    <span className={styles.current} aria-current={isLast ? "page" : undefined}>
                      {item.label}
                    </span>
                  )}
                </li>
                {isLast ? null : (
                  <li className={styles.sep} aria-hidden>
                    <ChevronRight size={12} />
                  </li>
                )}
              </Fragment>
            );
          })}
        </ol>
      </nav>
      {rightSlot ? <div className={styles.rightSlot}>{rightSlot}</div> : null}
    </div>
  );
}
