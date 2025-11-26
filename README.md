# chatdio

A modern Web Audio library for building conversational AI interfaces. Handles microphone capture, audio playback, device management, WebSocket streaming, and real-time visualization — all with cross-browser support (Chrome, Firefox, Safari).

## Features

- 🎙️ **Microphone Capture** with echo cancellation, noise suppression, and auto gain control
- 🔊 **Audio Playback** with buffering, volume control, and seamless queuing
- 📱 **Device Management** with hot-plug detection and automatic fallback
- 🌐 **WebSocket Streaming** with auto-reconnection and binary/JSON modes
- 📊 **Real-time Visualization** data for level meters and waveforms
- 🎚️ **Sample Rate & Bit Depth** conversion (8/16/24/32-bit, 8kHz-48kHz)
- 🔇 **Barge-in Support** for interrupting AI responses

## Installation

```bash
npm install chatdio
```

## Quick Start

```typescript
import { ConversationalAudio } from 'chatdio';

// Create instance with configuration
const audio = new ConversationalAudio({
  microphone: {
    sampleRate: 16000,
    echoCancellation: true,
    noiseSuppression: true,
  },
  playback: {
    sampleRate: 24000,
    bitDepth: 16,
  },
  websocket: {
    url: 'wss://your-ai-server.com/audio',
    autoReconnect: true,
  },
});

// Initialize (must be called from a user gesture)
document.querySelector('#startBtn')?.addEventListener('click', async () => {
  await audio.initialize();
  
  // Start full-duplex conversation
  await audio.startConversation();
});

// Handle events
audio.on('mic:activity', (data) => {
  console.log('Mic level:', data.volume, 'Speaking:', data.isSpeaking);
});

audio.on('playback:activity', (data) => {
  console.log('Playback level:', data.volume);
});

audio.on('ws:connected', () => {
  console.log('Connected to AI server');
});

audio.on('ws:message', (message) => {
  console.log('Received message:', message);
});
```

## Core Components

### ConversationalAudio

The main orchestrator that ties everything together.

```typescript
const audio = new ConversationalAudio({
  microphone: { /* MicrophoneConfig */ },
  playback: { /* PlaybackConfig */ },
  websocket: { /* WebSocketConfig */ },
  deviceManager: { /* DeviceManagerConfig */ },
  activityAnalyzer: { /* ActivityAnalyzerConfig */ },
});

// Lifecycle
await audio.initialize();      // Initialize (from user gesture)
await audio.startConversation(); // Start mic + websocket
audio.stopConversation();      // Stop mic + playback
audio.dispose();               // Cleanup resources

// Turn management (barge-in / interruption)
const turnId = audio.startTurn();           // Start new turn, interrupt any playing audio
audio.interruptTurn();                       // Interrupt current turn, start new one
audio.interruptTurn(false);                  // Interrupt without starting new turn
audio.getCurrentTurnId();                    // Get current turn ID
audio.clearTurnBuffer(turnId);               // Clear buffered audio for a turn
await audio.playAudioForTurn(data, turnId);  // Play only if turn is current

// Device selection
audio.getInputDevices();       // List microphones
audio.getOutputDevices();      // List speakers
await audio.setInputDevice(deviceId);
await audio.setOutputDevice(deviceId);

// Volume control
audio.setVolume(0.8);
audio.getVolume();

// Mute
audio.setMicrophoneMuted(true);
audio.isMicrophoneMuted();
```

### MicrophoneCapture

Standalone microphone capture with resampling and format conversion.

```typescript
import { MicrophoneCapture } from 'chatdio';

const mic = new MicrophoneCapture({
  sampleRate: 16000,          // Output sample rate
  echoCancellation: true,
  noiseSuppression: true,
  autoGainControl: true,
  bufferSize: 2048,           // Processing buffer size
});

mic.on('data', (pcmData: ArrayBuffer) => {
  // 16-bit PCM audio data ready to send
  websocket.send(pcmData);
});

mic.on('level', (level: number) => {
  updateMeter(level);
});

await mic.start();
// ...
mic.stop();
```

### AudioPlayback

Buffered audio playback with queue management.

```typescript
import { AudioPlayback } from 'chatdio';

const playback = new AudioPlayback({
  sampleRate: 24000,
  bitDepth: 16,
  channels: 1,
  bufferAhead: 0.1,  // Buffer ahead time in seconds
});

await playback.initialize();

// Queue audio chunks as they arrive
playback.on('buffer-low', () => {
  console.log('Buffer running low');
});

playback.on('ended', () => {
  console.log('Finished playing all audio');
});

// Queue PCM data
await playback.queueAudio(pcmArrayBuffer);

// Control playback
playback.pause();
await playback.resume();
playback.stop();
playback.setVolume(0.8);
```

