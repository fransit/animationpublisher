import { cookies } from "next/headers";
import Link from "next/link";

async function getMe() {
  const cookie = cookies().get("rbx_session")?.value;
  const res = await fetch(`${process.env.APP_URL}/api/me`, {
    headers: cookie ? { cookie: `rbx_session=${cookie}` } : {},
    cache: "no-store",
  });
  if (!res.ok) return null;
  return res.json();
}

export default async function Dashboard() {
  const me = await getMe();

  if (!me) {
    return (
      <main>
        <h2>Dashboard</h2>
        <p>You are not logged in.</p>
        <Link href="/login">Go to login</Link>
      </main>
    );
  }

  return (
    <main>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
        <h2 style={{ margin: 0 }}>Dashboard</h2>
        <a href="/api/logout">Logout</a>
      </div>

      <p style={{ marginTop: 8 }}>
        Logged in as <b>{me.user?.name ?? me.user?.preferred_username ?? "Roblox user"}</b>
      </p>

      <section style={{ border: "1px solid #eee", borderRadius: 14, padding: 16 }}>
        <h3 style={{ marginTop: 0 }}>Upload & Publish</h3>
        <p style={{ marginTop: 0, opacity: 0.85 }}>
          Choose a creator then upload an <b>.rbxm</b>. We’ll publish it as a Model asset.
        </p>

        <form action="/api/upload" method="post" encType="multipart/form-data" style={{ display: "grid", gap: 10 }}>
          <label style={{ display: "grid", gap: 6 }}>
            Creator
            <select name="creatorKey" required defaultValue={me.defaultCreatorKey ?? ""}>
              {me.creators?.map((c: any) => (
                <option key={c.key} value={c.key}>
                  {c.label}
                </option>
              ))}
            </select>
          </label>

          <label style={{ display: "grid", gap: 6 }}>
            Asset name
            <input name="assetName" required placeholder="MyCoolModel" />
          </label>

          <label style={{ display: "grid", gap: 6 }}>
            RBXM file
            <input name="file" type="file" accept=".rbxm" required />
          </label>

          <button type="submit" style={{ padding: "10px 14px", borderRadius: 10, border: "1px solid #ddd" }}>
            Upload & Publish
          </button>
        </form>
      </section>

      <div style={{ height: 16 }} />

      <section style={{ border: "1px solid #eee", borderRadius: 14, padding: 16 }}>
        <h3 style={{ marginTop: 0 }}>My uploads</h3>
        <p style={{ marginTop: 0, opacity: 0.85 }}>Search works on name.</p>

        <form action="/dashboard/uploads" method="get" style={{ display: "flex", gap: 10, marginBottom: 10 }}>
          <input name="q" placeholder="Search name..." style={{ flex: 1 }} />
          <button type="submit" style={{ padding: "10px 14px", borderRadius: 10, border: "1px solid #ddd" }}>
            Search
          </button>
        </form>

        <a href="/dashboard/uploads">View uploads list</a>
      </section>
    </main>
  );
}
