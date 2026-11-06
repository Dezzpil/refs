from pydantic import BaseModel, Field, field_validator

CATEGORIES = ("decor", "model", "mechanic")

CATEGORY_TITLES = {
    "decor": "Для декорации",
    "model": "Для моделей",
    "mechanic": "Для механики",
}


class ProjectIn(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    description: str = ""


class ProjectOut(ProjectIn):
    id: int
    references_count: int = 0
    mechanics_count: int = 0
    asset_types_count: int = 0


class MechanicIn(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    description: str = ""


class MechanicOut(MechanicIn):
    id: int
    project_id: int


class AssetTypeIn(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    description: str = ""


class AssetTypeOut(AssetTypeIn):
    id: int
    project_id: int


class ReferenceIn(BaseModel):
    title: str = Field(min_length=1, max_length=300)
    description: str = ""
    category: str
    asset_type_id: int | None = None
    mechanic_id: int | None = None
    image_url: str = ""

    @field_validator("category")
    @classmethod
    def check_category(cls, v: str) -> str:
        if v not in CATEGORIES:
            raise ValueError(f"category must be one of {CATEGORIES}")
        return v


class ReferenceOut(ReferenceIn):
    id: int
    project_id: int