### AudioDeviceManager

Device enumeration with change detection.

```typescript
import { AudioDeviceManager } from 'chatdio';

const deviceManager = new AudioDeviceManager({
  autoFallback: true,    // Auto-switch on device disconnect
  pollInterval: 1000,    // Fallback polling interval
});

await deviceManager.initialize();

// List devices
deviceManager.getInputDevices();
deviceManager.getOutputDevices();

// Select devices
await deviceManager.setInputDevice(deviceId);
await deviceManager.setOutputDevice(deviceId);

// Listen for changes
deviceManager.on('devices-changed', (devices) => {
  updateDeviceList(devices);
});

deviceManager.on('device-disconnected', (device) => {
  console.log('Device disconnected:', device.label);
});

// Check Safari compatibility
if (!deviceManager.isOutputSelectionSupported()) {
  console.log('Output selection not supported (Safari)');
}
```

### WebSocketBridge

WebSocket connection with auto-reconnection.

```typescript
import { WebSocketBridge } from 'chatdio';

const ws = new WebSocketBridge({
  url: 'wss://ai-server.com/audio',
  autoReconnect: true,
  maxReconnectAttempts: 5,
  reconnectDelay: 1000,
  binaryMode: true,
  
  // Custom message wrapping
  wrapOutgoingAudio: (data) => {
    return JSON.stringify({
      type: 'audio',
      data: btoa(String.fromCharCode(...new Uint8Array(data))),
    });
  },
  
  // Custom message parsing
  parseIncomingAudio: (event) => {
    const msg = JSON.parse(event.data);
    if (msg.type === 'audio') {
      return base64ToArrayBuffer(msg.data);
    }
    return null;
  },
});

ws.on('connected', () => console.log('Connected'));
ws.on('disconnected', (code, reason) => console.log('Disconnected:', reason));
ws.on('reconnecting', (attempt) => console.log('Reconnecting...', attempt));
ws.on('audio', (data) => playback.queueAudio(data));
ws.on('message', (msg) => console.log('Message:', msg));

await ws.connect();
ws.sendAudio(pcmData);
ws.sendMessage({ type: 'transcript', text: 'Hello' });
ws.disconnect();
```

### ActivityAnalyzer

Real-time audio analysis for visualizations.

```typescript
import { ActivityAnalyzer, VisualizationUtils } from 'chatdio';

const analyzer = new ActivityAnalyzer({
  fftSize: 256,
  smoothingTimeConstant: 0.8,
  updateInterval: 50,  // ms
});

// Connect to an audio node
analyzer.connect(micCapture.getAnalyzerNode());
analyzer.start();

// Listen for activity updates
analyzer.on('activity', (data) => {
  // data.volume - RMS volume (0-1)
  // data.peak - Peak level with decay (0-1)
  // data.frequencyData - Uint8Array for spectrum
  // data.timeDomainData - Uint8Array for waveform
  // data.isSpeaking - Voice activity detection
  
  drawWaveform(data.timeDomainData);
  drawSpectrum(data.frequencyData);
});

analyzer.on('speaking-start', () => console.log('Started speaking'));
analyzer.on('speaking-stop', () => console.log('Stopped speaking'));

// Utility functions for visualization
const bands = analyzer.getFrequencyBands(8);  // Get 8 frequency bands
const waveformPath = VisualizationUtils.createWaveformPath(data.timeDomainData, 200, 50);
const barHeights = VisualizationUtils.createBarHeights(data.frequencyData, 16, 100);
```

## Events

### ConversationalAudio Events

| Event | Payload | Description |
|-------|---------|-------------|
| `mic:start` | - | Microphone started |
| `mic:stop` | - | Microphone stopped |
| `mic:data` | `ArrayBuffer` | PCM audio data |
| `mic:activity` | `AudioActivityData` | Mic visualization data |
| `mic:error` | `Error` | Microphone error |
| `playback:start` | - | Playback started |
| `playback:stop` | - | Playback stopped |
| `playback:ended` | - | All queued audio finished |
| `playback:activity` | `AudioActivityData` | Playback visualization data |
| `playback:error` | `Error` | Playback error |
| `ws:connected` | - | WebSocket connected |
| `ws:disconnected` | `code, reason` | WebSocket disconnected |
| `ws:reconnecting` | `attempt` | Reconnection attempt |
| `ws:audio` | `ArrayBuffer` | Audio received from server |
| `ws:message` | `unknown` | Non-audio message received |
| `ws:error` | `Error` | WebSocket error |
| `device:changed` | `AudioDevice[]` | Device list changed |
| `device:input-changed` | `AudioDevice \| null` | Input device changed |
| `device:output-changed` | `AudioDevice \| null` | Output device changed |
| `device:disconnected` | `AudioDevice` | Device disconnected |
| `turn:started` | `turnId, previousTurnId` | New turn started |
| `turn:interrupted` | `turnId` | Turn was interrupted (barge-in) |
| `turn:ended` | `turnId` | Turn ended normally |

