# Page spec · LoginForm

**Route:** `/login` (rendered as the entire page when `!authed`)  
**Reference prototype:** `prototypes/dashboard/LoginForm.jsx`  
**Mirrors source:** `arcentra-web/src/components/login-form.tsx`

## Layout

```
┌─ Full viewport, blueprint-bg behind ───────────────────┐
│                                                         │
│           ┌───────────────────────┐                    │
│           │     [Arc] arcentra/   │                    │
│           │      Welcome back     │                    │
│           ├───────────────────────┤                    │
│           │ Email / Username      │                    │
│           │ [m@example.com      ] │                    │
│           ├───────────────────────┤                    │
│           │ Password   Forgot?   │                    │
│           │ [••••••••       👁]   │                    │
│           ├───────────────────────┤                    │
│           │ [        Login       ]│                    │
│           │ Don't have? Sign up   │                    │
│           ├──── OR ────────────────┤                    │
│           │ [⎇ github] [⛓ ldap]   │                    │
│           └───────────────────────┘                    │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

## Outer container

```jsx
<main style={{
  minHeight: "100dvh",
  display: "flex", alignItems: "center", justifyContent: "center",
  padding: 24,
  position: "relative", overflow: "hidden",
}}>
  <GridBg fade="radial" />     {/* OR <div className="blueprint-bg fade-mask-radial" /> */}
  <form>…</form>
</main>
```

⚠️ Login uses the **dot-grid GridBg** (`.grid-bg`), NOT `.blueprint-bg`. The dot grid is gentler for full-bleed background; blueprint is reserved for marketing heroes and CTAs. Either is acceptable — pick one and apply consistently.

## Form

```jsx
<form style={{
  position: "relative",
  width: "100%", maxWidth: 380,
  display: "flex", flexDirection: "column", gap: 20,
}}>
  {/* Header: logo lockup + welcome */}
  <div style={{ display: "flex", flexDirection: "column",
                alignItems: "center", gap: 14, marginBottom: 4 }}>
    <LogoLockup size={28} gap={10} />
    <h1 className="display" style={{ fontSize: 22, fontWeight: 600,
          letterSpacing: "-0.02em", margin: 0 }}>Welcome back</h1>
  </div>

  <Field label="Email / Username">
    <Input value={…} placeholder="m@example.com" />
  </Field>

  <Field label="Password" trailing={<button>Forgot password?</button>}>
    <PasswordInput />     {/* with eye-toggle button absolutely-positioned right */}
  </Field>

  <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
    <Button variant="primary" size="md" type="submit">Login</Button>
    <div style={{ textAlign: "center", fontSize: 12, color: muted }}>
      Don't have an account?{" "}
      <a href="#" style={{ color: fg, textDecoration: "underline", textUnderlineOffset: 4 }}>Sign up</a>
    </div>
  </div>

  <Separator>Or</Separator>

  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
    <Button variant="outline" leftIcon={<Icon d={I.github} size={14} />}>github</Button>
    <Button variant="outline">ldap</Button>
  </div>
</form>
```

## Field

```jsx
<div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
    <label style={{ fontSize: 13, fontWeight: 500 }}>{label}</label>
    {trailing /* "Forgot password?" button */}
  </div>
  {children /* input */}
</div>
```

## Input

```jsx
<input style={{
  width: "100%",
  height: 38, padding: "0 12px",
  background: "var(--bg-elevated)",
  border: "1px solid var(--border)",
  borderRadius: 8,
  color: "var(--fg)",
  fontFamily: sans, fontSize: 13,
  outline: "none",
}} />
```

⚠️ **Login inputs use 38px height** (slightly taller than Settings's 34px). This is intentional — login fields are the only "important" inputs in the app, deserving extra touch target.

## PasswordInput with eye toggle

```jsx
<div style={{ position: "relative" }}>
  <Input type={showPassword ? "text" : "password"} />
  <button type="button" onClick={() => setShowPassword(!showPassword)}
          style={{
            position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)",
            background: "transparent", border: 0, color: muted, cursor: "pointer",
          }}>
    <Icon d={I.eye} size={14} />
  </button>
</div>
```

## Separator with "Or"

```jsx
<div style={{
  display: "flex", alignItems: "center", gap: 12,
  color: subtle, fontFamily: mono, fontSize: 11,
  letterSpacing: "0.08em", textTransform: "uppercase",
}}>
  <div style={{ flex: 1, height: 1, background: "var(--border)" }} />
  <span>Or</span>
  <div style={{ flex: 1, height: 1, background: "var(--border)" }} />
</div>
```

## Social providers

In production: the providers list is fetched from `Apis.auth.listLoginProviders()`. Render a button per provider (max 2-up grid on desktop, 1-up on mobile). GitHub uses the github icon; LDAP uses a network/key icon.

## Errors / loading

- Submit button shows a spinner icon (`<Icon d={I.loader} className="spin" />`) when `isLoading`.
- Errors surface via toast (`react-toastify`) — kept exactly as production code.
