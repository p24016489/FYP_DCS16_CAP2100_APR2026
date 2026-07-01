# AI-Based Electronics and PCB Defect Inspection and Analysis System

A full-stack web platform that combines a trainable **YOLOv8** object detection engine with a centralised **MLOps lifecycle hub**, enabling quality assurance teams to upload, train, validate, deploy, and continuously refine PCB defect detection models — without needing machine learning expertise.

Final Year Project (FYP) | DCS16 CAP2100 APR2026


## Overview

Traditional Automated Optical Inspection (AOI) systems rely on rigid, rule-based algorithms that require constant manual recalibration and struggle with model drift as production conditions change. This project bridges the gap between AI model development and practical factory-floor deployment by giving QA teams a self-service hub to manage, retrain, and hot-swap detection models without developer intervention.

The system detects **six surface-level PCB defects**:
- Spurious copper
- Open circuits
- Short circuits
- Mouse bites
- Missing holes
- Spurs

Detection works via both live image capture and batch image upload, with bounding-box visualisation, severity classification, and analytics dashboards for data-driven QA decisions.

## Key Features

- **Human-in-the-Loop active learning** – QA Engineers can correct AI-generated annotations and feed corrections back into training via a stateful compilation cursor, ensuring no annotation is lost or duplicated across dataset versions
- **Dynamic model deployment** – database-driven hot-swapping between trained YOLO model versions
- **Thread-isolated training & validation** – background training that doesn't block the API server
- **Automatic ONNX export** for cross-platform deployment
- **Three-tier role-based access control** (Superadmin / Admin / QA Engineer) secured with JWT authentication and multi-factor OTP verification
- **Batch upload processing** with defect breakdown analytics
- **Comprehensive audit logging** and system health/observability dashboards

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React |
| Backend | Django REST Framework |
| Database | PostgreSQL |
| ML / CV | PyTorch, Ultralytics (YOLOv8), OpenCV |
| Auth | JWT + OTP-based MFA |
| Model weights | PyTorch (`.pt`) |
| Model export | ONNX |

## Results

- Validated through **194 test cases** across unit, integration, system, and non-functional testing
- **100% pass rate**
- GPU inference latency averaging **280–350 ms per image**

## Project Structure

```
├── core/               # Core Django app logic
├── datasets/           # PCB defect dataset(s) used for training
├── frontend/           # React single-page application
├── media/pcb_images/   # Uploaded / captured PCB images
├── model_hub/          # Model management & deployment hub
├── runs/detect/         # YOLO training/inference run outputs
├── best.pt             # Best-performing trained model weights
├── yolov8n.pt          # YOLOv8 nano baseline weights
├── yolov8s.pt          # YOLOv8 small baseline weights
├── yolo26n.pt          # Additional YOLO model weights
├── manage.py           # Django management entry point
├── test_upload.py      # Upload pipeline test script
├── package.json         # Frontend dependencies
└── package-lock.json
```

## Getting Started

### Prerequisites

**Hardware**
- Multi-core processor (Intel i5 / AMD Ryzen 5 or higher)
- 16GB RAM (32GB recommended for model training)
- NVIDIA CUDA-enabled GPU (e.g., RTX 3060 or higher) for training
- 500GB NVMe SSD recommended

**Software**
- Python 3.x
- Node.js / npm
- PostgreSQL
- Windows 10/11 or Ubuntu (recommended for AI workloads)

### Backend Setup

```bash
python -m venv venv
source venv/bin/activate  # or venv\Scripts\activate on Windows
pip install -r requirements.txt
python manage.py migrate
python manage.py runserver
```

### Frontend Setup

```bash
cd frontend
npm install
npm start
```

## Scope & Limitations

- Limited to **surface-level optical defects** only — soldering irregularities (e.g. cold joints, missing solder) are out of scope
- No functional hardware validation, electrical testing, or internal multi-layer PCB scanning
- Focused solely on the **YOLO architecture family**; other detectors (SSD, Faster R-CNN) are not benchmarked

## License

_Add license information here._
