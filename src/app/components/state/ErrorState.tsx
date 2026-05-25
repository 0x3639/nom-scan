import type { PFScanErrorCode } from "@shared/api/pfscan";
import { PFScanFetchError } from "../../api/client";
import styles from "./State.module.css";

interface Props {
  error: unknown;
  retry?: () => void;
}

interface ErrorMessage {
  title: string;
  message: string;
}

function messageForCode(code: PFScanErrorCode, retryAfter?: number): ErrorMessage {
  switch (code) {
    case "not_found":
      return { title: "Not found", message: "That record doesn't exist in the indexer." };
    case "rate_limited":
      return {
        title: "Too many requests",
        message: retryAfter
          ? `PFScan is receiving too many requests. Try again in ${retryAfter}s.`
          : "PFScan is receiving too many requests. Please retry shortly.",
      };
    case "upstream_unavailable":
      return { title: "Indexer unavailable", message: "Indexer is syncing or temporarily unavailable." };
    case "upstream_auth":
      return { title: "Service unavailable", message: "Explorer is temporarily unable to reach indexed data." };
    case "upstream_error":
      return { title: "Indexer error", message: "The indexer returned an error. Please try again." };
    case "bad_request":
      return { title: "Bad request", message: "The request was rejected as malformed." };
    default:
      return { title: "Something went wrong", message: "An unexpected error occurred." };
  }
}

export function ErrorState({ error, retry }: Props) {
  let code: PFScanErrorCode = "internal";
  let retryAfter: number | undefined;
  if (error instanceof PFScanFetchError) {
    code = error.error.code;
    retryAfter = error.error.retryAfter;
  }
  const { title, message } = messageForCode(code, retryAfter);
  return (
    <div className={styles.error} role="alert">
      <p className={styles.errorTitle}>{title}</p>
      <p className={styles.errorMsg}>{message}</p>
      {retry ? (
        <button className={styles.retry} onClick={retry}>
          Retry
        </button>
      ) : null}
    </div>
  );
}
