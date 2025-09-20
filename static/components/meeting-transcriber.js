import { LitElement, html, css, nothing } from "//cdn.skypack.dev/lit@v2.8.0";

const STOP_WORDS = new Set([
  "a",
  "about",
  "above",
  "after",
  "again",
  "against",
  "all",
  "am",
  "an",
  "and",
  "any",
  "are",
  "as",
  "at",
  "be",
  "because",
  "been",
  "before",
  "being",
  "below",
  "between",
  "both",
  "but",
  "by",
  "could",
  "did",
  "do",
  "does",
  "doing",
  "down",
  "during",
  "each",
  "few",
  "for",
  "from",
  "further",
  "had",
  "has",
  "have",
  "having",
  "he",
  "her",
  "here",
  "hers",
  "herself",
  "him",
  "himself",
  "his",
  "how",
  "i",
  "if",
  "in",
  "into",
  "is",
  "it",
  "its",
  "itself",
  "just",
  "me",
  "more",
  "most",
  "my",
  "myself",
  "no",
  "nor",
  "not",
  "now",
  "of",
  "off",
  "on",
  "once",
  "only",
  "or",
  "other",
  "our",
  "ours",
  "ourselves",
  "out",
  "over",
  "own",
  "same",
  "she",
  "should",
  "so",
  "some",
  "such",
  "than",
  "that",
  "the",
  "their",
  "theirs",
  "them",
  "themselves",
  "then",
  "there",
  "these",
  "they",
  "this",
  "those",
  "through",
  "to",
  "too",
  "under",
  "until",
  "up",
  "very",
  "was",
  "we",
  "were",
  "what",
  "when",
  "where",
  "which",
  "while",
  "who",
  "whom",
  "why",
  "will",
  "with",
  "you",
  "your",
  "yours",
  "yourself",
  "yourselves",
]);

const ACTION_REGEX = /\b(need to|needs to|should|follow up|action|plan|schedule|assign|review|complete|send|prepare|finalize|remind|confirm|discuss|investigate|decide|set up|reach out)\b/i;

class MeetingTranscriber extends LitElement {
  static properties = {
    isRecording: { type: Boolean },
    transcripts: { type: Array },
    partialTranscript: { type: String },
    keyPoints: { type: Array },
    actionItems: { type: Array },
    status: { type: String },
    connectionError: { type: String },
    selectedSource: { type: String },
    elapsedSeconds: { type: Number },
    summaryText: { type: String },
    summaryTitle: { type: String },
  };

