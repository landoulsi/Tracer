# Tracer

> A beautiful, real-time web-based network inspector for Android applications

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Platform](https://img.shields.io/badge/platform-Android-green.svg)
![Node](https://img.shields.io/badge/node-%3E%3D12.0.0-brightgreen.svg)

Tracer captures and displays Android network traffic in a beautiful web interface using an Android SDK and Gradle Plugin that automatically instruments your app.

## Features

✨ **Real-time monitoring** - Automatically captures network traffic and updates live  
🎨 **Beautiful UI** - Clean, modern interface with request/response viewer  
📊 **Detailed inspection** - View headers, body, status codes, and timing  
💅 **JSON beautification** - Syntax-highlighted JSON with proper formatting  
🔌 **Automatic instrumentation** - Gradle Plugin injects interceptors into all OkHttp clients  
📱 **Captures SDK traffic** - Works with third-party libraries, not just your code  

## Quick Start

### 1. Start the Tracer Server

```bash
git clone https://github.com/landoulsi/tracer.git
cd tracer
./tracer
```

Open http://localhost:3000

### 2. Setup ADB Reverse

```bash
adb reverse tcp:3000 tcp:3000
```

### 3. Integrate the SDK into Your App

Add the Tracer project as a composite build in your `settings.gradle.kts`:

```kotlin
includeBuild("/path/to/tracer/android")
```

Apply the plugin in your app's `build.gradle.kts`:

```kotlin
plugins {
    id("com.landoulsi.tracer.plugin")
}

dependencies {
    debugImplementation("com.github.landoulsi:tracer:1.0.0")
}
```

Initialize Tracer in your Application or debug initializer:

```kotlin
import com.landoulsi.tracer.Tracer
Tracer.init()
```

### 4. Run Your App

Build and run your app. All OkHttp network traffic will automatically appear in the Tracer web UI!

## How It Works

```
┌─────────────────┐
│  Android App    │
│   + SDK         │
└────────┬────────┘
         │
         │ HTTP POST /api/report
         │
    ┌────▼─────────┐
    │  Tracer Web  │  (Node.js server + UI)
    │  localhost   │
    └──────────────┘
```

The Gradle Plugin uses ASM bytecode instrumentation to automatically inject `TracerInterceptor` into every `OkHttpClient.Builder.build()` call in your app and its dependencies.

## Requirements

- Node.js >= 12.0.0
- Android device/emulator with USB debugging enabled
- OkHttp-based networking in your app

## Project Structure

```
tracer/
├── android/
│   ├── sdk/           # Android SDK library (io.tracer:sdk)
│   ├── gradle-plugin/ # Gradle Plugin (io.tracer.plugin)
│   └── sample/        # Sample app
├── web/               # Node.js server + Web UI
└── tracer             # Startup script
```

## License

MIT License - see [LICENSE](LICENSE) for details.
