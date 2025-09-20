import { LitElement, html, css } from "//cdn.skypack.dev/lit@v2.8.0";

const KEYWORD_WEIGHTS = [
  ["update", 2],
  ["progress", 2],
  ["decision", 3],
  ["plan", 2],
  ["design", 1.5],
  ["deadline", 3],
  ["issue", 2],
  ["launch", 1.5],
  ["review", 1.5],
  ["deliverable", 2],
  ["roadmap", 2],
  ["timeline", 2],
  ["risk", 2],
  ["milestone", 2.5],
  ["next", 1.5],
  ["goal", 1.5],
];

const ACTION_ITEM_PATTERN =
  /(need to|should|let's|we'll|plan to|remember to|follow up|assign|schedule|review|finalize|prepare|send|share|set up|update|call|reach out)/i;

class MeetingTranscriber extends LitElement {
  static properties = {
    meetingTitle: { type: String },
    selectedSource: { type: String },
    isRecording: { type: Boolean },
    statusMessage: { type: String },
    transcript: { type: Array },
    liveSegment: { type: String },
    keyPoints: { type: Array },
    actionItems: { type: Array },
    elapsedMs: { type: Number },
  };

  static styles = css`
    :host {
      display: block;
      min-height: 100vh;
    }
  `;

  constructor() {
    super();
    this.meetingTitle = "Weekly sync";
    this.selectedSource = "microphone";
    this.isRecording = false;
    this.statusMessage = "Ready to transcribe";
    this.transcript = [];
    this.liveSegment = "";
    this.keyPoints = [];
    this.actionItems = [];
    this.elapsedMs = 0;
    this.fullTranscript = "";
    this.socket = null;
    this.mediaRecorder = null;
    this.stream = null;
    this.timer = null;
    this.wsUrl = this.computeWebsocketUrl();

    this._handleChunk = (event) => {
      if (
        !event.data ||
        event.data.size === 0 ||
        !this.socket ||
        this.socket.readyState !== WebSocket.OPEN
      ) {
        return;
      }

      event.data.arrayBuffer().then((buffer) => {
        if (this.socket && this.socket.readyState === WebSocket.OPEN) {
          this.socket.send(buffer);
        }
      });
    };

    this._handleRecorderStop = () => {
      if (this.mediaRecorder) {
        this.mediaRecorder.removeEventListener("dataavailable", this._handleChunk);
        this.mediaRecorder.removeEventListener("stop", this._handleRecorderStop);
        this.mediaRecorder = null;
      }
      this.cleanupStream();
    };
  }

  connectedCallback() {
    super.connectedCallback();
    this.wsUrl = this.computeWebsocketUrl();
  }

  disconnectedCallback() {
    this.stopSession();
    super.disconnectedCallback();
  }

  computeWebsocketUrl() {
    const { protocol, host } = window.location;
    const scheme = protocol === "https:" ? "wss" : "ws";
    return `${scheme}://${host}/ws`;
  }

  updateMeetingTitle(event) {
    this.meetingTitle = event.target.value;
  }

  setSource(source) {
    if (this.isRecording) return;
    this.selectedSource = source;
  }

  async startSession() {
    if (this.isRecording) return;

    try {
      this.statusMessage = "Preparing audio";
      this.requestUpdate();

      const stream = await this.acquireStream();
      this.stream = stream;

      const mimeType = this.chooseMimeType();
      try {
        this.mediaRecorder = mimeType
          ? new MediaRecorder(stream, { mimeType })
          : new MediaRecorder(stream);
      } catch (error) {
        throw new Error(
          "MediaRecorder is not supported in this browser. Try Chrome or Edge."
        );
      }

      this.mediaRecorder.addEventListener("dataavailable", this._handleChunk);
      this.mediaRecorder.addEventListener("stop", this._handleRecorderStop);

      this.socket = new WebSocket(this.wsUrl);
      this.socket.binaryType = "arraybuffer";

      this.socket.addEventListener("open", () => {
        this.elapsedMs = 0;
        this.startTimer();
        this.mediaRecorder.start(750);
        this.isRecording = true;
        this.statusMessage =
          this.selectedSource === "system"
            ? "Capturing system audio"
            : "Capturing microphone";
        this.requestUpdate();
      });

      this.socket.addEventListener("message", (event) => {
        this.handleTranscriptEvent(event);
      });

      this.socket.addEventListener("error", () => {
        if (this.isRecording) {
          this.stopSession();
          this.statusMessage = "Connection issue detected";
        } else {
          this.cleanupSocket();
          this.cleanupStream();
          this.statusMessage = "Websocket error";
        }
        this.requestUpdate();
      });

      this.socket.addEventListener("close", () => {
        const wasRecording = this.isRecording;
        this.isRecording = false;
        this.stopTimer();
        if (wasRecording) {
          this.statusMessage =
            this.statusMessage === "Recording stopped"
              ? this.statusMessage
              : "Connection closed";
          this.requestUpdate();
        }
      });
    } catch (error) {
      console.error(error);
      this.statusMessage = error.message || "Unable to start recording";
      this.cleanupStream();
      this.cleanupSocket();
      this.requestUpdate();
    }
  }

