# Gesture DJ Booth Project Plan

This file provides context and instructions for Claude Code (or any AI assistant) working on this project.

## Project Overview

**Goal:** Build a simplified, browser-based DJ booth that allows a user to mix two pre-loaded audio tracks using hand gestures via their webcam.

**Core Philosophy:** Simplicity over complexity. The interface should be minimal, focusing only on the essential tools for blending two songs. The gesture mapping must be intuitive and robust to prevent misinterpretation by the tracking model.

## Technology Stack

*   **Frontend UI:** Vanilla HTML, CSS, JavaScript (No heavy frameworks required for this prototype).
*   **Audio Engine:** Web Audio API (for precise, low-latency playback and volume/crossfader control).
*   **Computer Vision:** MediaPipe Hands (via CDN) for real-time hand landmark detection in the browser.

## Core Features & Architecture

The application consists of three main components:

1.  **The UI (index.html, style.css):**
    *   Visual representation of Deck A (Left) and Deck B (Right).
    *   Play/Pause indicators for each deck.
    *   A visual Crossfader slider in the center.
    *   (Optional) Vertical volume sliders for each deck.
    *   A hidden or small `<video>` element for the webcam feed.
    *   A `<canvas>` element overlaying the video to draw hand landmarks for debugging.

2.  **The Audio Engine (audio.js or within app.js):**
    *   Uses `AudioContext`.
    *   Pre-loads two audio files (`track-a.mp3` and `track-b.mp3`) using `fetch` and `decodeAudioData`.
    *   Sets up two `BufferSourceNode`s connected to two `GainNode`s (for individual volume).
    *   Connects both `GainNode`s to a master `GainNode` (or custom crossfader logic) before routing to the `AudioDestination`.

3.  **The Gesture Controller (gesture.js or within app.js):**
    *   Initializes the MediaPipe Camera and Hands instances.
    *   Processes the landmark data on every frame.
    *   Translates specific landmark configurations into actionable events (e.g., "Left Hand Open Palm Detected").
    *   Maps these events to the Audio Engine controls.

## Gesture Mapping Specification

This is the exact mapping that must be implemented.

| Feature | Action | Hand Assignment | Gesture Description |
| :--- | :--- | :--- | :--- |
| **Play/Pause (Deck A)** | Toggle playback state | **Left Hand** | **Open Palm** (fingers extended, facing camera) |
| **Play/Pause (Deck B)** | Toggle playback state | **Right Hand** | **Open Palm** (fingers extended, facing camera) |
| **Crossfader** | Blend audio (0.0 to 1.0) | **Either Hand** | **Flat Hand Horizontal Swipe** (map X-coordinate) |
| **Volume (Deck A)** | Adjust volume level | **Left Hand** | **Pinch + Move Y** (Thumb and index touching, move vertically) |
| **Volume (Deck B)** | Adjust volume level | **Right Hand** | **Pinch + Move Y** (Thumb and index touching, move vertically) |

## Development Guidelines for Claude Code

*   **Iterative Approach:** Do not attempt to build everything at once.
    1.  First, build the UI and wire up the Web Audio API with mouse clicks. Ensure the audio loads and the crossfader works manually.
    2.  Second, integrate MediaPipe and ensure landmarks are drawing correctly on the canvas.
    3.  Third, implement the gesture detection logic one gesture at a time (start with Play/Pause).
*   **Debouncing:** Implement strict debouncing for toggle actions (like Play/Pause) to prevent rapid, unintended firing when a hand is briefly detected in the open state.
*   **Smoothing:** When mapping continuous coordinates (like X for crossfader or Y for volume), apply a simple low-pass filter or moving average to the raw MediaPipe data. Raw coordinates are jittery and will cause audio artifacts if mapped directly.
*   **Error Handling:** Include robust error handling for camera access permissions and audio file loading failures.

## Recommended Audio Assets

For the best experience, use these two pre-selected, royalty-free tracks. They are both exactly 128 BPM and will mix perfectly without tempo adjustments.

1.  **Track A:** "Better Machine Future House 128bpm" by CONATHOR (Pixabay)
2.  **Track B:** "Ardor | Future House Music" by kontraa (Pixabay)

Download these and place them in a `public/` or `assets/` directory as `track-a.mp3` and `track-b.mp3`.