  static styles = css`
    :host {
      display: block;
      min-height: 100vh;
      background: radial-gradient(circle at top left, rgba(46, 104, 255, 0.18), transparent 45%),
        radial-gradient(circle at bottom right, rgba(13, 148, 136, 0.15), transparent 40%), #0b1220;
      color: #e2e8f0;
      font-family: "Inter", "Segoe UI", system-ui, -apple-system, BlinkMacSystemFont, sans-serif;
    }

    .app-shell {
      min-height: 100vh;
      display: flex;
      flex-direction: column;
    }

    .topbar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 1.5rem 2.5rem;
      border-bottom: 1px solid rgba(148, 163, 184, 0.12);
      background: rgba(11, 18, 32, 0.9);
      backdrop-filter: blur(16px);
      position: sticky;
      top: 0;
      z-index: 10;
    }

    .brand {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      font-weight: 600;
      font-size: 1.1rem;
      letter-spacing: 0.02em;
    }

    .brand-icon {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 2.25rem;
      height: 2.25rem;
      border-radius: 0.75rem;
      background: linear-gradient(135deg, rgba(59, 130, 246, 0.45), rgba(13, 148, 136, 0.6));
      color: #0b1220;
      font-weight: 700;
    }

    nav {
      display: flex;
      gap: 1.75rem;
      align-items: center;
      font-size: 0.95rem;
      color: rgba(148, 163, 184, 0.85);
    }

    nav a.active {
      color: #f8fafc;
      font-weight: 600;
    }

    nav a {
      cursor: pointer;
      transition: color 0.2s ease;
    }

    nav a:hover {
      color: #f8fafc;
    }

    .user-menu {
      display: flex;
      align-items: center;
      gap: 1rem;
    }

    .avatar {
      width: 2.4rem;
      height: 2.4rem;
      border-radius: 50%;
      background: linear-gradient(135deg, rgba(129, 140, 248, 0.3), rgba(14, 116, 144, 0.4));
      border: 1px solid rgba(148, 163, 184, 0.25);
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: 600;
      color: #f8fafc;
    }

    .layout {
      display: grid;
      grid-template-columns: minmax(0, 2.2fr) minmax(300px, 1fr);
      gap: 2.5rem;
      padding: 2.5rem;
      flex-grow: 1;
    }

    .panel {
      background: rgba(15, 23, 42, 0.75);
      border: 1px solid rgba(148, 163, 184, 0.1);
      border-radius: 1.5rem;
      padding: 2rem;
      box-shadow: 0 30px 60px rgba(15, 23, 42, 0.35);
      display: flex;
      flex-direction: column;
      min-height: 0;
    }

    .panel-header {
      display: flex;
      flex-wrap: wrap;
      align-items: flex-start;
      justify-content: space-between;
      gap: 1.5rem;
    }

    .panel-title {
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
    }

    .panel-title h1 {
      font-size: 2rem;
      font-weight: 600;
      margin: 0;
      color: #f8fafc;
      cursor: text;
    }

    .panel-title p {
      margin: 0;
      color: rgba(148, 163, 184, 0.8);
      font-size: 0.95rem;
    }

    .title-input {
      background: rgba(15, 23, 42, 0.55);
      border: 1px solid rgba(148, 163, 184, 0.18);
      border-radius: 0.75rem;
      padding: 0.75rem 1rem;
      color: #f8fafc;
      font-size: 1rem;
      width: min(360px, 100%);
    }

    .title-input:focus {
      outline: none;
      border-color: rgba(59, 130, 246, 0.6);
      box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.2);
    }

    .controls {
      display: flex;
      align-items: flex-end;
      gap: 1rem;
      flex-wrap: wrap;
    }

    .select-wrapper {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
      font-size: 0.85rem;
      color: rgba(148, 163, 184, 0.9);
    }

    .source-select {
      appearance: none;
      background: rgba(15, 23, 42, 0.55);
      border-radius: 0.75rem;
      border: 1px solid rgba(148, 163, 184, 0.2);
      color: #f8fafc;
      padding: 0.65rem 1rem;
      min-width: 200px;
      cursor: pointer;
    }

    .source-select:focus {
      outline: none;
      border-color: rgba(14, 165, 233, 0.6);
      box-shadow: 0 0 0 3px rgba(14, 165, 233, 0.25);
    }

    .primary-button {
      border: none;
      border-radius: 0.9rem;
      padding: 0.9rem 1.6rem;
      font-size: 0.95rem;
      font-weight: 600;
      cursor: pointer;
      transition: transform 0.15s ease, box-shadow 0.15s ease;
      background: linear-gradient(135deg, rgba(59, 130, 246, 0.85), rgba(13, 148, 136, 0.9));
      color: #0b1220;
      min-width: 180px;
    }

    .primary-button.stop {
      background: linear-gradient(135deg, rgba(248, 113, 113, 0.9), rgba(239, 68, 68, 0.8));
      color: #f8fafc;
    }

    .primary-button:disabled {
      cursor: not-allowed;
      opacity: 0.6;
      transform: none;
      box-shadow: none;
    }

    .primary-button:not(:disabled):hover {
      transform: translateY(-1px);
      box-shadow: 0 15px 35px rgba(37, 99, 235, 0.3);
    }

    .status-row {
      margin-top: 1.75rem;
      display: flex;
      flex-wrap: wrap;
      gap: 1rem;
      align-items: center;
      justify-content: space-between;
      color: rgba(148, 163, 184, 0.8);
      font-size: 0.9rem;
    }

    .status-pill {
      display: inline-flex;
      align-items: center;
      gap: 0.6rem;
      padding: 0.45rem 0.9rem;
      border-radius: 9999px;
      background: rgba(30, 41, 59, 0.8);
      border: 1px solid rgba(148, 163, 184, 0.2);
    }

    .status-indicator {
      width: 0.65rem;
      height: 0.65rem;
      border-radius: 50%;
      background: rgba(148, 163, 184, 0.5);
    }

    .status-pill.listening .status-indicator {
      background: #22c55e;
      box-shadow: 0 0 12px rgba(34, 197, 94, 0.8);
    }

    .status-pill.connecting .status-indicator {
      background: #facc15;
    }

    .status-pill.disconnected .status-indicator {
      background: #f87171;
    }

    .status-pill.idle .status-indicator {
      background: rgba(148, 163, 184, 0.5);
    }

    .timestamp {
      font-variant-numeric: tabular-nums;
      color: rgba(148, 163, 184, 0.85);
    }

    .transcript-feed {
      margin-top: 1.5rem;
      padding: 1.5rem;
      border-radius: 1.25rem;
      background: rgba(10, 17, 30, 0.85);
      border: 1px solid rgba(148, 163, 184, 0.08);
      box-shadow: inset 0 0 0 1px rgba(148, 163, 184, 0.05);
      overflow-y: auto;
      flex-grow: 1;
      min-height: 320px;
      max-height: 600px;
    }

    .segment {
      padding: 1rem 1.25rem;
      border-radius: 1rem;
      background: rgba(30, 41, 59, 0.55);
      border: 1px solid rgba(148, 163, 184, 0.08);
      margin-bottom: 1rem;
      display: flex;
      flex-direction: column;
      gap: 0.65rem;
    }

    .segment:last-child {
      margin-bottom: 0;
    }

    .segment-header {
      display: flex;
      justify-content: space-between;
      align-items: baseline;
      font-size: 0.85rem;
      color: rgba(148, 163, 184, 0.8);
    }

    .segment-text {
      color: #f8fafc;
      line-height: 1.6;
      font-size: 1rem;
    }

    .segment.interim {
      border-style: dashed;
      border-color: rgba(148, 163, 184, 0.3);
      background: rgba(30, 41, 59, 0.3);
      font-style: italic;
    }

    .empty-state {
      border: 1px dashed rgba(148, 163, 184, 0.3);
      border-radius: 1rem;
      padding: 2rem;
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
      align-items: flex-start;
      justify-content: center;
      color: rgba(148, 163, 184, 0.8);
    }

    .hint {
      font-size: 0.85rem;
      color: rgba(148, 163, 184, 0.7);
    }

    .summary-panel {
      display: flex;
      flex-direction: column;
      gap: 1.5rem;
    }

    .summary-card {
      background: rgba(15, 23, 42, 0.8);
      border: 1px solid rgba(148, 163, 184, 0.12);
      border-radius: 1.5rem;
      padding: 1.75rem;
      display: flex;
      flex-direction: column;
      gap: 1rem;
      box-shadow: 0 20px 45px rgba(15, 23, 42, 0.35);
    }

    .summary-card h2,
    .summary-card h3 {
      margin: 0;
      color: #f8fafc;
      font-weight: 600;
      letter-spacing: 0.02em;
    }

    .summary-card p,
    .summary-card li {
      margin: 0;
      color: rgba(203, 213, 225, 0.9);
      line-height: 1.6;
      font-size: 0.95rem;
    }

    .summary-card ul {
      list-style: none;
      padding: 0;
      margin: 0;
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
    }

    .summary-card li {
      position: relative;
      padding-left: 1.25rem;
    }

    .summary-card li::before {
      content: "";
      position: absolute;
      left: 0;
      top: 0.6rem;
      width: 0.4rem;
      height: 0.4rem;
      border-radius: 50%;
      background: linear-gradient(135deg, rgba(59, 130, 246, 0.9), rgba(13, 148, 136, 0.9));
      box-shadow: 0 0 8px rgba(13, 148, 136, 0.6);
    }

    .empty-summary {
      color: rgba(148, 163, 184, 0.7);
      font-size: 0.9rem;
    }

    .reset-button {
      margin-top: auto;
      border: none;
      border-radius: 0.9rem;
      padding: 0.85rem 1.4rem;
      font-size: 0.9rem;
      font-weight: 500;
      cursor: pointer;
      background: rgba(30, 41, 59, 0.75);
      color: rgba(226, 232, 240, 0.9);
      border: 1px solid rgba(148, 163, 184, 0.2);
      transition: background 0.2s ease, transform 0.15s ease;
    }

    .reset-button:hover {
      background: rgba(46, 60, 87, 0.85);
      transform: translateY(-1px);
    }

    .error-banner {
      margin-top: 1rem;
      padding: 0.85rem 1.1rem;
      border-radius: 0.75rem;
      background: rgba(248, 113, 113, 0.12);
      border: 1px solid rgba(248, 113, 113, 0.35);
      color: rgba(254, 226, 226, 0.9);
      font-size: 0.9rem;
    }

    @media (max-width: 1200px) {
      .layout {
        grid-template-columns: 1fr;
      }

      .panel {
        order: 2;
      }

      .summary-panel {
        order: 1;
      }
    }

    @media (max-width: 768px) {
      .topbar {
        padding: 1.25rem 1.5rem;
        flex-wrap: wrap;
        gap: 1rem;
      }

      nav {
        width: 100%;
        justify-content: center;
      }

      .layout {
        padding: 1.5rem;
        gap: 1.5rem;
      }

      .panel {
        padding: 1.5rem;
      }

      .transcript-feed {
        max-height: none;
        min-height: 280px;
      }
    }
  `;

