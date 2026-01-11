# Live Robotic Control

A GitHub Pages website for controlling a 6-joint robot with customizable keyboard bindings and WebSocket-based network transmission.

## Features

- **6 Joint Controls** with customizable keyboard bindings
- **Emitter/Receptor Mode** for network-based control
- **WebSocket Connection** for real-time data transmission
- **Clean UI** with dark theme and cyan accent
- **Settings Persistence** via localStorage

## Default Key Bindings

| Joint | Decrease | Increase |
|-------|----------|----------|
| Joint 1 | Q | W |
| Joint 2 | A | S |
| Joint 3 | Z | X |
| Joint 4 | O | P |
| Joint 5 | K | L |
| Joint 6 | N | M |

## Quick Start

### 1. Open the Website
Open `index.html` in your browser, or deploy to GitHub Pages.

### 2. Run the Server (on robot/relay machine)
```bash
pip install websockets
python server.py 8080
```

### 3. Connect
- **Controller**: Set mode to "Emitter", enter server URL (e.g., `ws://192.168.1.100:8080`), click Connect
- **Robot**: Set mode to "Receptor", enter same server URL, click Connect

## Files

| File | Description |
|------|-------------|
| `index.html` | Main webpage |
| `styles.css` | Styling |
| `script.js` | Control logic |
| `server.py` | WebSocket relay server |

## GitHub Pages Deployment

1. Push to GitHub
2. Go to Settings → Pages
3. Select branch and save
4. Access at `https://username.github.io/repo-name/`

## Network Message Format

```json
{
  "type": "joint_update",
  "joint": "joint1",
  "value": 42,
  "action": "increase",
  "timestamp": 1704988800000
}
```
