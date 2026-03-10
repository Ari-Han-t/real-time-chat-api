from collections import defaultdict

from fastapi import WebSocket


class ChatConnectionManager:
    def __init__(self) -> None:
        self.chat_connections: dict[int, set[WebSocket]] = defaultdict(set)

    async def connect(self, chat_id: int, websocket: WebSocket) -> None:
        await websocket.accept()
        self.chat_connections[chat_id].add(websocket)

    def disconnect(self, chat_id: int, websocket: WebSocket) -> None:
        if chat_id in self.chat_connections and websocket in self.chat_connections[chat_id]:
            self.chat_connections[chat_id].remove(websocket)
            if not self.chat_connections[chat_id]:
                del self.chat_connections[chat_id]

    async def broadcast(self, chat_id: int, payload: dict) -> None:
        to_remove: list[WebSocket] = []
        for websocket in self.chat_connections.get(chat_id, set()):
            try:
                await websocket.send_json(payload)
            except Exception:
                to_remove.append(websocket)

        for websocket in to_remove:
            self.disconnect(chat_id, websocket)


manager = ChatConnectionManager()

