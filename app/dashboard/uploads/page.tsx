import Link from "next/link";
import { cookies } from "next/headers";

async function getUploads(q: string | null) {
  const cookie = cookies().get("rbx_session")?.value;
  const baseUrl = process.env.APP_URL ?? "http://localhost:3000";
  const url = new URL(`${baseUrl}/api/uploads`);
  if (q) url.searchParams.set("q", q);
  const res = await fetch(url.toString(), {
    headers: cookie ? { cookie: `rbx_session=${cookie}` } : {},
    cache: "no-store",
  });
  if (!res.ok) return null;
  return res.json();
}

export default async function UploadsPage({ searchParams }: { searchParams: { q?: string } }) {
  const data = await getUploads(searchParams.q ?? null);

  if (!data) {
    return (
      <main className="grid">
        <section className="card grid">
          <h2 style={{ margin: 0 }}>Uploads</h2>
          <p className="muted" style={{ margin: 0 }}>
            Not logged in.
          </p>
          <Link href="/login">Login</Link>
        </section>
      </main>
    );
  }

  return (
    <main className="grid">
      <section className="card row">
        <h2 style={{ margin: 0 }}>Uploads</h2>
        <Link href="/dashboard">Back</Link>
      </section>

      <div className="table-list">
        {data.uploads.length === 0 && <div className="card muted">No uploads yet.</div>}
        {data.uploads.map((u: any) => (
          <div key={u.id} className="card">
            <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
              <div>
                <div style={{ fontWeight: 700 }}>{u.asset_name}</div>
                <div className="muted" style={{ fontSize: 13 }}>
                  {u.creator_type}:{u.creator_id} • {u.asset_type ?? "ASSET"} • {new Date(u.created_at).toLocaleString()}
                </div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div className={`pill ${u.status === "DONE" ? "ok" : u.status === "ERROR" ? "err" : "warn"}`}>{u.status}</div>
                <div className="muted" style={{ fontSize: 13, marginTop: 6 }}>
                  {u.asset_id ? `AssetId: ${u.asset_id}` : u.operation_path ? "Processing…" : ""}
                </div>
              </div>
            </div>

            {u.error && (
              <div style={{ marginTop: 10 }} className="error-box">{u.error}</div>
            )}
          </div>
        ))}
      </div>
    </main>
  );
}
