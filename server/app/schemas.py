from pydantic import BaseModel, EmailStr, Field


class RegisterRequest(BaseModel):
    username: str = Field(min_length=3, max_length=50)
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)


class LoginRequest(BaseModel):
    username: str
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


class UserResponse(BaseModel):
    id: str
    username: str
    email: str


class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str = Field(min_length=8, max_length=128)


class FavoritesResponse(BaseModel):
    anilist_ids: list[int]


class TranslateDescriptionRequest(BaseModel):
    anilist_id: int = Field(gt=0)
    text: str = Field(min_length=1, max_length=8000)


class TranslateDescriptionResponse(BaseModel):
    translated: str
