import Link from "next/link";
import { cookies } from "next/headers";

export default async function UploadsPage({ searchParams }: { searchParams: { q?: string; assetType?: string } }) {
  const q = searchParams.q ?? null;
  const selectedType = (searchParams.assetType ?? "").toUpperCase();
  const cookie = cookies().get("rbx_session")?.value;
  const baseUrl = process.env.APP_URL ?? "http://localhost:3000";
  const url = new URL(`${baseUrl}/api/uploads`);
  if (q) url.searchParams.set("q", q);
  if (selectedType === "ANIMATION" || selectedType === "AUDIO") url.searchParams.set("assetType", selectedType);
  const res = await fetch(url.toString(), {
    headers: cookie ? { cookie: `rbx_session=${cookie}` } : {},
    cache: "no-store",
  });
  const data = res.ok ? await res.json() : null;
  const returnTo = `/dashboard/uploads${q || selectedType ? `?${new URLSearchParams({ ...(q ? { q } : {}), ...(selectedType ? { assetType: selectedType } : {}) }).toString()}` : ""}`;

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

      <section className="card">
        <form method="get" style={{ display: "grid", gap: 10, gridTemplateColumns: "minmax(0,1fr) 200px auto" }}>
          <input name="q" defaultValue={q ?? ""} placeholder="Search name..." />
          <select name="assetType" defaultValue={selectedType}>
            <option value="">All types</option>
            <option value="ANIMATION">Animation</option>
            <option value="AUDIO">Sound</option>
          </select>
          <button type="submit">Filter</button>
        </form>
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

            {u.status === "ERROR" && u.operation_path ? (
              <form action="/api/upload/retry" method="post" style={{ marginTop: 10, display: "flex", gap: 8 }}>
                <input type="hidden" name="uploadId" value={u.id} />
                <input type="hidden" name="returnTo" value={returnTo} />
                <button className="secondary" type="submit" style={{ width: 170 }}>
                  Retry Failed Upload
                </button>
              </form>
            ) : null}
          </div>
        ))}
      </div>
    </main>
  );
}
