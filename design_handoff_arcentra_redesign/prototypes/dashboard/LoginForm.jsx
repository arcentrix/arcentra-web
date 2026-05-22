/* Web app — Login form. Adapted from arcentra-web/src/components/login-form.tsx.
   Centered, narrow, with social providers and an LDAP fallback. */

function LoginForm({ onLogin }) {
  const [username, setUsername] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [showPassword, setShowPassword] = React.useState(false);

  return (
    <main style={{
      minHeight: "100dvh",
      display: "flex", alignItems: "center", justifyContent: "center",
      padding: 24,
      position: "relative", overflow: "hidden",
    }}>
      <GridBg fade="radial" />
      <form
        onSubmit={(e) => { e.preventDefault(); onLogin?.(username); }}
        style={{
          position: "relative",
          width: "100%", maxWidth: 380,
          display: "flex", flexDirection: "column", gap: 20,
        }}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 14, marginBottom: 4 }}>
          <LogoLockup size={28} gap={10} />
          <h1 className="display" style={{ fontSize: 22, fontWeight: 600, letterSpacing: "-0.02em", margin: 0 }}>Welcome back</h1>
        </div>

        <Field label="Email / Username">
          <Input value={username} onChange={(e) => setUsername(e.target.value)} placeholder="m@example.com" />
        </Field>

        <Field label="Password" trailing={<button type="button" style={{ background: "transparent", border: 0, color: "var(--fg-muted)", fontSize: 12, cursor: "pointer" }}>Forgot password?</button>}>
          <div style={{ position: "relative" }}>
            <Input
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter your password"
            />
            <button type="button" onClick={() => setShowPassword((v) => !v)} aria-label={showPassword ? "Hide password" : "Show password"} style={{
              position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)",
              background: "transparent", border: 0, color: "var(--fg-muted)", cursor: "pointer",
              display: "inline-flex", alignItems: "center", justifyContent: "center",
            }}>
              <Icon d={I.eye} size={14} />
            </button>
          </div>
        </Field>

        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <Button variant="primary" size="md" type="submit">Login</Button>
          <div style={{ textAlign: "center", fontSize: 12, color: "var(--fg-muted)" }}>
            Don't have an account?{" "}
            <a href="#" style={{ color: "var(--fg)", textDecoration: "underline", textUnderlineOffset: 4 }}>Sign up</a>
          </div>
        </div>

        <Separator>Or</Separator>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <Button variant="outline" size="md" leftIcon={<Icon d={I.github} size={14} />}>github</Button>
          <Button variant="outline" size="md">ldap</Button>
        </div>
      </form>
    </main>
  );
}

function Field({ label, trailing, children }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <label style={{ fontSize: 13, fontWeight: 500 }}>{label}</label>
        {trailing}
      </div>
      {children}
    </div>
  );
}

function Input(props) {
  return (
    <input {...props} style={{
      width: "100%",
      height: 38, padding: "0 12px",
      background: "var(--bg-elevated)", border: "1px solid var(--border)",
      borderRadius: 8, color: "var(--fg)",
      fontFamily: "var(--font-sans)", fontSize: 13,
      outline: "none",
      ...(props.style || {}),
    }} />
  );
}

function Separator({ children }) {
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 12,
      color: "var(--fg-subtle)", fontFamily: "var(--font-mono)", fontSize: 11,
      letterSpacing: "0.08em", textTransform: "uppercase",
    }}>
      <div style={{ flex: 1, height: 1, background: "var(--border)" }} />
      <span>{children}</span>
      <div style={{ flex: 1, height: 1, background: "var(--border)" }} />
    </div>
  );
}

window.LoginForm = LoginForm;
