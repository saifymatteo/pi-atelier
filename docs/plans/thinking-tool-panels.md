# Thinking and tool panels in Atelier

## Status

Implementation is on `feat/thinking-tool-panels`. Native component methods are not patched. Typecheck, changed-file formatting, `git diff --check`, and all 460 existing tests pass. Interactive TUI behavior and `compact-tools` compatibility remain unverified. Repository-wide `npm run format:check` reports pre-existing formatting differences in unrelated files; changed files pass.

## Behavior

- Pi's session entries and native chat components are left intact.
- The main transcript is a filtered rendering of Pi's live document: assistant thinking and tool-call components are omitted; other native entries and document sections render unchanged.
- A fixed-height band above the main transcript shows recent thinking and tool activity side by side. The same native `ToolExecutionComponent` instances are rendered in the tool panel, so registered text renderers (including `compact-tools`) are intended to carry through. Compatibility has not been manually verified.
- Thinking display scans at most the latest 40 assistant components and 6,000 characters. Tool display scans at most 48 chat children for the latest three tool components and clips their rendered output to four lines each. A renderer can still do unbounded work before that clipping; the row cap is a display bound, not a hard work bound. Image-bearing tool results retain a bounded recent text excerpt and an image-omission notice rather than emitting image escape sequences inside the framed panel.
- Pi's editor/status/footer dock and Atelier's sidebar remain in the layout. Hiding the sidebar does not hide the activity band. Clearing Atelier's footer/disposing the session clears its main-layout builder.

## Compatibility boundary

The adapter is implemented against the repository's Pi 0.84.0 dependencies; the peer dependency minimum was not raised. It traverses Pi's fullscreen root stack entries, transcript `ScrollView` and document children, and reads runtime fields on `AssistantMessageComponent` and `ToolExecutionComponent` that are not all public TypeScript API. If that shape is not found, the layout falls back to Pi's original root and emits a warning once. Re-check this adapter when upgrading Pi.

## Manual verification

Open an isolated session loading only this checkout's extension:

```sh
./node_modules/.bin/pi --no-session --no-extensions -e ./extensions/index.ts --tui-mode fullscreen
```

Verify these five groups:

1. **Streaming/errors:** thinking updates live and is absent from the transcript; text tool calls/results move to the tool panel; user/assistant text, notices, custom entries, summaries, aborts, and errors remain visible where expected.
2. **Sidebar and Atelier lifecycle:** start with the sidebar hidden and confirm panels still appear; hide/show the sidebar; disable/re-enable Atelier and confirm the layout, footer, and editor restore correctly.
3. **Geometry and navigation:** resize the terminal; check scrolling, selection, and scrollbar-setting changes.
4. **Session lifecycle:** reload, switch tree, compact, and switch regular↔fullscreen mode.
5. **Renderer compatibility:** check image-bearing tool output retains text and shows an omission notice. Separately verify text renderers with `compact-tools`:

   ```sh
   ./node_modules/.bin/pi --no-session --no-extensions -e ./extensions/index.ts -e D:/Settings/pi/extensions/compact-tools.ts --tui-mode fullscreen
   ```

No TUI unit or end-to-end tests were added, per repository guidance. Existing tests and typecheck are useful regression checks but do not exercise this layout.