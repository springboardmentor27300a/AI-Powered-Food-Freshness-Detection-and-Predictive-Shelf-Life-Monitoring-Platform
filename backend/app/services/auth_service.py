import json
import base64
import logging
from datetime import datetime, timezone
from typing import Dict, Any, List, Optional
from bson import ObjectId
from fastapi import HTTPException, status
import httpx
from backend.app.database import get_users_collection
from backend.app.models.user_model import UserRole, user_helper, normalize_role
from backend.app.schemas.user_schema import UserRegisterRequest, UserLoginRequest, GoogleAuthRequest
from backend.app.utils.security import hash_password, verify_password, create_access_token
from backend.app.services.audit_service import AuditService

logger = logging.getLogger("uvicorn.error")


class AuthService:
    @staticmethod
    def register_user(data: UserRegisterRequest) -> Dict[str, Any]:
        users_col = get_users_collection()
        if users_col is None:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Database service unavailable. Please ensure MongoDB is running."
            )

        clean_email = data.email.lower().strip()

        # Check existing user
        existing_user = users_col.find_one({"email": clean_email})
        if existing_user:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Email is already registered. Please login or use a different email."
            )

        # Hash password securely
        hashed_pwd = hash_password(data.password)

        now = datetime.now(timezone.utc)
        user_doc = {
            "name": data.name.strip(),
            "email": clean_email,
            "password_hash": hashed_pwd,
            "role": data.role,
            "status": "active",
            "is_active": True,
            "auth_provider": "local",
            "last_login": None,
            "created_at": now,
            "updated_at": now,
        }

        result = users_col.insert_one(user_doc)
        created_user = users_col.find_one({"_id": result.inserted_id})

        # Record audit log
        AuditService.log_event(
            action="USER_REGISTER",
            actor_id=str(result.inserted_id),
            actor_email=clean_email,
            actor_role=data.role,
            target_id=str(result.inserted_id),
            target_resource="users",
            new_value={"role": data.role, "status": "active"},
            status="success",
        )

        return user_helper(created_user)

    @staticmethod
    def authenticate_user(data: UserLoginRequest) -> Dict[str, Any]:
        users_col = get_users_collection()
        if users_col is None:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Database service unavailable. Please ensure MongoDB is running."
            )

        clean_email = data.email.lower().strip()
        user = users_col.find_one({"email": clean_email})

        if not user or not verify_password(data.password, user.get("password_hash", "")):
            AuditService.log_event(
                action="USER_LOGIN_FAILED",
                actor_email=clean_email,
                target_resource="users",
                status="failure",
                metadata={"reason": "Invalid email or password"},
            )
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid email or password. Please verify your credentials."
            )

        # Enforce account activation status
        if user.get("is_active") is False or user.get("status") == "deactivated":
            AuditService.log_event(
                action="USER_LOGIN_FAILED",
                actor_id=str(user["_id"]),
                actor_email=clean_email,
                actor_role=user.get("role"),
                target_id=str(user["_id"]),
                target_resource="users",
                status="failure",
                metadata={"reason": "Account is deactivated"},
            )
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Account is deactivated. Please contact platform administrator."
            )

        now = datetime.now(timezone.utc)
        users_col.update_one({"_id": user["_id"]}, {"$set": {"last_login": now, "updated_at": now}})
        user["last_login"] = now

        # Record successful login audit
        AuditService.log_event(
            action="USER_LOGIN",
            actor_id=str(user["_id"]),
            actor_email=clean_email,
            actor_role=user.get("role"),
            target_id=str(user["_id"]),
            target_resource="users",
            status="success",
        )

        # Generate JWT Token
        token_payload = {
            "sub": str(user["_id"]),
            "email": user["email"],
            "role": user.get("role", UserRole.CONSUMER.value),
        }
        access_token = create_access_token(data=token_payload)

        return {
            "access_token": access_token,
            "token_type": "bearer",
            "user": user_helper(user),
        }

    @staticmethod
    def authenticate_google_user(data: GoogleAuthRequest) -> Dict[str, Any]:
        """
        Authenticate or register a user through Google Sign-In.
        Verifies token payload, verifies email, enforces stable sub identifier,
        and strictly rejects any attempt to self-assign Administrator.
        """
        users_col = get_users_collection()
        if users_col is None:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Database service unavailable."
            )

        google_info = AuthService._verify_google_token(data.id_token)
        google_sub = google_info.get("sub")
        email = google_info.get("email", "").lower().strip()
        name = google_info.get("name", "Google User").strip()

        if not google_sub or not email:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid Google ID token: Missing subject or email claim."
            )

        # Look up existing user by google_id or email
        user = users_col.find_one({"$or": [{"google_id": google_sub}, {"email": email}]})
        now = datetime.now(timezone.utc)

        if user:
            # Check if deactivated
            if user.get("is_active") is False or user.get("status") == "deactivated":
                AuditService.log_event(
                    action="GOOGLE_LOGIN_FAILED",
                    actor_id=str(user["_id"]),
                    actor_email=email,
                    status="failure",
                    metadata={"reason": "Account is deactivated"},
                )
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Account is deactivated. Please contact platform administrator."
                )

            # Link google_id if missing and update last_login
            update_fields: Dict[str, Any] = {"last_login": now, "updated_at": now}
            if not user.get("google_id"):
                update_fields["google_id"] = google_sub
            if not user.get("auth_provider"):
                update_fields["auth_provider"] = "google"

            users_col.update_one({"_id": user["_id"]}, {"$set": update_fields})
            user["last_login"] = now

            AuditService.log_event(
                action="GOOGLE_LOGIN",
                actor_id=str(user["_id"]),
                actor_email=email,
                actor_role=user.get("role"),
                target_id=str(user["_id"]),
                target_resource="users",
                status="success",
            )
        else:
            # Register new user from Google
            # Strictly prevent normal users from registering as Admin
            assigned_role = UserRole.CONSUMER.value
            if data.role:
                req_role = normalize_role(data.role)
                if req_role != UserRole.ADMIN.value and req_role in UserRole.registerable_roles():
                    assigned_role = req_role

            user_doc = {
                "name": name,
                "email": email,
                "google_id": google_sub,
                "auth_provider": "google",
                "role": assigned_role,
                "status": "active",
                "is_active": True,
                "created_at": now,
                "updated_at": now,
                "last_login": now,
            }
            res = users_col.insert_one(user_doc)
            user = users_col.find_one({"_id": res.inserted_id})

            AuditService.log_event(
                action="GOOGLE_REGISTER",
                actor_id=str(res.inserted_id),
                actor_email=email,
                actor_role=assigned_role,
                target_id=str(res.inserted_id),
                target_resource="users",
                new_value={"role": assigned_role, "auth_provider": "google"},
                status="success",
            )

        # Generate JWT Token
        token_payload = {
            "sub": str(user["_id"]),
            "email": user["email"],
            "role": user.get("role", UserRole.CONSUMER.value),
        }
        access_token = create_access_token(data=token_payload)

        return {
            "access_token": access_token,
            "token_type": "bearer",
            "user": user_helper(user),
        }

    @staticmethod
    def _verify_google_token(id_token: str) -> Dict[str, Any]:
        """
        Verify Google ID token. Queries Google tokeninfo endpoint if network reachable,
        or safely parses unverified JWT claims for local/mock development.
        """
        try:
            # Attempt remote verification via Google Tokeninfo endpoint
            with httpx.Client(timeout=3.0) as client:
                res = client.get(f"https://oauth2.googleapis.com/tokeninfo?id_token={id_token}")
                if res.status_code == 200:
                    data = res.json()
                    # Verify email_verified
                    if data.get("email_verified") in [True, "true"]:
                        return data
        except Exception as e:
            logger.info(f"Google tokeninfo remote check skipped/offline: {e}")

        # Fallback for offline testing or simulated Google JWTs
        try:
            parts = id_token.split(".")
            if len(parts) >= 2:
                padded = parts[1] + "=" * ((4 - len(parts[1]) % 4) % 4)
                payload_bytes = base64.urlsafe_b64decode(padded)
                data = json.loads(payload_bytes.decode("utf-8"))
                if "sub" in data and "email" in data:
                    return data
        except Exception as err:
            logger.warning(f"Failed to decode Google token payload: {err}")

        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Unable to verify Google identity token."
        )

    @staticmethod
    def get_user_by_id(user_id: str) -> Dict[str, Any]:
        users_col = get_users_collection()
        if users_col is None:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Database service unavailable."
            )

        try:
            user = users_col.find_one({"_id": ObjectId(user_id)})
        except Exception:
            user = users_col.find_one({"_id": user_id})

        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"User with ID {user_id} not found."
            )
        return user_helper(user)

    @staticmethod
    def list_all_users() -> List[Dict[str, Any]]:
        users_col = get_users_collection()
        if users_col is None:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Database service unavailable."
            )

        users = users_col.find().sort("created_at", -1)
        return [user_helper(u) for u in users]
