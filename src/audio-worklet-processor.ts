/**
 * AudioWorklet Processor for microphone capture
 * This runs in a separate audio thread for better performance
 *
 * Note: This file needs to be bundled separately or inlined as a Blob URL
 */

// The processor code as a string (will be loaded as a Blob URL)
const js = String.raw;

export const audioWorkletProcessorCode = js`
class MicrophoneProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.bufferSize = 2048;
    this.buffer = new Float32Array(this.bufferSize);
    this.bufferIndex = 0;
  }

  process(inputs, outputs, parameters) {
    const input = inputs[0];
    if (!input || !input[0]) {
      return true;
    }

    const inputChannel = input[0];
    
    // Accumulate samples into buffer
    for (let i = 0; i < inputChannel.length; i++) {
      this.buffer[this.bufferIndex++] = inputChannel[i];
      
      if (this.bufferIndex >= this.bufferSize) {
        // Send buffer to main thread
        this.port.postMessage({
          type: 'audio',
          buffer: this.buffer.slice(),
        });
        this.bufferIndex = 0;
      }
    }

    // Calculate RMS level for this frame
    let sum = 0;
    for (let i = 0; i < inputChannel.length; i++) {
      sum += inputChannel[i] * inputChannel[i];
    }
    const level = Math.sqrt(sum / inputChannel.length);
    
    this.port.postMessage({
      type: 'level',
      level: level,
    });

    return true;
  }
}

registerProcessor('microphone-processor', MicrophoneProcessor);
`;

/**
 * Creates a Blob URL for the AudioWorklet processor
 */
export function createWorkletBlobUrl(): string {
  const blob = new Blob([audioWorkletProcessorCode], {
    type: "application/javascript",
  });
  return URL.createObjectURL(blob);
}
