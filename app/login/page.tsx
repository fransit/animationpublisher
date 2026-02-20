export default function Login() {
  return (
    <main>
      <h2>Login</h2>
      <p>Sign in using Roblox OAuth.</p>
      <a
        href="/api/auth/roblox/start"
        style={{
          display: "inline-block",
          padding: "10px 14px",
          border: "1px solid #ddd",
          borderRadius: 10,
          textDecoration: "none",
        }}
      >
        Continue with Roblox
      </a>
    </main>
  );
}
