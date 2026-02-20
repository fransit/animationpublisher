export default function Login() {
  return (
    <main className="grid">
      <section className="card grid">
        <h2 style={{ margin: 0 }}>Login</h2>
        <p className="muted" style={{ margin: 0 }}>
          Sign in using Roblox OAuth.
        </p>
      </section>

      <section className="card">
      <a
        href="/api/auth/roblox/start"
        style={{
          display: "inline-block",
          padding: "10px 14px",
          border: "1px solid #2e63d2",
          borderRadius: 10,
          textDecoration: "none",
          background: "linear-gradient(180deg, #2f6fed, #2456bc)",
          color: "white",
          fontWeight: 600,
        }}
      >
        Continue with Roblox
      </a>
      </section>
    </main>
  );
}