  constructor() {
    super();
    this.isRecording = false;
    this.transcripts = [];
    this.partialTranscript = "";
    this.keyPoints = [];
    this.actionItems = [];
    this.status = "idle";
    this.connectionError = "";
    this.selectedSource = "microphone";
    this.elapsedSeconds = 0;
    this.summaryTitle = "Weekly Team Sync";
    this.summaryText = "Start recording to capture your meeting in real time. We'll highlight key moments and action items as they happen.";
    this.transcriptHistory = [];
    this.mediaRecorder = null;
    this.mediaStream = null;
    this.ws = null;
    this.durationTimer = null;
    this.speakerLabels = new Map();
  }

  updated(changedProps) {
    if (changedProps.has("transcripts") || changedProps.has("partialTranscript")) {
      const feed = this.renderRoot?.querySelector(".transcript-feed");
      if (feed) {
        feed.scrollTop = feed.scrollHeight;
      }
    }
  }

  get statusLabel() {
    switch (this.status) {
      case "connecting":
        return "Connecting";
      case "listening":
        return "Listening";
      case "disconnected":
        return "Connection lost";
      default:
        return "Idle";
    }
  }

  get statusClass() {
    return `status-pill ${this.status}`;
  }

  get sourceLabel() {
    return this.selectedSource === "system" ? "System Audio" : "Microphone";
  }

