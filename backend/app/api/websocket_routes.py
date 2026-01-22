from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from ..services.rppg import RPPGService
import json
import asyncio
from concurrent.futures import ThreadPoolExecutor

router = APIRouter()

# Create a global executor for CPU-bound tasks
executor = ThreadPoolExecutor(max_workers=2)

@router.websocket("/ws/video")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    rppg_service = RPPGService()
    loop = asyncio.get_event_loop()
    
    try:
        while True:
            msg = await websocket.receive()

            if msg.get("type") == "websocket.receive" and msg.get("text"):
                try:
                    payload = json.loads(msg["text"])
                    if isinstance(payload, dict) and payload.get("type") == "config":
                        rppg_service.configure(
                            sensitivity=payload.get("rPPGSensitivity"),
                            motion_rejection=payload.get("motionRejection"),
                        )
                except Exception:
                    pass
                continue

            data = msg.get("bytes")
            if not data:
                continue
            
            # Process in thread pool to avoid blocking the event loop
            result = await loop.run_in_executor(executor, rppg_service.process_frame, data)
            
            if result:
                # Send back result
                await websocket.send_text(json.dumps(result))
                
    except WebSocketDisconnect:
        print("Client disconnected")
    except Exception as e:
        print(f"Error: {e}")
        try:
            await websocket.close()
        except:
            pass
