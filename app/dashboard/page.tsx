import { cookies } from "next/headers";
import Link from "next/link";
import UploadComposer from "./UploadComposer";

async function getMe() {
  const cookie = cookies().get("rbx_session")?.value;
  const baseUrl = process.env.APP_URL ?? "http://localhost:3000";
  const res = await fetch(`${baseUrl}/api/me`, {
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
        <section className="card grid">
          <h2 style={{ margin: 0 }}>Dashboard</h2>
          <p className="muted" style={{ margin: 0 }}>
            You are not logged in.
          </p>
          <Link href="/login">Go to login</Link>
        </section>
      </main>
    );
  }

  return (
    <main className="grid">
      <section className="card">
        <div className="row">
          <h2 style={{ margin: 0 }}>Dashboard</h2>
          <a href="/api/logout">Logout</a>
        </div>
        <p className="muted" style={{ marginBottom: 0 }}>
          Logged in as <b>{me.user?.name ?? me.user?.preferred_username ?? "Roblox user"}</b>
        </p>
      </section>

      <section className="card grid">
        <h3 style={{ margin: 0 }}>Upload Assets</h3>
        <p className="muted" style={{ margin: 0 }}>
          SaaS batch flow: pick creator, then upload multiple audio files in one submit.
        </p>
        <UploadComposer creators={me.creators ?? []} defaultCreatorKey={me.defaultCreatorKey ?? ""} />
      </section>

      <section className="card grid">
        <h3 style={{ margin: 0 }}>My uploads</h3>
        <p className="muted" style={{ margin: 0 }}>
          Search by name and track processing status.
        </p>

        <form action="/dashboard/uploads" method="get" style={{ display: "flex", gap: 10 }}>
          <input name="q" placeholder="Search name..." style={{ flex: 1 }} />
          <button type="submit" style={{ width: 130 }}>
            Search
          </button>
        </form>

        <a href="/dashboard/uploads">View uploads list</a>
      </section>
    </main>
  );
}