  promptForTitle() {
    const nextTitle = window.prompt("Meeting title", this.summaryTitle || "");
    if (nextTitle === null) {
      return;
    }
    const trimmed = nextTitle.trim();
    if (trimmed) {
      this.summaryTitle = trimmed;
    }
  }

  formatDuration(seconds) {
    if (!seconds) {
      return "00:00";
    }
    const mins = Math.floor(seconds / 60)
      .toString()
      .padStart(2, "0");
    const secs = Math.floor(seconds % 60)
      .toString()
      .padStart(2, "0");
    return `${mins}:${secs}`;
  }

  formatTimestamp(seconds) {
    return this.formatDuration(Math.max(0, Math.round(seconds)));
  }

  onSourceChange(event) {
    this.selectedSource = event.target.value;
  }

  async toggleRecording() {
    if (this.status === "connecting") {
      return;
    }
    if (this.isRecording) {
      this.stopRecording(true);
    } else {
      await this.startRecording();
    }
  }

  async startRecording() {
    if (this.isRecording || this.status === "connecting") {
      return;
    }

    this.connectionError = "";
    this.status = "connecting";
    this.requestUpdate();

    let stream;
    try {
      if (this.selectedSource === "system") {
        stream = await navigator.mediaDevices.getDisplayMedia({ audio: true, video: true });
      } else {
        stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
          },
        });
      }
    } catch (error) {
      this.connectionError = error?.message || "Unable to access the selected audio source.";
      this.status = "idle";
      return;
    }

    this.mediaStream = stream;

    let sampleRate = 48000;
    const audioTracks = stream.getAudioTracks();
    if (audioTracks.length > 0) {
      const settings = audioTracks[0].getSettings();
      if (settings.sampleRate) {
        sampleRate = settings.sampleRate;
      }
    }

    try {
      this.mediaRecorder = new MediaRecorder(stream, {
        mimeType: "audio/webm;codecs=opus",
      });
    } catch (error) {
      try {
        this.mediaRecorder = new MediaRecorder(stream);
      } catch (fallbackError) {
        this.connectionError = fallbackError?.message || "MediaRecorder is not supported in this browser.";
        this.status = "idle";
        this.mediaStream.getTracks().forEach((track) => track.stop());
        this.mediaStream = null;
        return;
      }
    }

    const protocol = window.location.protocol === "https:" ? "wss" : "ws";
    const params = new URLSearchParams({
      encoding: "opus",
      sample_rate: `${sampleRate}`,
      diarize: "true",
      smart_format: "true",
      interim_results: "true",
      punctuate: "true",
    });

    const wsUrl = `${protocol}://${window.location.host}/live?${params.toString()}`;
    this.ws = new WebSocket(wsUrl);
    this.ws.binaryType = "arraybuffer";

    this.ws.addEventListener("message", (event) => this.handleSocketMessage(event));
    this.ws.addEventListener("close", (event) => this.handleSocketClose(event));
    this.ws.addEventListener("error", () => {
      this.connectionError = "The live transcription connection was interrupted.";
      this.handleSocketClose();
    });

    this.mediaRecorder.addEventListener("dataavailable", async (event) => {
      if (event.data && event.data.size > 0 && this.ws?.readyState === WebSocket.OPEN) {
        try {
          const buffer = await event.data.arrayBuffer();
          this.ws.send(buffer);
        } catch (error) {
          console.error("Failed to forward audio chunk", error);
        }
      }
    });

    this.mediaRecorder.addEventListener("stop", () => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        try {
          this.ws.send(JSON.stringify({ type: "CloseStream" }));
        } catch (error) {
          console.error("Failed to send CloseStream message", error);
        }
        this.ws.close();
      }
    });

    this.ws.addEventListener("open", () => {
      this.elapsedSeconds = 0;
      this.recordingStart = Date.now();
      this.status = "listening";
      this.isRecording = true;
      this.mediaRecorder.start(500);
      if (this.durationTimer) {
        clearInterval(this.durationTimer);
      }
      this.durationTimer = setInterval(() => {
        if (this.isRecording) {
          this.elapsedSeconds = Math.floor((Date.now() - this.recordingStart) / 1000);
          this.requestUpdate();
        }
      }, 1000);
      this.requestUpdate();
    });
  }

  stopRecording(closeRemote = true) {
    if (this.mediaRecorder) {
      try {
        if (this.mediaRecorder.state !== "inactive") {
          this.mediaRecorder.stop();
        }
      } catch (error) {
        console.error("Failed to stop recorder", error);
      }
    }

    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach((track) => track.stop());
      this.mediaStream = null;
    }

    if (closeRemote && this.ws) {
      try {
        if (this.ws.readyState === WebSocket.OPEN) {
          this.ws.send(JSON.stringify({ type: "CloseStream" }));
        }
        this.ws.close();
      } catch (error) {
        console.error("Failed to close websocket", error);
      }
    }

    this.ws = null;
    this.mediaRecorder = null;
    this.isRecording = false;

    if (this.durationTimer) {
      clearInterval(this.durationTimer);
      this.durationTimer = null;
    }

    if (this.status !== "disconnected") {
      this.status = "idle";
    }
    this.partialTranscript = "";
    this.requestUpdate();
  }

  handleSocketMessage(event) {
    let payload;
    try {
      payload = JSON.parse(event.data);
    } catch (error) {
      return;
    }

    if (payload.type === "connected") {
      return;
    }

    if (payload.type === "error") {
      this.connectionError = payload.message || "A streaming error occurred.";
      this.handleSocketClose();
      return;
    }

    if (payload.type !== "Results") {
      return;
    }

    const alternative = payload.channel?.alternatives?.[0];
    if (!alternative) {
      return;
    }

    const transcript = alternative.transcript?.trim();
    if (!transcript) {
      this.partialTranscript = "";
      return;
    }

    if (payload.is_final) {
      const speaker = this.extractSpeakerLabel(alternative);
      const start = typeof payload.start === "number" ? payload.start : this.elapsedSeconds;
      const segment = {
        speaker,
        text: transcript,
        timestamp: start,
      };
      this.transcripts = [...this.transcripts, segment];
      this.transcriptHistory.push(transcript);
      this.partialTranscript = "";
      this.updateHighlights();
    } else {
      this.partialTranscript = transcript;
    }
  }

  handleSocketClose(event) {
    const wasRecording = this.isRecording;
    if (wasRecording) {
      if (event && event.code !== 1000) {
        this.connectionError = this.connectionError || "The connection to Deepgram was closed.";
      }
      this.status = "disconnected";
    } else {
      this.status = "idle";
    }

    this.stopRecording(false);
  }

  extractSpeakerLabel(alternative) {
    const words = alternative?.words || [];
    if (!words.length) {
      return `Speaker ${this.transcripts.length + 1}`;
    }

    const rawSpeaker = words[0]?.speaker;
    if (rawSpeaker === undefined || rawSpeaker === null) {
      return `Speaker ${this.transcripts.length + 1}`;
    }

    const numeric = Number(rawSpeaker);
    if (!Number.isNaN(numeric)) {
      if (!this.speakerLabels.has(numeric)) {
        const label = `Speaker ${this.speakerLabels.size + 1}`;
        this.speakerLabels.set(numeric, label);
      }
      return this.speakerLabels.get(numeric);
    }

    return `Speaker ${rawSpeaker}`;
  }

  updateHighlights() {
    const fullText = this.transcriptHistory.join(" ").trim();
    if (!fullText) {
      this.keyPoints = [];
      this.actionItems = [];
      this.summaryText = "Start recording to capture your meeting in real time. We'll highlight key moments and action items as they happen.";
      return;
    }

    const sentences = fullText.match(/[^.!?]+[.!?]?/g) || [fullText];

    const frequencies = new Map();
    for (const sentence of sentences) {
      for (const word of sentence.split(/\s+/)) {
        const cleaned = word.toLowerCase().replace(/[^a-z0-9']/g, "");
        if (!cleaned || STOP_WORDS.has(cleaned)) {
          continue;
        }
        const current = frequencies.get(cleaned) || 0;
        frequencies.set(cleaned, current + 1);
      }
    }

    const scored = sentences
      .map((sentence) => {
        const score = sentence
          .split(/\s+/)
          .reduce((sum, word) => {
            const cleaned = word.toLowerCase().replace(/[^a-z0-9']/g, "");
            return sum + (frequencies.get(cleaned) || 0);
          }, 0);
        return { sentence: sentence.trim(), score };
      })
      .filter((item) => item.sentence && item.sentence.length > 0);

    scored.sort((a, b) => b.score - a.score);

    const uniqueKeyPoints = [];
    const seen = new Set();
    for (const item of scored) {
      const key = item.sentence.toLowerCase();
      if (item.sentence.split(" ").length < 4) {
        continue;
      }
      if (!seen.has(key)) {
        uniqueKeyPoints.push(item.sentence);
        seen.add(key);
      }
      if (uniqueKeyPoints.length >= 4) {
        break;
      }
    }

    const actionCandidates = sentences
      .map((sentence) => sentence.trim())
      .filter((sentence) => ACTION_REGEX.test(sentence.toLowerCase()));

    const actionSet = new Set();
    const actions = [];
    for (const sentence of actionCandidates) {
      const normalized = sentence.toLowerCase();
      if (!actionSet.has(normalized)) {
        actionSet.add(normalized);
        actions.push(sentence);
      }
      if (actions.length >= 4) {
        break;
      }
    }

    this.keyPoints = uniqueKeyPoints;
    this.actionItems = actions;

    const preview = sentences.slice(-3).join(" ").trim();
    this.summaryText = preview || this.summaryText;
    this.requestUpdate();
  }

  resetSession() {
    this.stopRecording();
    this.transcripts = [];
    this.transcriptHistory = [];
    this.partialTranscript = "";
    this.keyPoints = [];
    this.actionItems = [];
    this.elapsedSeconds = 0;
    this.summaryTitle = "Weekly Team Sync";
    this.summaryText = "Start recording to capture your meeting in real time. We'll highlight key moments and action items as they happen.";
    this.connectionError = "";
    this.status = "idle";
    this.speakerLabels.clear();
    this.requestUpdate();
  }

  renderTranscriptFeed() {
    if (!this.transcripts.length && !this.partialTranscript) {
      return html`
        <div class="empty-state">
          <strong>Waiting for audio…</strong>
          <span>
            Start recording to see the transcript appear here in real time. We’ll automatically separate the discussion into digestible notes.
          </span>
          <span class="hint">Tip: choose “System Audio” to capture playback from a video call or presentation.</span>
        </div>
      `;
    }

    return html`
      ${this.transcripts.map(
        (segment) => html`
          <div class="segment">
            <div class="segment-header">
              <span>${segment.speaker || "Speaker"}</span>
              <span>${this.formatTimestamp(segment.timestamp)}</span>
            </div>
            <div class="segment-text">${segment.text}</div>
          </div>
        `
      )}
      ${this.partialTranscript
        ? html`
            <div class="segment interim">
              <div class="segment-header">
                <span>Listening…</span>
                <span>Live</span>
              </div>
              <div class="segment-text">${this.partialTranscript}</div>
            </div>
          `
        : nothing}
    `;
  }

  renderSummaryList(items, placeholder) {
    if (!items.length) {
      return html`<span class="empty-summary">${placeholder}</span>`;
    }

    return html`
      <ul>
        ${items.map((item) => html`<li>${item}</li>`)}
      </ul>
    `;
  }

  render() {
    return html`
      <div class="app-shell">
        <header class="topbar">
          <div class="brand">
            <span class="brand-icon">DG</span>
            <span>Transcribe</span>
          </div>
          <nav>
            <a class="active">Home</a>
            <a>My Files</a>
            <a>New File</a>
          </nav>
          <div class="user-menu">
            <div class="avatar">MS</div>
          </div>
        </header>

        <main class="layout">
          <section class="panel">
            <div class="panel-header">
              <div class="panel-title">
                <p>Meeting Transcription</p>
                <h1 @dblclick=${this.promptForTitle} title="Double-click to rename">
                  ${this.summaryTitle || "Weekly Team Sync"}
                </h1>
                <p>Audio Source: <strong>${this.sourceLabel}</strong></p>
              </div>
              <div class="controls">
                <div class="select-wrapper">
                  <label for="source">Audio Source</label>
                  <select id="source" class="source-select" @change=${this.onSourceChange} .value=${this.selectedSource}>
                    <option value="microphone">Microphone</option>
                    <option value="system">System Audio</option>
                  </select>
                </div>
                <button
                  class="primary-button ${this.isRecording ? "stop" : "start"}"
                  ?disabled=${this.status === "connecting"}
                  @click=${this.toggleRecording}
                >
                  ${this.isRecording ? "Stop Recording" : this.status === "connecting" ? "Connecting…" : "Start Recording"}
                </button>
              </div>
            </div>
            ${this.selectedSource === "system"
              ? html`<p class="hint">Note: capturing system audio requires sharing a screen or tab. You can minimize the preview once streaming begins.</p>`
              : nothing}
            ${this.connectionError
              ? html`<div class="error-banner">${this.connectionError}</div>`
              : nothing}

            <div class="status-row">
              <span class=${this.statusClass}>
                <span class="status-indicator"></span>
                ${this.statusLabel}
              </span>
              <span class="timestamp">Duration ${this.formatDuration(this.elapsedSeconds)}</span>
            </div>

            <div class="transcript-feed">${this.renderTranscriptFeed()}</div>
          </section>

          <aside class="summary-panel">
            <article class="summary-card">
              <h2>Summary</h2>
              <p>${this.summaryText}</p>
            </article>
            <article class="summary-card">
              <h3>Key Points</h3>
              ${this.renderSummaryList(
                this.keyPoints,
                "Key points will appear here once we have enough context from the conversation."
              )}
            </article>
            <article class="summary-card">
              <h3>Action Items</h3>
              ${this.renderSummaryList(
                this.actionItems,
                "We’ll flag follow-ups and next steps automatically as they are discussed."
              )}
            </article>
            <button class="reset-button" @click=${this.resetSession}>Reset session</button>
          </aside>
        </main>
      </div>
    `;
  }
}

customElements.define("meeting-transcriber", MeetingTranscriber);
