interface Props {
  title: string;
}

export function ComingSoon({ title }: Props) {
  return (
    <div style={{ textAlign: "center", padding: "64px 16px", color: "var(--color-muted)" }}>
      <h1 style={{ fontSize: 22, margin: "0 0 8px", color: "var(--color-text)" }}>{title}</h1>
      <p style={{ margin: 0 }}>Coming soon.</p>
    </div>
  );
}
