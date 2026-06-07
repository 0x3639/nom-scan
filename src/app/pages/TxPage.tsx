import { useParams } from "react-router-dom";
import { useTransaction } from "../api/queries";
import { TxHeader } from "../components/tx/TxHeader";
import { TxDetailsTable } from "../components/tx/TxDetailsTable";
import { Breadcrumb } from "../components/Breadcrumb";
import { MomentumBadge } from "../components/MomentumBadge";
import { SkeletonRows } from "../components/state/Skeleton";
import { ErrorState } from "../components/state/ErrorState";
import { NotFoundState } from "../components/state/NotFoundState";
import { isNotFoundError } from "../api/client";
import { isHash, normalizeHash } from "@shared/validate/identifier";
import { truncateMiddle } from "@shared/format/address";

export function TxPage() {
  const { hash = "" } = useParams<{ hash: string }>();
  const normalized = normalizeHash(hash);
  const valid = isHash(hash);
  const q = useTransaction(valid ? normalized : "");

  if (!valid) {
    return (
      <NotFoundState
        title="Invalid transaction hash"
        {...(hash ? { query: hash } : {})}
        message="An account-block hash is 64 hexadecimal characters."
      />
    );
  }

  const crumb = (
    <Breadcrumb
      items={[
        { label: "Home", to: "/" },
        { label: "Transaction" },
        { label: truncateMiddle(normalized, 8, 6) },
      ]}
      rightSlot={<MomentumBadge />}
    />
  );

  if (q.isLoading) {
    return (
      <div>
        {crumb}
        <TxHeader hash={normalized} status="unknown" />
        <SkeletonRows rows={8} height={28} />
      </div>
    );
  }

  if (q.isError && !isNotFoundError(q.error)) {
    return <ErrorState error={q.error} retry={() => void q.refetch()} />;
  }
  if (q.isError || !q.data) {
    return (
      <div>
        {crumb}
        <NotFoundState
          title="Transaction not found"
          query={normalized}
          message="No account-block matches this hash."
        />
      </div>
    );
  }

  return (
    <div>
      {crumb}
      <TxHeader hash={q.data.hash || normalized} status="confirmed" />
      <TxDetailsTable tx={q.data} />
    </div>
  );
}
