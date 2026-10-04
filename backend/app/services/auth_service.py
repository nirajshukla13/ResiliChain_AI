"""Authentication business logic: signup, login, refresh, password reset."""

import secrets
import uuid
from datetime import datetime, timedelta, timezone

from app.core.config import settings
from app.core.security import (
    create_access_token,
    create_refresh_token,
    decode_token,
    hash_password,
    verify_password,
)
from app.models.enums import UserRole
from app.models.user import User
from app.repositories.user_repository import UserRepository
from app.schemas.auth import SignupRequest, TokenPair
from app.utils.exceptions import (
    BadRequestError,
    ConflictError,
    UnauthorizedError,
)


class AuthService:
    """Handles the full authentication lifecycle."""

    def __init__(self, users: UserRepository) -> None:
        self.users = users

    async def _issue_tokens(self, user: User) -> TokenPair:
        """Issue an access/refresh pair, persisting the refresh jti."""
        access_token = create_access_token(str(user.id), user.role.value)
        refresh_token, jti = create_refresh_token(str(user.id))
        await self.users.update(user, refresh_token_jti=jti)
        return TokenPair(
            access_token=access_token,
            refresh_token=refresh_token,
            expires_in=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        )

    @staticmethod
    def _role_from_email(email: str) -> UserRole:
        """Determine role from the email domain."""
        domain = email.rsplit("@", 1)[-1].lower()
        domain_role_map = {
            "admin.com": UserRole.ADMIN,
            "manager.com": UserRole.SUPPLY_CHAIN_MANAGER,
            "analyst.com": UserRole.ANALYST,
        }
        return domain_role_map.get(domain, UserRole.ANALYST)

    async def signup(self, data: SignupRequest) -> tuple[User, TokenPair]:
        """Register a new user.

        Role is determined by email domain:
        - @admin.com    → Admin
        - @manager.com  → Supply Chain Manager
        - @analyst.com  → Analyst
        - other         → Analyst (default)

        The very first account always becomes admin (bootstrap).
        """
        existing = await self.users.get_by_email(data.email)
        if existing is not None:
            raise ConflictError("A user with this email already exists.")

        if await self.users.count() == 0:
            role = UserRole.ADMIN
        else:
            role = self._role_from_email(data.email)

        user = await self.users.create(
            email=data.email.lower(),
            hashed_password=hash_password(data.password),
            full_name=data.full_name,
            role=role,
        )
        tokens = await self._issue_tokens(user)
        return user, tokens

    async def login(self, email: str, password: str) -> tuple[User, TokenPair]:
        """Authenticate with email/password and issue tokens."""
        user = await self.users.get_by_email(email)
        if user is None or not verify_password(password, user.hashed_password):
            raise UnauthorizedError("Incorrect email or password.")
        if not user.is_active:
            raise UnauthorizedError("This account has been deactivated.")

        await self.users.update(user, last_login_at=datetime.now(timezone.utc))
        tokens = await self._issue_tokens(user)
        return user, tokens

    async def refresh(self, refresh_token: str) -> TokenPair:
        """Rotate a refresh token, returning a fresh token pair."""
        payload = decode_token(refresh_token, expected_type="refresh")
        user = await self.users.get(uuid.UUID(payload["sub"]))
        if user is None or not user.is_active:
            raise UnauthorizedError("User no longer exists or is inactive.")
        if user.refresh_token_jti != payload.get("jti"):
            raise UnauthorizedError("Refresh token has been revoked.")
        return await self._issue_tokens(user)

    async def logout(self, user: User) -> None:
        """Revoke the user's active refresh token."""
        await self.users.update(user, refresh_token_jti=None)

    async def forgot_password(self, email: str) -> str | None:
        """Start a password reset; returns the token when a user exists.

        A real deployment would email the token. Since no mail service is
        wired up, the API returns it directly in development mode.
        """
        user = await self.users.get_by_email(email)
        if user is None:
            return None
        token = secrets.token_urlsafe(32)
        expires = datetime.now(timezone.utc) + timedelta(
            minutes=settings.RESET_TOKEN_EXPIRE_MINUTES
        )
        await self.users.update(
            user, reset_token=token, reset_token_expires_at=expires
        )
        return token

    async def reset_password(self, token: str, new_password: str) -> User:
        """Complete a password reset using a valid, unexpired token."""
        user = await self.users.get_by_reset_token(token)
        if user is None:
            raise BadRequestError("Invalid or expired reset token.")

        expires_at = user.reset_token_expires_at
        if expires_at is not None and expires_at.tzinfo is None:
            expires_at = expires_at.replace(tzinfo=timezone.utc)
        if expires_at is None or expires_at < datetime.now(timezone.utc):
            raise BadRequestError("Invalid or expired reset token.")

        return await self.users.update(
            user,
            hashed_password=hash_password(new_password),
            reset_token=None,
            reset_token_expires_at=None,
            refresh_token_jti=None,  # force re-login everywhere
        )
