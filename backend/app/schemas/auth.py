from typing import List, Dict, Optional
from pydantic import BaseModel

class LoginRequest(BaseModel):
    identifier: str
    password: str

class LoginResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    must_change_password: bool
    owner_name: str
    email: str
    message: str

class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str
    confirm_password: str

class PasswordCheckDetail(BaseModel):
    key: str
    label: str
    passed: bool

class PasswordValidationResponse(BaseModel):
    is_valid: bool
    errors: List[str]
    checks: List[PasswordCheckDetail]

class OwnerAuthStatus(BaseModel):
    is_authenticated: bool
    must_change_password: bool
    owner_name: Optional[str] = None
    email: Optional[str] = None
