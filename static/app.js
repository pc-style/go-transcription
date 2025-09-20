import { html, LitElement } from "//cdn.skypack.dev/lit@v2.8.0";

import "./components/meeting-transcriber.js";

class App extends LitElement {
  render() {
    return html`<meeting-transcriber></meeting-transcriber>`;
  }
}

customElements.define("deepgram-starter-ui", App);
