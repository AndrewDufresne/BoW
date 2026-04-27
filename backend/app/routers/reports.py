from fastapi import APIRouter

router = APIRouter(prefix="/reports", tags=["reports"])


@router.get("/ping")
def ping():
    return {"status": "todo", "message": "Reports module is reserved for the next iteration."}
