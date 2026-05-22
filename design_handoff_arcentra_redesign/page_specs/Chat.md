# Page spec · Chat (Copilot AI dialogue)

**Route:** `/chat`  
**Reached from:** AppDock "Copilot" item (brain icon, between Agents and Observe)  
**Reference prototype:** `prototypes/dashboard/Chat.jsx`  
**Mirrors source:** `arcentra-web/src/pages/LLMDialogue/Chat/index.tsx`

## Page-level layout

```jsx
<section style={{
  padding: 0,                               /* ← NO page padding */
  display: "grid",
  gridTemplateColumns: "260px 1fr",
  height: "calc(100dvh - 56px)",            /* fill viewport minus topbar */
  minHeight: 600,
}}>
```

⚠️ **The Chat page is the only one that doesn't use `padding: 32` on the section.** It fills the available height edge-to-edge because the composer should anchor to the bottom of the viewport.

## Region 1 — Sidebar (260px)

```
┌────────────────────────────────┐
│ ▸ COPILOT                       │
│ Arcentra Copilot               │
│ [+ New conversation         ]  │ ← full-width primary button
├─ HISTORY ──────────────────────┤
│ ▕ Why is the api·main pipeline │ ← active conversation, 2px cyan left bar
│ ▕ slow today?                  │
│ ▕   2m ago                     │
│   Draft a postmortem for       │
│   v2.3.6 rollback              │
│     1h ago                     │
│   …                            │
├────────────────────────────────┤
│ ⊙ connected · 14 tools         │ ← bottom status pill, brand-signal
└────────────────────────────────┘
```

Sidebar structure:
```jsx
<aside style={{
  borderRight: "1px solid var(--border)",
  background: "var(--bg)",
  display: "flex", flexDirection: "column",
  overflow: "hidden",
}}>
  <div style={{ padding: 16, borderBottom: "1px solid var(--border)" }}>
    <Eyebrow>copilot</Eyebrow>
    <h2 className="display" style={{ fontSize: 18, fontWeight: 600,
          letterSpacing: "-0.02em", margin: "8px 0 12px" }}>Arcentra Copilot</h2>
    <Button variant="primary" size="sm" leftIcon={<Icon d={I.plus} size={13} />}
            style={{ width: "100%" }}>New conversation</Button>
  </div>

  <div style={{ flex: 1, overflowY: "auto", padding: "8px 0" }}>
    <Eyebrow style={{ padding: "8px 16px 4px" }}>History</Eyebrow>
    <ul>
      {convos.map(c => (
        <button onClick={() => set(c.id)} style={{
          display: "block", width: "100%", textAlign: "left",
          padding: "10px 16px", border: 0,
          background: active ? "var(--bg-elevated)" : "transparent",
          boxShadow: active ? "inset 2px 0 0 0 var(--brand-signal)" : "none",
        }}>
          <div style={{ fontSize: 12.5, overflow: "hidden",
                        textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.title}</div>
          <div style={{ fontFamily: mono, fontSize: 10.5, color: subtle }}>{c.date}</div>
        </button>
      ))}
    </ul>
  </div>

  <div style={{ padding: 12, borderTop: "1px solid var(--border)" }}>
    <div style={{
      display: "flex", alignItems: "center", gap: 8,
      padding: "8px 10px", borderRadius: 6,
      background: "color-mix(in oklab, var(--brand-signal) 6%, transparent)",
      border: "1px solid var(--brand-signal-dim)",
    }}>
      <span className="pulse-dot" style={{ width: 8, height: 8, borderRadius: 9999, background: "var(--brand-signal)" }} />
      <span style={{ fontFamily: mono, fontSize: 11, color: "var(--brand-signal)" }}>connected · 14 tools</span>
    </div>
  </div>
</aside>
```

## Region 2 — Main chat surface

```jsx
<main style={{ display: "flex", flexDirection: "column", overflow: "hidden", background: "var(--bg)" }}>
  <ConversationHeader />     {/* padding: 14 24, borderBottom */}
  <MessagesScroll />          {/* flex: 1, overflowY: auto */}
  <Composer />                /* padding: 16 24 24 */
</main>
```

## ConversationHeader

```jsx
<header style={{
  padding: "14px 24px",
  borderBottom: "1px solid var(--border)",
  display: "flex", alignItems: "center", justifyContent: "space-between",
}}>
  <div>
    <h3 className="display" style={{ fontSize: 15, fontWeight: 600,
          letterSpacing: "-0.01em", margin: 0 }}>{convo.title}</h3>
    <div style={{ fontFamily: mono, fontSize: 11, color: subtle, marginTop: 2 }}>
      model · arcentra-copilot-v0.4 · 5 messages · 14 tool calls available
    </div>
  </div>
  <div style={{ display: "flex", gap: 6 }}>
    <Button variant="ghost" size="sm" leftIcon={<Icon d={I.copy} size={12} />}>Share</Button>
    <Button variant="ghost" size="sm">Archive</Button>
  </div>
</header>
```

## MessagesScroll

```jsx
<div style={{ flex: 1, overflowY: "auto", padding: "24px 0" }}>
  <div style={{
    maxWidth: 760,         /* ← constrained reading width */
    margin: "0 auto",
    padding: "0 24px",
    display: "flex", flexDirection: "column", gap: 20,
  }}>
    {messages.map(m => <ChatMessage {...m} />)}
    <TypingIndicator />
  </div>
</div>
```

## ChatMessage — user bubble

