"""Reusable pagination query parameters."""

from typing import Annotated

from fastapi import Depends, Query


class PaginationParams:
    """Standard `page` / `size` query parameters for list endpoints."""

    def __init__(
        self,
        page: int = Query(1, ge=1, description="Page number (1-based)"),
        size: int = Query(20, ge=1, le=100, description="Items per page"),
    ) -> None:
        self.page = page if isinstance(page, int) else getattr(page, "default", 1)
        self.size = size if isinstance(size, int) else getattr(size, "default", 20)

    @property
    def offset(self) -> int:
        return (self.page - 1) * self.size


Pagination = Annotated[PaginationParams, Depends()]
