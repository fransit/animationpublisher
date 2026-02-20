export const metadata = {
  title: "Roblox Asset Publisher",
  description: "Upload .rbxm and publish via Open Cloud",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body style={{ fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, Arial", margin: 0 }}>
        <div style={{ maxWidth: 980, margin: "0 auto", padding: 20 }}>
          {children}
        </div>
      </body>
    </html>
  );
}
