"""
UR5e Robot Client - Receives joint commands from WebSocket and controls the robot.

Setup:
1. Connect laptop to UR5e via Ethernet
2. Run: python robot_client.py ws://SERVER_IP:8080
3. Controller connects to same server as Emitter

Requires: pip install websockets urx
"""

import asyncio
import json
import sys

try:
    import websockets
except ImportError:
    print("Install: pip install websockets")
    sys.exit(1)

try:
    import urx
    HAS_URX = True
except ImportError:
    HAS_URX = False
    print("URX not installed - running in simulation mode")
    print("For real robot control: pip install urx")


ROBOT_IP = "192.168.1.2"  # Default UR5e IP - change as needed
JOINT_SPEED = 0.1  # rad/s
JOINT_ACCELERATION = 0.5  # rad/s^2

robot = None
joint_positions = [0.0, 0.0, 0.0, 0.0, 0.0, 0.0]


def connect_to_robot():
    global robot
    if not HAS_URX:
        print(f"[SIM] Would connect to robot at {ROBOT_IP}")
        return True
    
    try:
        robot = urx.Robot(ROBOT_IP)
        print(f"Connected to UR5e at {ROBOT_IP}")
        return True
    except Exception as e:
        print(f"Failed to connect to robot: {e}")
        return False


def move_joint(joint_index, delta):
    global joint_positions
    
    joint_positions[joint_index] += delta * 0.01  # Scale delta
    
    if not HAS_URX or robot is None:
        print(f"[SIM] Joint {joint_index + 1}: {joint_positions[joint_index]:.3f} rad")
        return
    
    try:
        robot.movej(joint_positions, acc=JOINT_ACCELERATION, vel=JOINT_SPEED, wait=False)
    except Exception as e:
        print(f"Move error: {e}")


def handle_joint_update(data):
    joint_name = data.get("joint", "")
    value = data.get("value", 0)
    action = data.get("action", "")
    
    joint_map = {
        "joint1": 0, "joint2": 1, "joint3": 2,
        "joint4": 3, "joint5": 4, "joint6": 5
    }
    
    joint_index = joint_map.get(joint_name)
    if joint_index is None:
        return
    
    delta = 1 if action == "increase" else -1
    move_joint(joint_index, delta)
    print(f"Joint {joint_index + 1}: value={value}, action={action}")


async def websocket_client(server_url, channel):
    url = f"{server_url}?channel={channel}&mode=receptor"
    
    print(f"\nConnecting to {server_url}...")
    print(f"Channel: {channel}")
    print(f"Mode: RECEPTOR\n")
    
    while True:
        try:
            async with websockets.connect(url) as ws:
                print("Connected! Waiting for commands...\n")
                
                async for message in ws:
                    try:
                        data = json.loads(message)
                        if data.get("type") == "joint_update":
                            handle_joint_update(data)
                    except json.JSONDecodeError:
                        pass
                        
        except websockets.ConnectionClosed:
            print("Connection lost. Reconnecting in 3s...")
            await asyncio.sleep(3)
        except Exception as e:
            print(f"Connection error: {e}. Retrying in 3s...")
            await asyncio.sleep(3)


def cleanup():
    global robot
    if robot and HAS_URX:
        robot.close()
        print("Robot connection closed.")


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python robot_client.py ws://SERVER_IP:8080 [channel]")
        print("Example: python robot_client.py ws://192.168.1.100:8080 robot-1")
        sys.exit(1)
    
    server_url = sys.argv[1]
    channel = sys.argv[2] if len(sys.argv) > 2 else "robot-1"
    
    print("\n  UR5e Robot Client")
    print("  =================\n")
    
    if not connect_to_robot():
        print("Warning: Running without robot connection")
    
    try:
        asyncio.run(websocket_client(server_url, channel))
    except KeyboardInterrupt:
        print("\nStopping...")
    finally:
        cleanup()
