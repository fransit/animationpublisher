import Link from "next/link";

export default function Home() {
  return (
    <main>
      <h1 style={{ marginTop: 0 }}>Roblox Asset Publisher</h1>
      <p>Login with Roblox, choose a creator, upload an <b>.rbxm</b>, then publish using Open Cloud.</p>
      <div style={{ display: "flex", gap: 12 }}>
        <Link href="/login">Login</Link>
        <Link href="/dashboard">Dashboard</Link>
      </div>
    </main>
  );
}
