import { TypedEventEmitter } from "./EventEmitter";
import type { MicrophoneConfig, SampleRate, BitDepth } from "./types";

interface MicrophoneCaptureEvents {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: (...args: any[]) => void;
  data: (data: ArrayBuffer) => void;
  start: () => void;
  stop: () => void;
  error: (error: Error) => void;
  level: (level: number) => void;
}

/**
 * Captures microphone audio with echo cancellation and resampling
 * Cross-browser compatible (Chrome, Firefox, Safari)
 */
export class MicrophoneCapture extends TypedEventEmitter<MicrophoneCaptureEvents> {
  private audioContext: AudioContext | null = null;
  private mediaStream: MediaStream | null = null;
  private sourceNode: MediaStreamAudioSourceNode | null = null;
  private processorNode: ScriptProcessorNode | null = null;
  private analyzerNode: AnalyserNode | null = null;
  private isCapturing = false;
  private config: Required<MicrophoneConfig>;

  // For resampling
  private inputSampleRate: number = 48000;
  private resampleBuffer: Float32Array[] = [];

  constructor(config: MicrophoneConfig = {}) {
    super();
    this.config = {
      sampleRate: config.sampleRate ?? 16000,
      echoCancellation: config.echoCancellation ?? true,
      noiseSuppression: config.noiseSuppression ?? true,
      autoGainControl: config.autoGainControl ?? true,
      deviceId: config.deviceId ?? "",
      bufferSize: config.bufferSize ?? 2048,
    };
  }

  /**
   * Start capturing microphone audio
   * Must be called from a user gesture on Safari/Firefox
   */
  async start(): Promise<void> {
    if (this.isCapturing) {
      return;
    }

    try {
      // Create AudioContext (handle Safari prefix)
      const AudioContextClass =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext })
          .webkitAudioContext;
      if (!AudioContextClass) {
        throw new Error("Web Audio API not supported");
      }

      // Create context - Safari requires this to happen in response to user gesture
      this.audioContext = new AudioContextClass();
      this.inputSampleRate = this.audioContext.sampleRate;

      // Resume context if suspended (required by browsers after autoplay policy)
      if (this.audioContext.state === "suspended") {
        await this.audioContext.resume();
      }

      // Get microphone stream with constraints
      const constraints: MediaStreamConstraints = {
        audio: {
          deviceId: this.config.deviceId
            ? { exact: this.config.deviceId }
            : undefined,
          echoCancellation: { ideal: this.config.echoCancellation },
          noiseSuppression: { ideal: this.config.noiseSuppression },
          autoGainControl: { ideal: this.config.autoGainControl },
          // Note: sampleRate constraint is not well supported, we'll resample manually
        },
      };

      this.mediaStream = await navigator.mediaDevices.getUserMedia(constraints);

      // Create audio nodes
      this.sourceNode = this.audioContext.createMediaStreamSource(
        this.mediaStream
      );

      // Create analyzer for level monitoring
      this.analyzerNode = this.audioContext.createAnalyser();
      this.analyzerNode.fftSize = 256;
      this.analyzerNode.smoothingTimeConstant = 0.3;

      // Create processor node (ScriptProcessorNode for cross-browser compatibility)
      // Note: ScriptProcessorNode is deprecated but has best browser support
      // AudioWorklet requires Safari 14.1+ and separate worklet file
      this.processorNode = this.audioContext.createScriptProcessor(
        this.config.bufferSize,
        1, // mono input
        1 // mono output
      );

      this.processorNode.onaudioprocess = this.handleAudioProcess;

      // Connect nodes: source -> analyzer -> processor -> destination (muted)
      this.sourceNode.connect(this.analyzerNode);
      this.analyzerNode.connect(this.processorNode);
      // Connect to destination to keep the processor running (required in some browsers)
      // The output is silent because we're not modifying it
      this.processorNode.connect(this.audioContext.destination);

