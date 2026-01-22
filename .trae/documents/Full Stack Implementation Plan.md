Based on the analysis, the current frontend is running entirely on **mock data** (simulated random numbers) and does not have any network logic to connect to a backend. To fulfill your request for "Backend Development" and "Frontend-Backend Docking", I need to not only build the backend but also **refactor the frontend** to replace the mock logic with real API and WebSocket communication.

### Phase 1: Backend Development (Python/FastAPI)
I will build a standard FastAPI backend structure in a new `backend/` directory:
1.  **Core Framework**: FastAPI + Uvicorn.
2.  **Database**: SQLite (file-based, zero-config) + SQLAlchemy for `User` and `History` data persistence.
3.  **Authentication**: JWT (JSON Web Tokens) for secure login/API access.
4.  **Real-time Processing (rPPG)**:
    *   **WebSocket Endpoint**: `/ws/rppg` to receive video frames from the frontend.
    *   **Signal Processing**: Implement a standard rPPG algorithm (Green Channel Mean -> Bandpass Filter -> FFT) using `numpy` and `scipy`.
    *   *Note*: I will implement a robust algorithmic baseline. The "Deep Learning Skin Segmentation" mentioned in the guide requires large pre-trained model files (UNet11), which I cannot generate. I will structure the code to allow easy insertion of the model later, but use standard computer vision (OpenCV face detection) for the immediate deliverable to ensure it runs out-of-the-box.
5.  **API Endpoints**:
    *   `POST /api/auth/login`: Get access token.
    *   `GET /api/history`: Fetch historical monitoring records.
    *   `POST /api/history`: Save a new session record.

### Phase 2: Frontend Refactoring (Docking)
I will modify the `frontend/` code to connect to the new backend:
1.  **API Client**: Create `frontend/services/api.ts` using `fetch` to communicate with REST APIs.
2.  **WebSocket Integration**:
    *   Modify `Dashboard.tsx` to capture frames from the webcam `<video>` element via Canvas.
    *   Send frames to the backend WebSocket.
    *   Receive real-time Heart Rate (BPM) and Signal Quality updates to render the chart.
3.  **Data Persistence**: Update `History.tsx` to fetch real data from the backend instead of using `MOCK_RECORDS`.

### Phase 3: Testing & Delivery
1.  **Unit Tests**: Basic tests for API endpoints (`tests/test_api.py`).
2.  **Run Scripts**: Provide `start_backend.sh/bat` and updated `README.md`.

This plan transforms the current "static prototype" into a fully functional "client-server system".