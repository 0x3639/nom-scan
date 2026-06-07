import { useParams } from "react-router-dom";
import { useMomentum, useLatestMomentumHeight } from "../api/queries";
import { MomentumHeader } from "../components/momentum/MomentumHeader";
import { MomentumDetailsTable } from "../components/momentum/MomentumDetailsTable";
import { Breadcrumb } from "../components/Breadcrumb";
import { MomentumBadge } from "../components/MomentumBadge";
import { SkeletonRows } from "../components/state/Skeleton";
import { ErrorState } from "../components/state/ErrorState";
import { NotFoundState } from "../components/state/NotFoundState";
import { isNotFoundError } from "../api/client";
import { isMomentumHeight, normalizeMomentum } from "@shared/validate/identifier";

export function MomentumPage() {
  const { height = "" } = useParams<{ height: string }>();
  const valid = isMomentumHeight(height);
  const normalized = valid ? normalizeMomentum(height) : "";
  const q = useMomentum(normalized);
  const latest = useLatestMomentumHeight();

  if (!valid) {
    return (
      <NotFoundState
        title="Invalid momentum height"
        {...(height ? { query: height } : {})}
        message="A momentum height is a positive whole number."
      />
    );
  }

  const heightNum = Number(normalized);
  const crumb = (
    <Breadcrumb
      items={[
        { label: "Home", to: "/" },
        { label: "Momentum" },
        { label: `#${heightNum.toLocaleString()}` },
      ]}
      rightSlot={<MomentumBadge />}
    />
  );

  if (q.isLoading) {
    return (
      <div>
        {crumb}
        <MomentumHeader height={heightNum} latest={latest} />
        <SkeletonRows rows={6} height={28} />
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
          title="Momentum not found"
          query={normalized}
          message="No momentum matches this height."
        />
      </div>
    );
  }

  return (
    <div>
      {crumb}
      <MomentumHeader height={heightNum} latest={latest} />
      <MomentumDetailsTable momentum={q.data} />
    </div>
  );
}