      this.isCapturing = true;
      this.emit("start");
    } catch (error) {
      this.cleanup();
      const err = error instanceof Error ? error : new Error(String(error));
      this.emit("error", err);
      throw err;
    }
  }

  /**
   * Stop capturing microphone audio
   */
  stop(): void {
    if (!this.isCapturing) {
      return;
    }

    this.cleanup();
    this.isCapturing = false;
    this.emit("stop");
  }

  /**
   * Check if currently capturing
   */
  isActive(): boolean {
    return this.isCapturing;
  }

  /**
   * Change the input device
   */
  async setDevice(deviceId: string): Promise<void> {
    this.config.deviceId = deviceId;
    if (this.isCapturing) {
      // Restart with new device
      this.stop();
      await this.start();
    }
  }

  /**
   * Get the current configuration
   */
  getConfig(): Required<MicrophoneConfig> {
    return { ...this.config };
  }

  /**
   * Update configuration
   */
  async updateConfig(config: Partial<MicrophoneConfig>): Promise<void> {
    const needsRestart =
      this.isCapturing &&
      (config.deviceId !== undefined ||
        config.echoCancellation !== undefined ||
        config.noiseSuppression !== undefined ||
        config.autoGainControl !== undefined);

    Object.assign(this.config, config);

    if (needsRestart) {
      this.stop();
      await this.start();
    }
  }

  /**
   * Get the analyzer node for external visualization
   */
  getAnalyzerNode(): AnalyserNode | null {
    return this.analyzerNode;
  }

  /**
   * Get current audio context sample rate
   */
  getInputSampleRate(): number {
    return this.inputSampleRate;
  }

  /**
   * Get target output sample rate
   */
  getOutputSampleRate(): SampleRate {
    return this.config.sampleRate;
  }

  private handleAudioProcess = (event: AudioProcessingEvent): void => {
    if (!this.isCapturing) return;

    const inputData = event.inputBuffer.getChannelData(0);

    // Calculate and emit audio level
    const level = this.calculateLevel(inputData);
    this.emit("level", level);

    // Resample if necessary
    const outputData = this.resample(inputData);

    // Convert to Int16 (16-bit PCM) - most common format for speech
    const pcmData = this.floatTo16BitPCM(outputData);

    this.emit("data", pcmData.buffer as ArrayBuffer);
  };

  private calculateLevel(data: Float32Array): number {
    let sum = 0;
    for (let i = 0; i < data.length; i++) {
      sum += data[i] * data[i];
    }
    return Math.sqrt(sum / data.length);
  }

  private resample(input: Float32Array): Float32Array {
    const inputRate = this.inputSampleRate;
    const outputRate = this.config.sampleRate;

    if (inputRate === outputRate) {
      return input;
    }

    // Linear interpolation resampling
    const ratio = inputRate / outputRate;
    const outputLength = Math.floor(input.length / ratio);
    const output = new Float32Array(outputLength);

    for (let i = 0; i < outputLength; i++) {
      const srcIndex = i * ratio;
      const srcIndexFloor = Math.floor(srcIndex);
      const srcIndexCeil = Math.min(srcIndexFloor + 1, input.length - 1);
      const t = srcIndex - srcIndexFloor;

      // Linear interpolation
      output[i] = input[srcIndexFloor] * (1 - t) + input[srcIndexCeil] * t;
    }

    return output;
  }

  private floatTo16BitPCM(input: Float32Array): Int16Array {
    const output = new Int16Array(input.length);
    for (let i = 0; i < input.length; i++) {
      // Clamp to [-1, 1]
      const s = Math.max(-1, Math.min(1, input[i]));
      // Convert to 16-bit signed integer
      output[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
    }
    return output;
  }

  private cleanup(): void {
    if (this.processorNode) {
      this.processorNode.disconnect();
      this.processorNode.onaudioprocess = null;
      this.processorNode = null;
    }

    if (this.analyzerNode) {
      this.analyzerNode.disconnect();
      this.analyzerNode = null;
    }

    if (this.sourceNode) {
      this.sourceNode.disconnect();
      this.sourceNode = null;
    }

    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach((track) => track.stop());
      this.mediaStream = null;
    }

    if (this.audioContext) {
      // Close context if possible
      if (this.audioContext.state !== "closed") {
        this.audioContext.close().catch(() => {
          // Ignore close errors
        });
      }
      this.audioContext = null;
    }

    this.resampleBuffer = [];
  }
}

/**
 * Utility to convert between audio formats
 */
