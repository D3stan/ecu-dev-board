import os
from aiohttp import web

EXTERNAL_DASHBOARD_PATH = r"../data/dashboard.html"

# This set will hold all active connections (simulator and dashboard)
active_websockets = set()

async def websocket_handler(request):
    ws = web.WebSocketResponse()
    await ws.prepare(request)

    # Register connection
    active_websockets.add(ws)
    print("Device connected")

    try:
        # Listen for messages
        async for msg in ws:
            if msg.type == web.WSMsgType.TEXT:
                # Relay the message to all OTHER connected clients
                for client in active_websockets:
                    if client is not ws and not client.closed:
                        await client.send_str(msg.data)
            elif msg.type == web.WSMsgType.ERROR:
                print(f'ws connection closed with exception {ws.exception()}')

    finally:
        # Cleanup on disconnect
        active_websockets.discard(ws)
        print("Device disconnected")

    return ws

async def external_dashboard_handler(request):
    return web.FileResponse(EXTERNAL_DASHBOARD_PATH)

# Application Setup
app = web.Application()

# 1. Route for WebSocket connection (must match the JS path '/ws')
app.router.add_get('/ws', websocket_handler)

# This forces the server to look at the external path when '/dashboard.html' is requested
app.router.add_get('/dashboard.html', external_dashboard_handler)

# 2. Route for Static files (serves current directory)
# This allows you to load your .html files via http://localhost:8000/filename.html
app.router.add_static('/', path=os.getcwd())

if __name__ == '__main__':
    print("Starting server at http://localhost:8000")
    web.run_app(app, host='localhost', port=80)