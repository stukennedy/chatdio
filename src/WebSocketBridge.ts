import { TypedEventEmitter } from "./EventEmitter";
import type { WebSocketConfig, AudioFormat, ConnectionState } from "./types";

interface WebSocketBridgeEvents {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: (...args: any[]) => void;
  connected: () => void;
  disconnected: (code: number, reason: string) => void;
  reconnecting: (attempt: number) => void;
  error: (error: Error) => void;
  audio: (data: ArrayBuffer) => void;
  message: (data: unknown) => void;
  "state-change": (state: ConnectionState) => void;
}

/**
 * WebSocket bridge for streaming audio to/from a server
 * Handles reconnection, binary/text modes, and custom message formats
 */
export class WebSocketBridge extends TypedEventEmitter<WebSocketBridgeEvents> {
  private ws: WebSocket | null = null;
  private config: Required<
    Omit<WebSocketConfig, "wrapOutgoingAudio" | "parseIncomingAudio">
  > &
    Pick<WebSocketConfig, "wrapOutgoingAudio" | "parseIncomingAudio">;
  private state: ConnectionState = "disconnected";
  private reconnectAttempts = 0;
  private reconnectTimeout: number | null = null;
  private pingInterval: number | null = null;
  private lastPongTime = 0;
  private intentionalClose = false;

  // Buffer for outgoing audio when disconnected
  private sendBuffer: ArrayBuffer[] = [];
  private maxSendBufferSize = 50;

  constructor(config: WebSocketConfig) {
    super();
    this.config = {
      url: config.url,
      autoReconnect: config.autoReconnect ?? true,
      maxReconnectAttempts: config.maxReconnectAttempts ?? 5,
      reconnectDelay: config.reconnectDelay ?? 1000,
      sendFormat: config.sendFormat ?? {
        sampleRate: 16000,
        bitDepth: 16,
        channels: 1,
      },
      receiveFormat: config.receiveFormat ?? {
        sampleRate: 16000,
        bitDepth: 16,
        channels: 1,
      },
      binaryMode: config.binaryMode ?? true,
      wrapOutgoingAudio: config.wrapOutgoingAudio,
      parseIncomingAudio: config.parseIncomingAudio,
    };
  }

  /**
   * Get current connection state
   */
  getState(): ConnectionState {
    return this.state;
  }

  /**
   * Check if connected
   */
  isConnected(): boolean {
    return this.state === "connected" && this.ws?.readyState === WebSocket.OPEN;
  }

  /**
   * Connect to the WebSocket server
   */
  async connect(): Promise<void> {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      return;
    }

    this.intentionalClose = false;
    this.setState("connecting");

