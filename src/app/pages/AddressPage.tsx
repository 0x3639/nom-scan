import { useParams } from "react-router-dom";
import { useHashTab } from "../hooks/useHashTab";
import { AddressHeader } from "../components/address/AddressHeader";
import { AddressSummary } from "../components/address/AddressSummary";
import { AddressTabs, type AddressTab } from "../components/address/AddressTabs";
import { PortfolioTab } from "../components/address/PortfolioTab";
import { TransactionsTab } from "../components/address/TransactionsTab";
import { Breadcrumb } from "../components/Breadcrumb";
import { MomentumBadge } from "../components/MomentumBadge";
import { NotFoundState } from "../components/state/NotFoundState";
import { isAddress } from "@shared/validate/identifier";
import { truncateMiddle } from "@shared/format/address";

const TABS: readonly AddressTab[] = ["portfolios", "transactions"] as const;

export function AddressPage() {
  const { address = "" } = useParams<{ address: string }>();
  const [tab, setTab] = useHashTab<AddressTab>("portfolios", TABS);

  if (!address || !isAddress(address)) {
    return (
      <NotFoundState
        title="Invalid address"
        {...(address ? { query: address } : {})}
        message="A Zenon address looks like z1… (Bech32 lowercase)."
      />
    );
  }

  return (
    <div>
      <Breadcrumb
        items={[
          { label: "Home", to: "/" },
          { label: "Address" },
          { label: truncateMiddle(address, 6, 4) },
        ]}
        rightSlot={<MomentumBadge />}
      />
      <AddressHeader address={address} />
      <AddressSummary address={address} />
      <AddressTabs active={tab} onChange={setTab} />
      <div role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`} tabIndex={0}>
        {/* key={address} resets per-address local state (e.g. the transactions
            page number) when navigating between addresses — without it, the
            reused component instance keeps the old page. */}
        {tab === "portfolios" ? (
          <PortfolioTab key={address} address={address} />
        ) : (
          <TransactionsTab key={address} address={address} />
        )}
      </div>
    </div>
  );
}
