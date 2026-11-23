# Endpoints page: request-type cards and client chips

The Endpoints page picks an example in two steps: a request-type card, then a
client chip, plus a model picker. The selection is persisted in
`?type=&client=&model=`.

## Model to type mapping

`src/features/endpoints/endpointTypes.ts` derives support from the
`capabilities` llama-swap reports on `/v1/models`:

| Type       | Rule                                                            |
| ---------- | --------------------------------------------------------------- |
| Text       | input and output include `text`, and not an embedding model     |
| Image      | `image_generation` flag, or output includes `image`             |
| Speech     | `audio_speech` flag, or output includes `audio`                 |
| Transcribe | `audio_transcriptions` flag, or audio in and text out           |
| Realtime   | audio in and audio out                                          |
| Embeddings | `embeddings` flag, or the model id contains `embed`             |

llama-swap never auto-discovers `embeddings`, so embedding models report plain
text->text. The id check keeps them out of Text. Set
`capabilities: { embeddings: true }` in `config.yaml` to make it explicit.

Peer models report no capability metadata, so they appear under no type. A
type with no model is dimmed, and the snippet uses a placeholder model plus a
hint naming the `capabilities` entry to add.

## Client availability

`src/features/endpoints/snippets.ts` is the single source of truth: a client
supports a type exactly when that type's snippet map has an entry for it.

| Client         | Types                                        |
| -------------- | -------------------------------------------- |
| curl           | all except Realtime                          |
| Python         | all                                          |
| TypeScript     | all                                          |
| Claude Code    | Text (`/v1/messages`)                        |
| opencode       | Text                                         |
| Home Assistant | Text, Speech, Transcribe                     |

Home Assistant keeps Text because its conversation-agent example is valid.
