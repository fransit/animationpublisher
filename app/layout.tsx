import "./globals.css";

export const metadata = {
  title: "Roblox Asset Publisher",
  description: "Upload .rbxm and publish via Open Cloud",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <div className="app-shell">
          <div className="topbar">
            <a className="brand" href="/">
              Animation Publisher
            </a>
            <div style={{ display: "flex", gap: 12 }}>
              <a href="/login">Login</a>
              <a href="/dashboard">Dashboard</a>
            </div>
          </div>
          {children}
        </div>
      </body>
    </html>
  );
}
