# Cinemana for LG webOS TV

A client for Shabakaty Cinemana designed for LG Smart TVs running webOS (3.x to 24+).

![Cinemana](public/largeIcon.png)

## Features

- **Full HD Interface:** Built for 1080p TV viewing with high contrast, legible typography, and cinematic dark theme.
- **TV Remote Navigation:** Complete directional D-pad spatial navigation, Enter, Back, and LG Magic Remote air-mouse support.
- **Hardware-Accelerated Playback:** Native HTML5 video player supporting direct streaming links with resolutions from 240p to 4K (2160p).
- **Subtitles Engine:** Arabic and English subtitle parsing for SRT and WebVTT with right-to-left formatting.
- **Smart Intro Skipping:** One-click skip intro button synchronized with Cinemana skipping intervals.
- **Continue Watching:** Automatically saves playback progress to TV storage and resumes upon re-opening.
- **Virtual TV Keyboard:** On-screen English and Arabic virtual keyboard for search without external accessories.
- **Legal & Settings Views:** Dedicated settings, parental filtering, terms of service, and privacy policy pages.

## Installation on LG webOS TV

### Prerequisites

- [webOS TV CLI](https://webostv.developer.lge.com/develop/tools/cli-installation) (`@webos-tools/cli` or LG webOS SDK)
- Developer Mode enabled on your LG TV via the Developer Mode app from the LG Content Store.

### Installing the IPK Package

Download the latest `.ipk` package from the [Releases](https://github.com/KyuJunior/Cinemana-LG/releases) section, then run:

```bash
# Add your TV device target (replace with your TV IP address)
ares-setup-device --add mytv --info "{\"ip\":\"192.168.1.50\",\"port\":\"9922\",\"username\":\"prisoner\"}"

# Install package
ares-install -d mytv com.cinemana.webos_1.0.0_all.ipk

# Launch Cinemana
ares-launch -d mytv com.cinemana.webos
```

## Development & Building

```bash
# Install dependencies
npm install

# Run Vite development server
npm run dev

# Build and sanitize for webOS Chromium 38+
npm run build

# Package IPK
npm run webos:package
```

## License

This project is an unofficial TV client created for private home use on networks with access to Shabakaty services. All media content and trademarks belong to their respective owners.
