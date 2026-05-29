import { useMemo } from "react";
import type { BalanceEntry } from "@shared/api/pfscan";
import { useAddressBalances, useAddressSummary } from "../../api/queries";
import { formatAmount } from "@shared/format/amount";
import { formatDate } from "@shared/format/time";
import { Skeleton } from "../state/Skeleton";
import { ErrorState } from "../state/ErrorState";
import styles from "./AddressSummary.module.css";

const SUMMARY_DECIMALS = 4;
const ZNN_STANDARD = "zts1znnxxxxxxxxxxxxx9z4ulx";
const QSR_STANDARD = "zts1qsrxxxxxxxxxxxxxmrhjll";

interface Props {
  address: string;
}

interface NamedBalance {
  display: string;
}

function pickBalances(balances: BalanceEntry[]): {
  znn: NamedBalance | null;
  qsr: NamedBalance | null;
  otherCount: number;
} {
  let znn: NamedBalance | null = null;
  let qsr: NamedBalance | null = null;
  let otherCount = 0;
  for (const b of balances) {
    const decimals = b.token?.decimals ?? 8;
    if (b.token_standard === ZNN_STANDARD || b.token?.symbol === "ZNN") {
      znn = { display: formatAmount(b.balance, decimals, { maxFractionDigits: SUMMARY_DECIMALS }) };
    } else if (b.token_standard === QSR_STANDARD || b.token?.symbol === "QSR") {
      qsr = { display: formatAmount(b.balance, decimals, { maxFractionDigits: SUMMARY_DECIMALS }) };
    } else {
      otherCount += 1;
    }
  }
  return { znn, qsr, otherCount };
}

function formatCount(value: number | undefined | null): string {
  return typeof value === "number" ? value.toLocaleString() : "—";
}

export function AddressSummary({ address }: Props) {
  const summary = useAddressSummary(address);
  const balances = useAddressBalances(address);

  const named = useMemo(
    () => (balances.data ? pickBalances(balances.data) : { znn: null, qsr: null, otherCount: 0 }),
    [balances.data],
  );

  if (summary.isError) return <ErrorState error={summary.error} retry={() => void summary.refetch()} />;

  const data = summary.data;
  const blockCount = typeof data?.block_count === "number" ? data.block_count : undefined;
  const txCount = typeof data?.tx_count === "number" ? data.tx_count : undefined;
  const firstSeen = typeof data?.first_seen === "number" ? data.first_seen : null;
  const lastSeen = typeof data?.last_seen === "number" ? data.last_seen : null;
  const delegate = typeof data?.delegate === "string" ? data.delegate : null;

  return (
    <section aria-label="Address summary">
      <div className={styles.grid}>
      <Card label="ZNN balance">
        {balances.isLoading ? <Skeleton width={80} height={18} /> : <Value mono>{named.znn?.display ?? "0"}</Value>}
      </Card>
      <Card label="QSR balance">
        {balances.isLoading ? <Skeleton width={80} height={18} /> : <Value mono>{named.qsr?.display ?? "0"}</Value>}
      </Card>
      <Card label="Other tokens">
        {balances.isLoading ? <Skeleton width={32} height={18} /> : <Value>{named.otherCount}</Value>}
      </Card>
      <Card
        label="Blocks"
        title="Account-blocks this address signed (sender side). Excludes paired-receive blocks where this address is the recipient."
      >
        {summary.isLoading ? <Skeleton width={70} height={18} /> : <Value mono>{formatCount(blockCount)}</Value>}
      </Card>
      <Card
        label="Transactions"
        title="All account-blocks where this address appears, including paired-receive blocks. Matches the count in the Transactions tab."
      >
        {summary.isLoading ? <Skeleton width={70} height={18} /> : <Value mono>{formatCount(txCount)}</Value>}
      </Card>
      <Card label="First active">
        {summary.isLoading ? (
          <Skeleton width={130} height={16} />
        ) : (
          <Value muted>{firstSeen != null ? formatDate(firstSeen) : "—"}</Value>
        )}
      </Card>
      <Card label="Last active">
        {summary.isLoading ? (
          <Skeleton width={130} height={16} />
        ) : (
          <Value muted>{lastSeen != null ? formatDate(lastSeen) : "—"}</Value>
        )}
      </Card>
      </div>
      {delegate ? (
        <div className={styles.belowGrid}>
          <Card label="Delegate">
            <Value mono muted>{delegate}</Value>
          </Card>
        </div>
      ) : null}
    </section>
  );
}

function Card({
  label,
  children,
  title,
}: {
  label: string;
  children: React.ReactNode;
  title?: string;
}) {
  return (
    <div className={styles.card} title={title}>
      <div className={styles.cardLabel}>{label}</div>
      <div className={styles.cardValue}>{children}</div>
    </div>
  );
}

function Value({ children, mono = false, muted = false }: { children: React.ReactNode; mono?: boolean; muted?: boolean }) {
  return (
    <span className={`${mono ? "mono" : ""} ${muted ? styles.muted : ""}`} style={{ fontSize: 15, fontWeight: 700 }}>
      {children}
    </span>
  );
}
