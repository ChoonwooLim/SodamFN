"""
Common error handling utilities for FastAPI routers.
Provides consistent error response structure across all API endpoints.
"""

from fastapi import HTTPException
from functools import wraps
import traceback


class APIResponse:
    """Standardized API response builder"""
    
    @staticmethod
    def success(data=None, message="Success"):
        return {
            "status": "success",
            "message": message,
            "data": data
        }
    
    @staticmethod
    def error(message="An error occurred", code=400):
        raise HTTPException(status_code=code, detail=message)


def handle_exceptions(func):
    """
    Decorator for consistent exception handling in route handlers.
    Catches common exceptions and returns standardized error responses.
    """
    @wraps(func)
    async def wrapper(*args, **kwargs):
        try:
            return await func(*args, **kwargs)
        except HTTPException:
            raise  # Re-raise HTTPExceptions as-is
        except ValueError as e:
            raise HTTPException(status_code=400, detail=str(e))
        except Exception as e:
            # Log the full traceback in development
            traceback.print_exc()
            raise HTTPException(
                status_code=500, 
                detail=f"Internal server error: {str(e)}"
            )
    return wrapper


def handle_sync_exceptions(func):
    """
    Same as handle_exceptions but for synchronous route handlers.
    """
    @wraps(func)
    def wrapper(*args, **kwargs):
        try:
            return func(*args, **kwargs)
        except HTTPException:
            raise
        except ValueError as e:
            raise HTTPException(status_code=400, detail=str(e))
        except Exception as e:
            traceback.print_exc()
            raise HTTPException(
                status_code=500, 
                detail=f"Internal server error: {str(e)}"
            )
    return wrapper
