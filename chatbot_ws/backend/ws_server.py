# ============================================
# 🌐 WEBSOCKET SERVER
# ============================================

import asyncio
import websockets

connected_clients = set()
loop = None  # loop global


async def handler(websocket):
    print("Cliente conectado")
    connected_clients.add(websocket)

    try:
        async for _ in websocket:
            pass
    except:
        pass
    finally:
        connected_clients.remove(websocket)
        print("Cliente desconectado")


async def broadcast(message):
    if connected_clients:
        await asyncio.gather(
            *[client.send(message) for client in connected_clients],
            return_exceptions=True
        )


def broadcast_safe(message):
    if loop:
        asyncio.run_coroutine_threadsafe(broadcast(message), loop)


async def start_server():
    global loop
    loop = asyncio.get_running_loop()

    async with websockets.serve(handler, "0.0.0.0", 8765):
        print("WebSocket corriendo en puerto 8765")
        await asyncio.Future()  # loop infinito


def run_ws_server():
    asyncio.run(start_server())