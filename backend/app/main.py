import os
from typing import Iterator

from fastapi import Depends, FastAPI, HTTPException, Query
from sqlalchemy import create_engine, func, select
from sqlalchemy.orm import Session, sessionmaker

from . import models, schemas

DATABASE_URL = os.getenv(
    "DATABASE_URL", "postgresql+psycopg2://refs:refspass@db:5432/refs"
)

engine = create_engine(DATABASE_URL, pool_pre_ping=True)
SessionLocal = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)

app = FastAPI(title="Refs Board API")


def get_db() -> Iterator[Session]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


# ---------- health ----------

@app.get("/api/health")
def health(db: Session = Depends(get_db)) -> dict:
    db.execute(select(func.now()))
    return {"status": "ok"}


# ---------- helpers ----------

def _project_or_404(db: Session, project_id: int) -> models.Project:
    project = db.get(models.Project, project_id)
    if project is None:
        raise HTTPException(404, "Проект не найден")
    return project


def _project_out(db: Session, p: models.Project) -> schemas.ProjectOut:
    return schemas.ProjectOut(
        id=p.id,
        name=p.name,
        description=p.description,
        references_count=db.scalar(
            select(func.count()).where(models.Reference.project_id == p.id)
        ),
        mechanics_count=db.scalar(
            select(func.count()).where(models.Mechanic.project_id == p.id)
        ),
        asset_types_count=db.scalar(
            select(func.count()).where(models.AssetType.project_id == p.id)
        ),
    )


# ---------- projects ----------

@app.get("/api/projects", response_model=list[schemas.ProjectOut])
def list_projects(db: Session = Depends(get_db)):
    projects = db.scalars(select(models.Project).order_by(models.Project.id)).all()
    return [_project_out(db, p) for p in projects]


@app.post("/api/projects", response_model=schemas.ProjectOut, status_code=201)
def create_project(body: schemas.ProjectIn, db: Session = Depends(get_db)):
    p = models.Project(**body.model_dump())
    db.add(p)
    db.commit()
    return _project_out(db, p)


@app.patch("/api/projects/{project_id}", response_model=schemas.ProjectOut)
def update_project(
    project_id: int, body: schemas.ProjectIn, db: Session = Depends(get_db)
):
    p = _project_or_404(db, project_id)
    for field, value in body.model_dump().items():
        setattr(p, field, value)
    db.commit()
    return _project_out(db, p)


@app.delete("/api/projects/{project_id}", status_code=204)
def delete_project(project_id: int, db: Session = Depends(get_db)):
    p = _project_or_404(db, project_id)
    db.delete(p)
    db.commit()


# ---------- mechanics ----------

@app.get("/api/projects/{project_id}/mechanics", response_model=list[schemas.MechanicOut])
def list_mechanics(project_id: int, db: Session = Depends(get_db)):
    _project_or_404(db, project_id)
    return db.scalars(
        select(models.Mechanic)
        .where(models.Mechanic.project_id == project_id)
        .order_by(models.Mechanic.id)
    ).all()


@app.post("/api/projects/{project_id}/mechanics", response_model=schemas.MechanicOut, status_code=201)
def create_mechanic(
    project_id: int, body: schemas.MechanicIn, db: Session = Depends(get_db)
):
    _project_or_404(db, project_id)
    m = models.Mechanic(project_id=project_id, **body.model_dump())
    db.add(m)
    db.commit()
    return m


@app.patch("/api/mechanics/{mechanic_id}", response_model=schemas.MechanicOut)
def update_mechanic(mechanic_id: int, body: schemas.MechanicIn, db: Session = Depends(get_db)):
    m = db.get(models.Mechanic, mechanic_id)
    if m is None:
        raise HTTPException(404, "Механика не найдена")
    for field, value in body.model_dump().items():
        setattr(m, field, value)
    db.commit()
    return m


@app.delete("/api/mechanics/{mechanic_id}", status_code=204)
def delete_mechanic(mechanic_id: int, db: Session = Depends(get_db)):
    m = db.get(models.Mechanic, mechanic_id)
    if m is None:
        raise HTTPException(404, "Механика не найдена")
    db.delete(m)
    db.commit()


# ---------- asset types ----------

@app.get("/api/projects/{project_id}/asset-types", response_model=list[schemas.AssetTypeOut])
def list_asset_types(project_id: int, db: Session = Depends(get_db)):
    _project_or_404(db, project_id)
    return db.scalars(
        select(models.AssetType)
        .where(models.AssetType.project_id == project_id)
        .order_by(models.AssetType.id)
    ).all()


@app.post("/api/projects/{project_id}/asset-types", response_model=schemas.AssetTypeOut, status_code=201)
def create_asset_type(
    project_id: int, body: schemas.AssetTypeIn, db: Session = Depends(get_db)
):
    _project_or_404(db, project_id)
    a = models.AssetType(project_id=project_id, **body.model_dump())
    db.add(a)
    db.commit()
    return a


@app.patch("/api/asset-types/{asset_type_id}", response_model=schemas.AssetTypeOut)
def update_asset_type(asset_type_id: int, body: schemas.AssetTypeIn, db: Session = Depends(get_db)):
    a = db.get(models.AssetType, asset_type_id)
    if a is None:
        raise HTTPException(404, "Тип ассета не найден")
    for field, value in body.model_dump().items():
        setattr(a, field, value)
    db.commit()
    return a


@app.delete("/api/asset-types/{asset_type_id}", status_code=204)
def delete_asset_type(asset_type_id: int, db: Session = Depends(get_db)):
    a = db.get(models.AssetType, asset_type_id)
    if a is None:
        raise HTTPException(404, "Тип ассета не найден")
    db.delete(a)
    db.commit()


# ---------- references ----------

@app.get("/api/projects/{project_id}/references", response_model=list[schemas.ReferenceOut])
def list_references(
    project_id: int,
    db: Session = Depends(get_db),
    category: str | None = Query(None),
    asset_type_id: int | None = Query(None),
    mechanic_id: int | None = Query(None),
):
    _project_or_404(db, project_id)
    stmt = select(models.Reference).where(models.Reference.project_id == project_id)
    if category is not None:
        stmt = stmt.where(models.Reference.category == category)
    if asset_type_id is not None:
        stmt = stmt.where(models.Reference.asset_type_id == asset_type_id)
    if mechanic_id is not None:
        stmt = stmt.where(models.Reference.mechanic_id == mechanic_id)
    return db.scalars(stmt.order_by(models.Reference.id.desc())).all()


@app.post("/api/projects/{project_id}/references", response_model=schemas.ReferenceOut, status_code=201)
def create_reference(
    project_id: int, body: schemas.ReferenceIn, db: Session = Depends(get_db)
):
    _project_or_404(db, project_id)
    r = models.Reference(project_id=project_id, **body.model_dump())
    db.add(r)
    db.commit()
    return r


@app.patch("/api/references/{reference_id}", response_model=schemas.ReferenceOut)
def update_reference(reference_id: int, body: schemas.ReferenceIn, db: Session = Depends(get_db)):
    r = db.get(models.Reference, reference_id)
    if r is None:
        raise HTTPException(404, "Референс не найден")
    for field, value in body.model_dump().items():
        setattr(r, field, value)
    db.commit()
    return r


@app.delete("/api/references/{reference_id}", status_code=204)
def delete_reference(reference_id: int, db: Session = Depends(get_db)):
    r = db.get(models.Reference, reference_id)
    if r is None:
        raise HTTPException(404, "Референс не найден")
    db.delete(r)
    db.commit()