  stopSession() {
    this.cleanupSocket(true);

    if (this.mediaRecorder && this.mediaRecorder.state !== "inactive") {
      try {
        this.mediaRecorder.stop();
      } catch (error) {
        console.error("Failed to stop media recorder", error);
        this._handleRecorderStop();
      }
    } else {
      this._handleRecorderStop();
    }

    this.stopTimer();
    this.isRecording = false;
    this.statusMessage = "Recording stopped";
    this.requestUpdate();
  }

  async acquireStream() {
    if (!navigator.mediaDevices) {
      throw new Error("Media devices are not available in this browser.");
    }
    if (this.selectedSource === "system") {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        audio: true,
        video: true,
      });
      const hasAudio = stream.getAudioTracks().length > 0;
      if (!hasAudio) {
        stream.getTracks().forEach((track) => track.stop());
        throw new Error(
          "No audio was shared. Please share a tab or window that has audio enabled."
        );
      }
      return stream;
    }

    return navigator.mediaDevices.getUserMedia({
      audio: {
        sampleRate: 48000,
        channelCount: 1,
        echoCancellation: true,
        noiseSuppression: true,
      },
      video: false,
    });
  }

  chooseMimeType() {
    if (!window.MediaRecorder) return "";
    const types = [
      "audio/webm;codecs=opus",
      "audio/webm",
      "audio/ogg;codecs=opus",
    ];
    return types.find((type) => MediaRecorder.isTypeSupported(type)) || "";
  }

  cleanupSocket(sendStop = false) {
    if (!this.socket) return;

    const socket = this.socket;
    this.socket = null;

    try {
      if (sendStop && socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify({ event: "stop" }));
      }
    } catch (error) {
      console.warn("Failed to send stop event", error);
    }

    try {
      socket.close();
    } catch (error) {
      console.warn("Failed to close websocket", error);
    }
  }

  cleanupStream() {
    if (this.stream) {
      this.stream.getTracks().forEach((track) => track.stop());
      this.stream = null;
    }
  }

  startTimer() {
    this.stopTimer();
    this.timer = setInterval(() => {
      this.elapsedMs += 1000;
      this.requestUpdate();
    }, 1000);
  }

  stopTimer() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  handleTranscriptEvent(event) {
    try {
      const payload = JSON.parse(event.data);
      if (payload.error) {
        this.statusMessage = payload.error;
        this.requestUpdate();
        return;
      }

      const alternative = payload?.channel?.alternatives?.[0];
      const transcript = alternative?.transcript?.trim();
      if (!transcript) return;

      if (payload.is_final) {
        this.transcript = [
          ...this.transcript,
          {
            text: transcript,
            start: payload.start ?? Date.now() / 1000,
          },
        ];
        this.fullTranscript = `${this.fullTranscript} ${transcript}`.trim();
        this.liveSegment = "";
        this.updateInsights();
      } else {
        this.liveSegment = transcript;
      }
      this.requestUpdate();
    } catch (error) {
      console.error("Failed to parse transcript message", error);
    }
  }

  updateInsights() {
    const sentences = this.fullTranscript
      .split(/(?<=[.!?])\s+/)
      .map((sentence) => sentence.trim())
      .filter((sentence) => sentence.length > 0);

    if (!sentences.length) {
      this.keyPoints = [];
      this.actionItems = [];
      return;
    }

    const scored = sentences.map((sentence, index) => ({
      sentence,
      index,
      score: this.scoreSentence(sentence),
    }));

    const unique = new Set();
    const keyPoints = [];

    for (const entry of scored
      .sort((a, b) => b.score - a.score || a.index - b.index)) {
      const normalized = entry.sentence.replace(/\s+/g, " ").trim();
      if (!normalized || unique.has(normalized.toLowerCase())) continue;
      if (normalized.length < 35 && entry.score < 2 && keyPoints.length > 0) {
        continue;
      }
      unique.add(normalized.toLowerCase());
      keyPoints.push(normalized);
      if (keyPoints.length >= 5) break;
    }

    if (!keyPoints.length && sentences.length) {
      keyPoints.push(sentences[0]);
    }

    const actionItems = sentences.filter((sentence) =>
      ACTION_ITEM_PATTERN.test(sentence)
    );

    this.keyPoints = keyPoints;
    this.actionItems = Array.from(
      new Set(actionItems.map((item) => item.replace(/\s+/g, " ").trim()))
    ).slice(0, 5);
  }

  scoreSentence(sentence) {
    const lowered = sentence.toLowerCase();
    let score = 0;
    for (const [keyword, weight] of KEYWORD_WEIGHTS) {
      if (lowered.includes(keyword)) {
        score += weight;
      }
    }
    if (sentence.length > 120) score += 1.5;
    if (/\b(we|team|stakeholder|client|release)\b/i.test(sentence)) {
      score += 1;
    }
    return score;
  }

  resetBoard() {
    this.stopSession();
    this.transcript = [];
    this.liveSegment = "";
    this.keyPoints = [];
    this.actionItems = [];
    this.fullTranscript = "";
    this.statusMessage = "Ready to transcribe";
    this.requestUpdate();
  }

  renderInsightList(items, placeholder) {
    if (items.length === 0) {
      return html`<p class="insight-placeholder">${placeholder}</p>`;
    }

    return html`<ul>
      ${items.map(
        (item) => html`<li>
          <span class="bullet"></span>
          <span>${item}</span>
        </li>`
      )}
    </ul>`;
  }

  get notesText() {
    if (!this.transcript.length) {
      return "Add context during the conversation and we'll capture the highlights for you.";
    }
    const latest = this.transcript[this.transcript.length - 1]?.text ?? "";
    if (!latest) {
      return "Keep the conversation going to capture more insights.";
    }
    return latest.length > 220 ? `${latest.slice(0, 217)}…` : latest;
  }

  formatDuration(milliseconds) {
    const totalSeconds = Math.floor(milliseconds / 1000);
    const minutes = Math.floor(totalSeconds / 60)
      .toString()
      .padStart(2, "0");
    const seconds = (totalSeconds % 60).toString().padStart(2, "0");
    return `${minutes}:${seconds}`;
  }

  render() {
    return html`
      <div class="app-shell">
        <header class="top-bar">
          <div class="brand">
            <div class="brand-mark">Transcribe</div>
            <span class="brand-tag">Powered by Deepgram</span>
          </div>
          <nav class="top-nav">
            <a href="#" class="active">Home</a>
            <a href="#">My Files</a>
            <a href="#">New File</a>
          </nav>
          <button class="new-session" @click=${this.resetBoard}>
            New Session
          </button>
        </header>
        <main class="main-content">
          <section class="panel transcription">
            <div class="panel-header">
              <div>
                <h1>Meeting Transcription</h1>
                <p>
                  Follow conversations in real time, capture decisions, and surface
                  the moments that matter most to your team.
                </p>
              </div>
              <div class=${`live-status ${this.isRecording ? "recording" : ""}`}>
                <span class="status-dot"></span>
                <span>${this.isRecording ? "Live" : "Idle"}</span>
                <span class="duration">${this.formatDuration(this.elapsedMs)}</span>
              </div>
            </div>
            <div class="meeting-meta">
              <label>
                <span>Meeting title</span>
                <input
                  type="text"
                  placeholder="e.g. Quarterly product review"
                  .value=${this.meetingTitle}
                  @input=${this.updateMeetingTitle}
                />
              </label>
              <div class="status-message">${this.statusMessage}</div>
            </div>
            <div class="controls">
              <div class="control-group">
                <span class="label">Audio source</span>
                <div class="source-options">
                  <button
                    class=${`source-button ${
                      this.selectedSource === "microphone" ? "active" : ""
                    }`}
                    @click=${() => this.setSource("microphone")}
                  >
                    Microphone
                  </button>
                  <button
                    class=${`source-button ${
                      this.selectedSource === "system" ? "active" : ""
                    }`}
                    @click=${() => this.setSource("system")}
                  >
                    System audio
                  </button>
                </div>
              </div>
              <div class="control-group action-buttons">
                ${this.isRecording
                  ? html`<button class="stop" @click=${this.stopSession}>
                      Stop recording
                    </button>`
                  : html`<button class="start" @click=${this.startSession}>
                      Start recording
                    </button>`}
              </div>
            </div>
            <div class="transcript-window">
              ${this.transcript.length === 0 && !this.liveSegment
                ? html`<div class="empty-state">
                    <h3>Ready when you are</h3>
                    <p>
                      Select an audio source and press start to begin transcribing
                      your meeting in real time.
                    </p>
                  </div>`
                : html`
                    ${this.transcript.map(
                      (segment, index) => html`<div class="utterance">
                        <span class="utterance-index">${index + 1}</span>
                        <p>${segment.text}</p>
                      </div>`
                    )}
                    ${this.liveSegment
                      ? html`<div class="utterance live">
                          <span class="utterance-index">•</span>
                          <p>${this.liveSegment}</p>
                        </div>`
                      : null}
                  `}
            </div>
          </section>
          <aside class="panel summary">
            <h2>Summary</h2>
            <div class="insight-section">
              <div class="section-heading">
                <h3>Key Points</h3>
                <span>${this.keyPoints.length}/5</span>
              </div>
              ${this.renderInsightList(
                this.keyPoints,
                "Key insights will appear here as the conversation progresses."
              )}
            </div>
            <div class="insight-section">
              <div class="section-heading">
                <h3>Action Items</h3>
                <span>${this.actionItems.length}/5</span>
              </div>
              ${this.renderInsightList(
                this.actionItems,
                "Call out follow-ups or next steps to capture action items automatically."
              )}
            </div>
            <div class="notes-section">
              <h3>Notes</h3>
              <p>${this.notesText}</p>
            </div>
          </aside>
        </main>
      </div>
    `;
  }
}

customElements.define("meeting-transcriber", MeetingTranscriber);
