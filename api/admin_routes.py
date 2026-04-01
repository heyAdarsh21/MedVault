from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from database.base import get_db
from database.models import Hospital

router = APIRouter(prefix="/api/v1/admin", tags=["Admin Utilities"])


@router.patch("/hospitals/{hospital_id}/rename")
def rename_hospital(
    hospital_id: int,
    new_name: str,
    db: Session = Depends(get_db),
):
    hospital = db.query(Hospital).filter(Hospital.id == hospital_id).first()

    if not hospital:
        raise HTTPException(status_code=404, detail="Hospital not found")

    old_name = hospital.name
    hospital.name = new_name
    db.commit()

    return {
        "status": "success",
        "hospital_id": hospital_id,
        "old_name": old_name,
        "new_name": new_name,
    }
