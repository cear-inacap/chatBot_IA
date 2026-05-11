# ============================================
# 🌐 WEBSOCKET SERVER
# ============================================

import asyncio
import websockets

connected_clients = set()
loop = None  # loop global
message_handler = None
last_message = None


async def handler(websocket):
    print("Cliente conectado")
    connected_clients.add(websocket)

    if last_message:
        await websocket.send(last_message)

    try:
        async for message in websocket:
            if message_handler:
                try:
                    message_handler(message)
                except Exception as e:
                    print("Error manejando mensaje WS:", e)
    except:
        pass
    finally:
        connected_clients.discard(websocket)
        print("Cliente desconectado")


async def broadcast(message):
    global last_message
    last_message = message

    if connected_clients:
        await asyncio.gather(
            *[client.send(message) for client in connected_clients],
            return_exceptions=True
        )


def broadcast_safe(message):
    if loop:
        asyncio.run_coroutine_threadsafe(broadcast(message), loop)


def set_message_handler(handler):
    global message_handler
    message_handler = handler


async def start_server():
    global loop
    loop = asyncio.get_running_loop()

    async with websockets.serve(handler, "0.0.0.0", 8765):
        print("WebSocket corriendo en puerto 8765")
        await asyncio.Future()  # loop infinito


def run_ws_server():
    asyncio.run(start_server())
