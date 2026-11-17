# chevron-notes

Typed associative notes: a full-screen canvas of short notes with one command
bar at the bottom. You type notes and their relations on one line, and the
canvas lays them out as clusters, each a tree from top to bottom.

```
Performance issue -improved-by> raising max_connections limit
@raising max -blocked-by> having to restart the server -blocks> better logging -improves> @performance
```

- `@` links an existing note; text that matches a note exactly reuses it.
- ` -name> ` is a relation and needs a space before the `-`. ` -> ` is a plain link.
- Relations are pairs (`blocked-by` / `blocks`). They are stored and shown in
  the pair's canonical direction. An unknown name asks you to define it.

## Run it

Needs Node 22.18 or newer (the API runs TypeScript through Node's built-in type stripping).

```sh
npm install
npm start        # the API on :5174 and the app on http://localhost:5173
```

To open it on another device on the same network (a tablet, say), run
`npm run start:lan` and use the Network URL Vite prints. Only the app is exposed;
the API stays on 127.0.0.1 behind Vite's proxy.

Or run them separately with `npm run api` and `npm run dev`. Each board is
stored as `data/boards/<id>.json`; set `CHEVRON_DATA_DIR` or `CHEVRON_API_PORT`
to change that. A `data/board.json` from before multiple boards is moved into
`data/boards/` when the API starts.

## Boards

The board name in the top-left opens the board list: switch boards, or create,
rename and delete one. The open board's id is in the URL (`#<id>`), so a link
or a reload opens the same board.

```sh
npm test         # Vitest: domain, parser, layout, storage, API, store
npm run typecheck
```

## Keyboard

| Key | Where | Does |
| --- | --- | --- |
| `↵` | bar | add the chain (or pick the highlighted suggestion) |
| `↑` `↓` `Tab` | suggestions | move, pick |
| `Tab` | empty bar | go to the notes |
| `↵` / `⌫` | note | edit / delete (asks again when relations go too) |
| `/` `Esc` | anywhere | back to the bar |

Drag to pan, scroll to zoom.

## Layout of the code

| Folder | What | Depends on |
| --- | --- | --- |
| `src/domain` | Board, notes, relation pairs; pure commands such as `applyChain` | nothing |
| `src/parser` | Command-bar syntax, resolving it against a board, autocomplete | domain |
| `src/layout` | Cluster tree layout and edge geometry, as pure functions | nothing |
| `src/storage` | `BoardRepository`, and its HTTP implementation for the PoC | domain |
| `src/ui` | Vue components, the board store, camera and animation | all of the above |
| `server` | The local JSON-file API | nothing |

To swap storage (a database, a multi-user API), implement `BoardRepository` and
pass it in `src/main.ts`. The board JSON has a `schemaVersion` and an `ownerId`
(null for now); `src/storage/serialize.ts` is where migrations go.