```jsx
<div style={{ display: "flex", justifyContent: "flex-end" }}>
  <div style={{
    maxWidth: "78%",
    padding: "10px 14px",
    borderRadius: 10, borderTopRightRadius: 4,    /* ← speech-bubble corner */
    background: "var(--bg-elevated)",
    border: "1px solid var(--border)",
    fontSize: 14, lineHeight: 1.55,
  }}>
    {content}
    <div style={{ marginTop: 6, fontFamily: mono, fontSize: 10.5, color: subtle,
                  textAlign: "right" }}>{at}</div>
  </div>
</div>
```

## ChatMessage — assistant

```
┌──┐
│⌬│ ToolCard │ CodeBlock │ Text │ Sources chips │ Timestamp
└──┘
```

```jsx
<div style={{ display: "flex", gap: 12 }}>
  {/* Assistant avatar — brand-signal tinted circle with brain icon */}
  <span style={{
    flexShrink: 0,
    width: 28, height: 28, borderRadius: 9999,
    border: "1px solid var(--brand-signal-dim)",
    background: "color-mix(in oklab, var(--brand-signal) 8%, transparent)",
    display: "inline-flex", alignItems: "center", justifyContent: "center",
    color: "var(--brand-signal)",
  }}><Icon d={I.brain} size={14} /></span>

  <div style={{ flex: 1, minWidth: 0 }}>
    {tool    && <ToolCard tool={tool} />}
    {code    && <CodeBlock code={code} />}
    {content && <div style={{ fontSize: 14, lineHeight: 1.65 }}>{content}</div>}
    {sources && <SourceChips sources={sources} />}
    {at && <div style={{ marginTop: 8, fontFamily: mono, fontSize: 10.5, color: subtle }}>{at}</div>}
  </div>
</div>
```

## ToolCard

```
┌─────────────────────────────────────────────┐
│ ⚡ tool arcentra.pipeline.diagnose  ✓ 320ms │ ← lightning icon brand-signal
├─────────────────────────────────────────────┤
│ args = {…}                                   │
│ ┌─────────────────────────────────────────┐ │
│ │ Stage         Duration   Δ vs median    │ │
│ │ build-container  0:42→1:14  +76%       │ │ ← +76% in warn
│ │ unit-tests       1:04→1:08  +6%        │ │
│ │ push-image       0:23→0:23  0%         │ │
│ └─────────────────────────────────────────┘ │
└─────────────────────────────────────────────┘
```

- Border-radius 8, 1px border, bg-elevated
- Header: 8px 14px padding, mono 11px, leading I.zap in brand-signal
- "tool" label in brand-signal, then tool name in fg, then status (✓ 320ms) right-aligned in subtle
- Body: args line + inner table with stage/duration/Δ columns

## CodeBlock

```jsx
<div style={{ borderRadius: 8, border: "1px solid var(--border)",
              background: "var(--bg-elevated)", margin: "8px 0 12px",
              overflow: "hidden" }}>
  <div /* header: yaml · path · Copy button */ style={{
    display: "flex", justifyContent: "space-between",
    padding: "6px 12px", borderBottom: "1px solid var(--border)",
    fontFamily: mono, fontSize: 10.5, color: subtle,
    letterSpacing: "0.06em", textTransform: "uppercase",
  }}>
    <span>{language} · {path}</span>
    <button><Icon d={I.copy} size={11} />Copy</button>
  </div>
  <pre style={{ margin: 0, padding: 14, fontFamily: mono,
                fontSize: 12, lineHeight: 1.7, whiteSpace: "pre",
                overflowX: "auto" }}>{body}</pre>
</div>
```

## SourceChips

```jsx
<ul style={{ listStyle: "none", margin: "10px 0 0", padding: 0,
             display: "flex", flexWrap: "wrap", gap: 6 }}>
  {sources.map(([title, sub]) => (
    <li style={{
      display: "inline-flex", flexDirection: "column",
      padding: "6px 10px",
      border: "1px solid var(--border)", borderRadius: 6,
      background: "var(--bg-elevated)",
      fontFamily: mono,
    }}>
      <span style={{ fontSize: 11.5 }}>{title}</span>
      <span style={{ fontSize: 10.5, color: subtle }}>{sub}</span>
    </li>
  ))}
</ul>
```

## Inline code in markdown — special class

Inline references inside assistant prose (like `api·main`, `v2.3.8`) use a custom `.ars-mono-inline` class — render mono with bg-elevated tile:

```css
.ars-mono-inline {
  font-family: var(--font-mono);
  font-size: 0.92em;
  padding: 1px 5px;
  background: var(--bg-elevated);
  border: 1px solid var(--border);
  border-radius: 4px;
  color: var(--fg);
}
```

## Composer

```
┌─────────────────────────────────────────────┐
│ [Textarea, auto-grows to 200px max]         │
│                                             │
├─────────────────────────────────────────────┤
│ [+ Attach] [⎇ api·main] [⚡ Tools · 14]  [→ Send] │
└─────────────────────────────────────────────┘
↵ send · ⇧↵ newline · / for commands     copilot may make mistakes
```

- Container: 12px radius, 1px border, bg-elevated, padding 12, flex-col gap 10
- Textarea: `resize: none; border: 0; outline: none; background: transparent`
- Auto-grow via useEffect: `ref.current.style.height = Math.min(scrollHeight, 200) + "px"`
- Bottom row: composer chips on left, Send button on right
- Below the composer: 11px mono caption (left "↵ send · ⇧↵ newline · / for commands", right disclaimer)

## TypingIndicator

Shown when assistant is mid-stream:

```jsx
<div style={{ display: "flex", gap: 12, alignItems: "center", color: subtle }}>
  <AssistantAvatar />
  <span style={{ fontFamily: mono, fontSize: 11.5 }}>copilot is thinking…</span>
</div>
```
