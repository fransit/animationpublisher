import Link from "next/link";
import { cookies } from "next/headers";

async function getUploads(q: string | null) {
  const cookie = cookies().get("rbx_session")?.value;
  const url = new URL(`${process.env.APP_URL}/api/uploads`);
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
      <main>
        <h2>Uploads</h2>
        <p>Not logged in.</p>
        <Link href="/login">Login</Link>
      </main>
    );
  }

  return (
    <main>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
        <h2 style={{ margin: 0 }}>Uploads</h2>
        <Link href="/dashboard">Back</Link>
      </div>

      <div style={{ height: 10 }} />

      <div style={{ display: "grid", gap: 10 }}>
        {data.uploads.length === 0 && <div style={{ opacity: 0.7 }}>No uploads yet.</div>}
        {data.uploads.map((u: any) => (
          <div key={u.id} style={{ border: "1px solid #eee", borderRadius: 14, padding: 14 }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
              <div>
                <div style={{ fontWeight: 700 }}>{u.asset_name}</div>
                <div style={{ opacity: 0.75, fontSize: 13 }}>
                  {u.creator_type}:{u.creator_id} • {new Date(u.created_at).toLocaleString()}
                </div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontWeight: 700 }}>{u.status}</div>
                <div style={{ opacity: 0.75, fontSize: 13 }}>
                  {u.asset_id ? `AssetId: ${u.asset_id}` : u.operation_path ? "Processing…" : ""}
                </div>
              </div>
            </div>

            {u.error && (
              <div style={{ marginTop: 10, color: "#b00020", whiteSpace: "pre-wrap" }}>
                {u.error}
              </div>
            )}
          </div>
        ))}
      </div>
    </main>
  );
}
