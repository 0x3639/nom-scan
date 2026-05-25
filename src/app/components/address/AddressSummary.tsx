import { useMemo } from "react";
import type { AddressSummary as AddressSummaryData, BalanceEntry } from "@shared/api/pfscan";
import { useAddressActivityBounds, useAddressBalances, useAddressSummary } from "../../api/queries";
import { formatAmount } from "@shared/format/amount";
import { formatDate } from "@shared/format/time";

const SUMMARY_DECIMALS = 4;
import { Skeleton } from "../state/Skeleton";
import { ErrorState } from "../state/ErrorState";
import styles from "./AddressSummary.module.css";

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

function readField(summary: AddressSummaryData | undefined, ...keys: string[]): unknown {
  if (!summary) return undefined;
  for (const k of keys) {
    const v = (summary as Record<string, unknown>)[k];
    if (v !== undefined && v !== null) return v;
  }
  return undefined;
}

function formatCount(value: unknown): string {
  if (typeof value === "number") return value.toLocaleString();
  if (typeof value === "string" && /^\d+$/.test(value)) return Number(value).toLocaleString();
  return "—";
}

export function AddressSummary({ address }: Props) {
  const summary = useAddressSummary(address);
  const balances = useAddressBalances(address);
  const bounds = useAddressActivityBounds(address);

  const named = useMemo(
    () => (balances.data ? pickBalances(balances.data) : { znn: null, qsr: null, otherCount: 0 }),
    [balances.data],
  );

  if (summary.isError) return <ErrorState error={summary.error} retry={() => void summary.refetch()} />;

  const producedCount = readField(summary.data, "block_count", "account_block_count");
  const delegate = readField(summary.data, "delegate", "delegation");

  return (
    <section className={styles.grid} aria-label="Address summary">
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
        {summary.isLoading ? <Skeleton width={70} height={18} /> : <Value mono>{formatCount(producedCount)}</Value>}
      </Card>
      <Card
        label="Transactions"
        title="All account-blocks where this address appears, including paired-receive blocks. Matches the count in the Transactions tab."
      >
        {bounds.isLoading && bounds.total === undefined ? (
          <Skeleton width={70} height={18} />
        ) : (
          <Value mono>{bounds.total != null ? bounds.total.toLocaleString() : "—"}</Value>
        )}
      </Card>
      <Card label="First active">
        {bounds.isLoading && bounds.firstTimestamp == null ? (
          <Skeleton width={130} height={16} />
        ) : (
          <Value muted>{bounds.firstTimestamp != null ? formatDate(bounds.firstTimestamp) : "—"}</Value>
        )}
      </Card>
      <Card label="Last active">
        {bounds.isLoading && bounds.lastTimestamp == null ? (
          <Skeleton width={130} height={16} />
        ) : (
          <Value muted>{bounds.lastTimestamp != null ? formatDate(bounds.lastTimestamp) : "—"}</Value>
        )}
      </Card>
      {delegate ? (
        <Card label="Delegate" wide>
          <Value mono muted>{String(delegate)}</Value>
        </Card>
      ) : null}
    </section>
  );
}

function Card({
  label,
  children,
  wide = false,
  title,
}: {
  label: string;
  children: React.ReactNode;
  wide?: boolean;
  title?: string;
}) {
  return (
    <div className={`${styles.card} ${wide ? styles.cardWide : ""}`} title={title}>
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
