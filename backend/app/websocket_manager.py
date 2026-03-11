from collections import defaultdict

from fastapi import WebSocket


class ChatConnectionManager:
    def __init__(self) -> None:
        self.chat_connections: dict[int, dict[WebSocket, int]] = defaultdict(dict)

    async def connect(self, chat_id: int, websocket: WebSocket, user_id: int) -> None:
        await websocket.accept()
        self.chat_connections[chat_id][websocket] = user_id

    def disconnect(self, chat_id: int, websocket: WebSocket) -> None:
        if chat_id in self.chat_connections and websocket in self.chat_connections[chat_id]:
            del self.chat_connections[chat_id][websocket]
            if not self.chat_connections[chat_id]:
                del self.chat_connections[chat_id]

    async def broadcast(self, chat_id: int, payload: dict, exclude_user_id: int | None = None) -> None:
        to_remove: list[WebSocket] = []
        for websocket, ws_user_id in self.chat_connections.get(chat_id, {}).items():
            if exclude_user_id is not None and ws_user_id == exclude_user_id:
                continue
            try:
                await websocket.send_json(payload)
            except Exception:
                to_remove.append(websocket)

        for websocket in to_remove:
            self.disconnect(chat_id, websocket)


manager = ChatConnectionManager()
