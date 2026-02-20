import Link from "next/link";

export default function Home() {
  return (
    <main className="grid">
      <section className="card grid">
        <h1 style={{ margin: 0 }}>Animation Publisher</h1>
        <p className="muted" style={{ margin: 0 }}>
          Login with Roblox OAuth, choose a creator, and publish multiple assets in one go.
        </p>
      </section>

      <section className="card">
        <div style={{ display: "flex", gap: 12 }}>
          <Link href="/dashboard">Open Dashboard</Link>
          <span className="muted">•</span>
          <Link href="/dashboard/uploads">View Upload History</Link>
        </div>
      </section>

      <section className="card">
        <div style={{ display: "flex", gap: 12 }}>
        <Link href="/login">Login</Link>
        </div>
      </section>
    </main>
  );
}
