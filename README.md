#Laucher Here!
https://drive.google.com/file/d/11b5ntJY1l5R7etIj32XglvzeA-fWgP2A/view?usp=drivesdk

# AeroIOS Launcher for Windows

A fluid, modern, iOS-style desktop shell and application manager for Windows 10 and Windows 11.

## Features

- **Dynamic Island (iOS 18)**: Fluid spring animations, dynamic real-time CPU/RAM visualizers, active activity waves, and quick controls.
- **Multitasking & App Switcher**: Interactive 3D deck view with swipe-up to force-kill applications.
- **Smart RAM Management**:
  - Unobtrusive mini straight-line RAM meter (1-100%) with dynamic opacity and green/yellow/red status indicator.
  - Floating alert overlay visible across all applications starting from 65% RAM.
  - Progressive automatic cleanup of oldest background processes when RAM hits 97%.
- **Low Latency Native Bridge**: Direct Win32 C++ backend for instant zero-lag window control, GPU-accelerated window animations, and full hardware utilization.
- **Split Screen**: 1/2, 1/3, 2/3 ratio snapping with real-time divider handle.
- **Spotlight Search**: Fast, keyboard-navigable universal application search (`Ctrl + Space`).

## Build & Run

```bash
# Install dependencies
npm install

# Run development mode
npm start

# Build standalone portable executable
npx electron-builder --win portable
```

## Architecture

- `main.js`: Core Electron orchestration, window management, and memory policy.
- `app.js`: Client-side UI animations, gestures, and application launcher logic.
- `styles.css`: High-performance hardware-accelerated CSS styling.
- `core_bridge.cpp`: Native Win32 C++ bridge communicating over stdio.

## License

MIT License.