    return new Promise((resolve, reject) => {
      try {
        this.ws = new WebSocket(this.config.url);
        this.ws.binaryType = "arraybuffer";

        const connectionTimeout = setTimeout(() => {
          if (this.ws && this.ws.readyState !== WebSocket.OPEN) {
            this.ws.close();
            reject(new Error("Connection timeout"));
          }
        }, 10000);

        this.ws.onopen = () => {
          clearTimeout(connectionTimeout);
          this.handleOpen();
          resolve();
        };

        this.ws.onclose = (event) => {
          clearTimeout(connectionTimeout);
          this.handleClose(event);
        };

        this.ws.onerror = (event) => {
          clearTimeout(connectionTimeout);
          this.handleError(event);
          if (this.state === "connecting") {
            reject(new Error("Connection failed"));
          }
        };

        this.ws.onmessage = (event) => {
          this.handleMessage(event);
        };
      } catch (error) {
        this.setState("error");
        reject(error);
      }
    });
  }

  /**
   * Disconnect from the server
   */
  disconnect(): void {
    this.intentionalClose = true;
    this.stopReconnecting();
    this.stopPing();

    if (this.ws) {
      if (
        this.ws.readyState === WebSocket.OPEN ||
        this.ws.readyState === WebSocket.CONNECTING
      ) {
        this.ws.close(1000, "Client disconnecting");
      }
      this.ws = null;
    }

    this.sendBuffer = [];
    this.setState("disconnected");
  }

  /**
   * Send audio data to the server
   */
  sendAudio(data: ArrayBuffer): void {
    if (!this.isConnected()) {
      // Buffer audio for when we reconnect (with limit)
      if (this.sendBuffer.length < this.maxSendBufferSize) {
        this.sendBuffer.push(data);
      }
      return;
    }

    try {
      let payload: string | ArrayBuffer;

      if (this.config.wrapOutgoingAudio) {
        payload = this.config.wrapOutgoingAudio(data);
      } else if (this.config.binaryMode) {
        payload = data;
      } else {
        // Convert to base64 for text mode
        payload = JSON.stringify({
          type: "audio",
          data: this.arrayBufferToBase64(data),
          format: this.config.sendFormat,
        });
      }

      this.ws!.send(payload);
    } catch (error) {
      this.emit("error", error as Error);
    }
  }

  /**
   * Send a non-audio message to the server
   */
  sendMessage(message: unknown): void {
    if (!this.isConnected()) {
      console.warn("Cannot send message: not connected");
      return;
    }

    try {
      const payload =
        typeof message === "string" ? message : JSON.stringify(message);
      this.ws!.send(payload);
    } catch (error) {
      this.emit("error", error as Error);
    }
  }

  /**
   * Update the WebSocket URL (will reconnect if connected)
   */
  async setUrl(url: string): Promise<void> {
    const wasConnected = this.isConnected();
    this.config.url = url;

    if (wasConnected) {
      this.disconnect();
      await this.connect();
    }
  }

  /**
   * Get send format configuration
   */
  getSendFormat(): AudioFormat {
    return { ...this.config.sendFormat };
  }

  /**
   * Get receive format configuration
   */
  getReceiveFormat(): AudioFormat {
    return { ...this.config.receiveFormat };
  }

  /**
   * Update audio format configurations
   */
  updateFormats(config: {
    sendFormat?: AudioFormat;
    receiveFormat?: AudioFormat;
  }): void {
    if (config.sendFormat) {
      this.config.sendFormat = config.sendFormat;
    }
    if (config.receiveFormat) {
      this.config.receiveFormat = config.receiveFormat;
    }
  }

  private handleOpen(): void {
    this.reconnectAttempts = 0;
    this.setState("connected");
    this.emit("connected");
    this.startPing();

    // Flush send buffer
    while (this.sendBuffer.length > 0 && this.isConnected()) {
      const data = this.sendBuffer.shift()!;
      this.sendAudio(data);
    }
  }

  private handleClose(event: CloseEvent): void {
    this.stopPing();
    this.ws = null;

    this.emit("disconnected", event.code, event.reason || "Connection closed");

    if (!this.intentionalClose && this.config.autoReconnect) {
      this.scheduleReconnect();
    } else {
      this.setState("disconnected");
    }
  }

  private handleError(event: Event): void {
    const error = new Error("WebSocket error");
    this.emit("error", error);

    if (this.state !== "reconnecting") {
      this.setState("error");
    }
  }

  private handleMessage(event: MessageEvent): void {
    try {
      let audioData: ArrayBuffer | null = null;

      // Custom parser takes precedence
      if (this.config.parseIncomingAudio) {
        audioData = this.config.parseIncomingAudio(event);
        if (audioData) {
          this.emit("audio", audioData);
          return;
        }
        // If parser returns null, treat as non-audio message
        this.emitNonAudioMessage(event.data);
        return;
      }

      // Binary data - assume it's audio
      if (event.data instanceof ArrayBuffer) {
        this.emit("audio", event.data);
        return;
      }

      // Text data - try to parse as JSON
      if (typeof event.data === "string") {
        try {
          const parsed = JSON.parse(event.data);

          // Check for audio in JSON wrapper
          if (parsed.type === "audio" && parsed.data) {
            audioData = this.base64ToArrayBuffer(parsed.data);
            this.emit("audio", audioData);
            return;
          }

          // Handle ping/pong for keep-alive
          if (parsed.type === "pong") {
            this.lastPongTime = Date.now();
            return;
          }

          // Non-audio message
          this.emit("message", parsed);
        } catch {
          // Not JSON - emit as raw message
          this.emit("message", event.data);
        }
        return;
      }

      // Blob data - convert to ArrayBuffer
      if (event.data instanceof Blob) {
        const reader = new FileReader();
        reader.onload = () => {
          if (reader.result instanceof ArrayBuffer) {
            this.emit("audio", reader.result);
          }
        };
        reader.readAsArrayBuffer(event.data);
        return;
      }

      // Unknown format
      this.emit("message", event.data);
    } catch (error) {
      this.emit("error", error as Error);
    }
  }

  private emitNonAudioMessage(data: unknown): void {
    if (typeof data === "string") {
      try {
        const parsed = JSON.parse(data);
        this.emit("message", parsed);
      } catch {
        this.emit("message", data);
      }
    } else {
      this.emit("message", data);
    }
  }

  private scheduleReconnect(): void {
    if (this.reconnectAttempts >= this.config.maxReconnectAttempts) {
      this.setState("error");
      this.emit("error", new Error("Max reconnection attempts reached"));
      return;
    }

    this.setState("reconnecting");
    this.reconnectAttempts++;
    this.emit("reconnecting", this.reconnectAttempts);

    // Exponential backoff with jitter
    const baseDelay = this.config.reconnectDelay;
    const exponentialDelay =
      baseDelay * Math.pow(2, this.reconnectAttempts - 1);
    const jitter = Math.random() * 1000;
    const delay = Math.min(exponentialDelay + jitter, 30000); // Max 30s

    this.reconnectTimeout = window.setTimeout(async () => {
      try {
        await this.connect();
      } catch {
        // connect() will trigger another reconnect attempt via handleClose
      }
    }, delay);
  }

  private stopReconnecting(): void {
    if (this.reconnectTimeout !== null) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
    this.reconnectAttempts = 0;
  }

  private startPing(): void {
    // Send periodic pings to keep connection alive
    this.pingInterval = window.setInterval(() => {
      if (this.isConnected()) {
        try {
          this.ws!.send(
            JSON.stringify({ type: "ping", timestamp: Date.now() })
          );
        } catch {
          // Ignore ping errors
        }
      }
    }, 30000); // Every 30 seconds
  }

  private stopPing(): void {
    if (this.pingInterval !== null) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
  }

  private setState(state: ConnectionState): void {
    if (this.state !== state) {
      this.state = state;
      this.emit("state-change", state);
    }
  }

  private arrayBufferToBase64(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer);
    let binary = "";
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }

  private base64ToArrayBuffer(base64: string): ArrayBuffer {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes.buffer as ArrayBuffer;
  }
}