export class AudioFormatConverter {
  /**
   * Convert Float32Array to specified bit depth
   */
  static floatToPCM(input: Float32Array, bitDepth: BitDepth): ArrayBuffer {
    switch (bitDepth) {
      case 8:
        return AudioFormatConverter.floatTo8Bit(input).buffer as ArrayBuffer;
      case 16:
        return AudioFormatConverter.floatTo16Bit(input).buffer as ArrayBuffer;
      case 24:
        return AudioFormatConverter.floatTo24Bit(input);
      case 32:
        return AudioFormatConverter.floatTo32Bit(input).buffer as ArrayBuffer;
      default:
        throw new Error(`Unsupported bit depth: ${bitDepth}`);
    }
  }

  /**
   * Convert PCM data to Float32Array
   */
  static pcmToFloat(input: ArrayBuffer, bitDepth: BitDepth): Float32Array {
    switch (bitDepth) {
      case 8:
        return AudioFormatConverter.int8ToFloat(new Int8Array(input));
      case 16:
        return AudioFormatConverter.int16ToFloat(new Int16Array(input));
      case 24:
        return AudioFormatConverter.int24ToFloat(input);
      case 32:
        return AudioFormatConverter.int32ToFloat(new Int32Array(input));
      default:
        throw new Error(`Unsupported bit depth: ${bitDepth}`);
    }
  }

  private static floatTo8Bit(input: Float32Array): Int8Array {
    const output = new Int8Array(input.length);
    for (let i = 0; i < input.length; i++) {
      const s = Math.max(-1, Math.min(1, input[i]));
      output[i] = s * 127;
    }
    return output;
  }

  private static floatTo16Bit(input: Float32Array): Int16Array {
    const output = new Int16Array(input.length);
    for (let i = 0; i < input.length; i++) {
      const s = Math.max(-1, Math.min(1, input[i]));
      output[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
    }
    return output;
  }

  private static floatTo24Bit(input: Float32Array): ArrayBuffer {
    const output = new ArrayBuffer(input.length * 3);
    const view = new DataView(output);
    for (let i = 0; i < input.length; i++) {
      const s = Math.max(-1, Math.min(1, input[i]));
      const val = s < 0 ? s * 0x800000 : s * 0x7fffff;
      const intVal = Math.floor(val);
      view.setUint8(i * 3, intVal & 0xff);
      view.setUint8(i * 3 + 1, (intVal >> 8) & 0xff);
      view.setUint8(i * 3 + 2, (intVal >> 16) & 0xff);
    }
    return output;
  }

  private static floatTo32Bit(input: Float32Array): Int32Array {
    const output = new Int32Array(input.length);
    for (let i = 0; i < input.length; i++) {
      const s = Math.max(-1, Math.min(1, input[i]));
      output[i] = s < 0 ? s * 0x80000000 : s * 0x7fffffff;
    }
    return output;
  }

  private static int8ToFloat(input: Int8Array): Float32Array {
    const output = new Float32Array(input.length);
    for (let i = 0; i < input.length; i++) {
      output[i] = input[i] / 127;
    }
    return output;
  }

  private static int16ToFloat(input: Int16Array): Float32Array {
    const output = new Float32Array(input.length);
    for (let i = 0; i < input.length; i++) {
      output[i] = input[i] < 0 ? input[i] / 0x8000 : input[i] / 0x7fff;
    }
    return output;
  }

  private static int24ToFloat(input: ArrayBuffer): Float32Array {
    const view = new DataView(input);
    const numSamples = input.byteLength / 3;
    const output = new Float32Array(numSamples);
    for (let i = 0; i < numSamples; i++) {
      let val =
        view.getUint8(i * 3) |
        (view.getUint8(i * 3 + 1) << 8) |
        (view.getUint8(i * 3 + 2) << 16);
      // Sign extend
      if (val & 0x800000) {
        val |= 0xff000000;
      }
      output[i] = val < 0 ? val / 0x800000 : val / 0x7fffff;
    }
    return output;
  }

  private static int32ToFloat(input: Int32Array): Float32Array {
    const output = new Float32Array(input.length);
    for (let i = 0; i < input.length; i++) {
      output[i] = input[i] < 0 ? input[i] / 0x80000000 : input[i] / 0x7fffffff;
    }
    return output;
  }
}
