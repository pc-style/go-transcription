# Real-time Meeting Transcriber

This project is a real-time meeting assistant built with Go, Lit web components, and [Deepgram](https://deepgram.com/)'s live transcription API. It streams microphone or system audio to Deepgram, displays the transcript as it happens, and surfaces key takeaways plus actionable follow-ups for your meetings.

## Features

- 🔊 **Live audio streaming** from either the microphone or system audio (via screen/tab capture).
- 📝 **Real-time transcript feed** that updates as people speak and keeps interim hypotheses separate from confirmed text.
- ✨ **Automatic highlights** that extract key points and action items from the running transcript so you never miss important details.
- 🎨 **Modern meeting dashboard** inspired by the provided design reference, including a summary sidebar with meeting notes.

## Prerequisites

- Go 1.20 or newer
- A Deepgram API key with access to the `listen` (live transcription) scope
- A modern browser with [`MediaRecorder`](https://developer.mozilla.org/docs/Web/API/MediaRecorder) support

## Getting started

1. Install dependencies (the Go modules are fetched automatically on first build):

   ```bash
   go mod tidy
   ```

2. Create an `.env` file with your Deepgram credentials and desired port (8080 is the default):

   ```ini
   port=8080
   deepgram_api_key=YOUR_DEEPGRAM_API_KEY
   ```

3. Run the server:

   ```bash
   go run .
   ```

4. Open [http://localhost:8080](http://localhost:8080) in your browser. Start a session by selecting an audio source and pressing **Start Recording**.

   - **Microphone** streams directly from your mic.
   - **System Audio** prompts you to share a screen or tab so system audio can be captured (required by browser security rules). You can minimise the shared surface once capture begins.

## How it works

- The Go server exposes a WebSocket endpoint at `/live`. When the frontend connects, the server opens a corresponding WebSocket to Deepgram using the official SDK and proxies audio + transcription events between the two connections.
- The UI uses the `MediaRecorder` API to chunk audio into Opus-encoded blobs, which are immediately streamed to the backend.
- Final transcripts are aggregated into meeting notes. A simple extractive summary algorithm scores sentences to generate the "Key Points" list, while action-oriented language is used to populate "Action Items".

## Notes

- The frontend runs entirely in the browser—no build tools required. The layout is implemented with [Lit](https://lit.dev/) and mirrors the dark dashboard aesthetic from the supplied inspiration.
- Browsers typically require user interaction to start recording. Ensure you click **Start Recording** before speaking.
- System audio capture is only available in Chromium-based browsers today, and may require selecting "Share tab audio" during the screen-share prompt.

## License

This project is released under the [MIT License](./LICENSE).
