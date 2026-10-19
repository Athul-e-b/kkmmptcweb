"""Public read and admin write access for the homepage notification bar."""
from typing import List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from database import get_db
import models, schemas, auth

router = APIRouter(prefix="/api/scrolling-notifications", tags=["scrolling-notifications"])


def _ordered(query):
    return query.order_by(
        models.ScrollingNotification.display_order.asc(),
        models.ScrollingNotification.id.asc(),
    )


def _next_order(db: Session) -> int:
    current = db.query(models.ScrollingNotification.display_order).all()
    if not current:
        return 1
    return max(row[0] or 0 for row in current) + 1


def _get_or_404(db: Session, notification_id: int) -> models.ScrollingNotification:
    row = db.query(models.ScrollingNotification).filter(
        models.ScrollingNotification.id == notification_id
    ).first()
    if not row:
        raise HTTPException(status_code=404, detail="Notification not found")
    return row


def _save(db: Session):
    try:
        db.commit()
    except SQLAlchemyError:
        db.rollback()
        raise HTTPException(status_code=500, detail="Could not save the notification")


@router.get("", response_model=List[schemas.ScrollingNotificationPublic])
def list_active(db: Session = Depends(get_db)):
    return _ordered(
        db.query(models.ScrollingNotification).filter(models.ScrollingNotification.is_active == 1)
    ).all()


@router.get("/manage", response_model=List[schemas.ScrollingNotificationOut])
def list_all(_admin: bool = Depends(auth.require_admin), db: Session = Depends(get_db)):
    return _ordered(db.query(models.ScrollingNotification)).all()


@router.post("", response_model=schemas.ScrollingNotificationOut)
def create_notification(
    payload: schemas.ScrollingNotificationCreate,
    _admin: bool = Depends(auth.require_admin),
    db: Session = Depends(get_db),
):
    row = models.ScrollingNotification(
        message=payload.message,
        link_url=payload.link_url,
        link_label=payload.link_label,
        is_active=payload.is_active,
        display_order=payload.display_order if payload.display_order is not None else _next_order(db),
    )
    db.add(row)
    _save(db)
    db.refresh(row)
    return row


@router.patch("/{notification_id}", response_model=schemas.ScrollingNotificationOut)
def update_notification(
    notification_id: int,
    payload: schemas.ScrollingNotificationUpdate,
    _admin: bool = Depends(auth.require_admin),
    db: Session = Depends(get_db),
):
    row = _get_or_404(db, notification_id)
    changes = payload.model_dump(exclude_unset=True)
    if not changes:
        raise HTTPException(status_code=400, detail="No changes were provided")
    for key, value in changes.items():
        setattr(row, key, value)
    _save(db)
    db.refresh(row)
    return row


@router.delete("/{notification_id}")
def delete_notification(
    notification_id: int,
    _admin: bool = Depends(auth.require_admin),
    db: Session = Depends(get_db),
):
    row = _get_or_404(db, notification_id)
    db.delete(row)
    _save(db)
    return {"ok": True}
