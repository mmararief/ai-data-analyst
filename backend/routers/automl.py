import uuid

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from backend.core.automl import AutoMLError, get_model_metadata, list_model_metadata, predict_with_model
from backend.core.job_store import create_job, enqueue_job, get_events_from, get_status
from backend.core.minio_store import sandbox_context
from backend.core.security import get_current_user
from backend.models.user import UserInDB

router = APIRouter(prefix="/automl", tags=["automl"])


class TrainRequest(BaseModel):
    dataset_name: str
    target_column: str
    project_id: str
    problem_type: str = Field(default="auto")
    model_name: str | None = None
    test_size: float = Field(default=0.2, ge=0.1, le=0.4)
    random_state: int = 42


class PredictRequest(BaseModel):
    artifact_name: str
    dataset_name: str
    project_id: str
    output_name: str | None = None


@router.post("/train")
def train_model(req: TrainRequest, user: UserInDB = Depends(get_current_user)):
    """Enqueue AutoML training job ke worker (non-blocking)."""
    job_id = uuid.uuid4().hex
    create_job(user.user_id, job_id)
    enqueue_job({
        "type": "automl_train",
        "job_id": job_id,
        "user_id": user.user_id,
        "project_id": req.project_id,
        "dataset_name": req.dataset_name,
        "target_column": req.target_column,
        "problem_type": req.problem_type,
        "model_name": req.model_name,
        "test_size": req.test_size,
        "random_state": req.random_state,
    })
    return {"job_id": job_id, "status": "queued"}


@router.get("/train/{job_id}/status")
def get_train_status(job_id: str, user: UserInDB = Depends(get_current_user)):
    """Poll status dan result dari AutoML training job."""
    status = get_status(user.user_id, job_id)
    if status is None:
        raise HTTPException(status_code=404, detail="Job tidak ditemukan atau sudah expired")

    events = get_events_from(user.user_id, job_id)
    result = None
    error = None
    for ev in events:
        if ev.get("type") == "automl_result":
            result = ev.get("content")
        elif ev.get("type") == "error":
            error = ev.get("content")

    return {
        "job_id": job_id,
        "status": status,
        "result": result,
        "error": error,
    }


@router.get("/models")
def list_models(project_id: str, user: UserInDB = Depends(get_current_user)):
    try:
        with sandbox_context(user.user_id, project_id=project_id) as data_folder:
            items = list_model_metadata(data_folder)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Gagal membaca daftar model: {str(exc)}") from exc
    return {"models": items}


@router.get("/models/{artifact_name}")
def get_model(artifact_name: str, project_id: str, user: UserInDB = Depends(get_current_user)):
    try:
        with sandbox_context(user.user_id, project_id=project_id) as data_folder:
            payload = get_model_metadata(data_folder, artifact_name)
    except AutoMLError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Gagal membaca metadata model: {str(exc)}") from exc
    return payload


@router.post("/predict")
def predict_model(req: PredictRequest, user: UserInDB = Depends(get_current_user)):
    try:
        with sandbox_context(user.user_id, project_id=req.project_id) as data_folder:
            artifacts = predict_with_model(
                data_folder=data_folder,
                artifact_name=req.artifact_name,
                dataset_name=req.dataset_name,
                output_name=req.output_name,
            )
    except AutoMLError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Gagal menjalankan prediksi: {str(exc)}") from exc

    return {
        "message": "Prediksi berhasil dijalankan",
        **artifacts.metadata,
    }