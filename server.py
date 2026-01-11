import asyncio
import json
import sys
from collections import defaultdict

try:
    import websockets
except ImportError:
    print("Install websockets: pip install websockets")
    sys.exit(1)


channels = defaultdict(set)


def parse_connection_params(path):
    if "?" not in path:
        return "default", "unknown"
    
    params = dict(p.split("=") for p in path.split("?")[1].split("&") if "=" in p)
    return params.get("channel", "default"), params.get("mode", "unknown")


async def broadcast_to_channel(channel, sender, message):
    for client in channels[channel]:
        if client != sender:
            try:
                await client.send(message)
            except:
                pass


async def handle_client(websocket):
    path = websocket.request.path if hasattr(websocket, 'request') else "/"
    channel, mode = parse_connection_params(path)
    channels[channel].add(websocket)
    print(f"[+] {mode}@{channel} connected")
    
    try:
        async for message in websocket:
            data = json.loads(message)
            print(f"[{channel}] {data.get('joint', '?')} = {data.get('value', '?')}")
            await broadcast_to_channel(channel, websocket, message)
    except:
        pass
    finally:
        channels[channel].discard(websocket)
        print(f"[-] {mode}@{channel} disconnected")


async def start_server(port):
    print(f"\n  Robot Control Server")
    print(f"  ====================")
    print(f"  URL: ws://0.0.0.0:{port}")
    print(f"  Press Ctrl+C to stop\n")
    
    async with websockets.serve(handle_client, "0.0.0.0", port):
        await asyncio.Future()


if __name__ == "__main__":
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8080
    
    try:
        asyncio.run(start_server(port))
    except KeyboardInterrupt:
        print("\nServer stopped.")