## Turn Management (Barge-in)

Turn management allows you to handle conversation interruptions cleanly. When the user speaks while the AI is responding (barge-in), you can:

1. Stop current playback immediately
2. Clear any buffered audio
3. Ignore any late-arriving audio from the interrupted turn

```typescript
// Start a conversation turn when AI begins responding
const turnId = audio.startTurn();
console.log('Started turn:', turnId);

// When user interrupts (detected via voice activity or button)
audio.on('mic:activity', (data) => {
  if (data.isSpeaking && audio.isPlaybackActive()) {
    // User is speaking while AI is talking - barge-in!
    const { interruptedTurnId, newTurnId } = audio.interruptTurn();
    console.log('Interrupted turn:', interruptedTurnId);
    console.log('New turn:', newTurnId);
  }
});

// Server sends audio with turn ID
audio.on('ws:message', async (message) => {
  if (message.type === 'audio') {
    // Only play if turn matches - old audio is automatically ignored
    const played = await audio.playAudioForTurn(message.data, message.turnId);
    if (!played) {
      console.log('Ignored audio from old turn:', message.turnId);
    }
  }
});

// Listen for turn events
audio.on('turn:started', (turnId, previousTurnId) => {
  console.log('Turn started:', turnId, 'Previous:', previousTurnId);
});

audio.on('turn:interrupted', (turnId) => {
  console.log('Turn interrupted:', turnId);
  // Notify server to stop generating audio for this turn
  audio.sendMessage({ type: 'interrupt', turnId });
});

audio.on('turn:ended', (turnId) => {
  console.log('Turn ended naturally:', turnId);
});
```

### Server-Side Turn ID Support

When your server sends audio, include a `turnId` in JSON messages:

```json
{
  "type": "audio",
  "data": "base64_encoded_audio...",
  "turnId": "turn_123456789_1"
}
```

Or use a custom parser to extract the turn ID:

```typescript
const audio = new ConversationalAudio({
  websocket: {
    url: 'wss://your-server.com/audio',
    parseIncomingAudio: (event) => {
      const msg = JSON.parse(event.data);
      if (msg.type === 'audio') {
        return {
          data: base64ToArrayBuffer(msg.audio),
          turnId: msg.turn_id,  // Your server's turn ID field
        };
      }
      return null;
    },
  },
});
```

## Type Definitions

```typescript
interface AudioFormat {
  sampleRate: 8000 | 16000 | 22050 | 24000 | 44100 | 48000;
  bitDepth: 8 | 16 | 24 | 32;
  channels: 1 | 2;
}

interface AudioDevice {
  deviceId: string;
  label: string;
  kind: 'audioinput' | 'audiooutput';
  isDefault: boolean;
}

interface AudioActivityData {
  volume: number;
  peak: number;
  frequencyData: Uint8Array;
  timeDomainData: Uint8Array;
  isSpeaking: boolean;
}

type ConnectionState = 'disconnected' | 'connecting' | 'connected' | 'reconnecting' | 'error';
```

## Browser Compatibility

| Feature | Chrome | Firefox | Safari |
|---------|--------|---------|--------|
| Mic Capture | ✅ | ✅ | ✅ |
| Echo Cancellation | ✅ | ✅ | ✅ |
| Audio Playback | ✅ | ✅ | ✅ |
| Output Device Selection | ✅ | ✅ | ❌ |
| Device Change Detection | ✅ | ✅ | Via polling |

## Notes

- **User Gesture Required**: `initialize()` and `startMicrophone()` must be called from a user interaction (click, touch) in Safari and Firefox
- **Safari Output**: Output device selection (`setSinkId`) is not supported in Safari; audio plays through the default device
- **Echo Cancellation**: Browser implementations vary; Chrome generally has the best echo cancellation
- **Sample Rates**: Native sample rate depends on the audio device; resampling is done in JavaScript when needed

## License

MIT

