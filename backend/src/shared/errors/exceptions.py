"""استثناهای دامنه‌ای با کد و وضعیت HTTP — تبدیل به پاسخ یکدست در Presentation."""


class AppError(Exception):
    status_code: int = 400
    code: str = "APP_ERROR"

    def __init__(self, detail: str, code: str | None = None,
                 status_code: int | None = None):
        super().__init__(detail)
        self.detail = detail
        if code:
            self.code = code
        if status_code:
            self.status_code = status_code


class AuthError(AppError):
    status_code = 401
    code = "AUTH_INVALID"


class ForbiddenError(AppError):
    status_code = 403
    code = "FORBIDDEN"


class NotFoundError(AppError):
    status_code = 404
    code = "NOT_FOUND"


class ConflictError(AppError):
    status_code = 409
    code = "CONFLICT"


class ValidationError(AppError):
    status_code = 422
    code = "UNPROCESSABLE"
