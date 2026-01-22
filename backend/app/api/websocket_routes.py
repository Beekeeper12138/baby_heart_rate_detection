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
            # Receive frame (blob or bytes)
            data = await websocket.receive_bytes()
            
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

