use argon2::{
    password_hash::{rand_core::OsRng, PasswordHash, PasswordHasher, PasswordVerifier, SaltString},
    Argon2,
};
use axum::{extract::State, Json};
use serde::{Deserialize, Serialize};

use crate::{
    auth::{jwt, middleware::AuthUser},
    error::{AppError, AppResult},
    new_id, AppState,
};

#[derive(Deserialize)]
pub struct AuthRequest {
    email: String,
    password: String,
}

#[derive(Serialize)]
pub struct UserInfo {
    id: String,
    email: String,
}

#[derive(Serialize)]
pub struct AuthResponse {
    token: String,
    user: UserInfo,
}

pub async fn register(
    State(state): State<AppState>,
    Json(body): Json<AuthRequest>,
) -> AppResult<Json<AuthResponse>> {
    let email = body.email.trim().to_lowercase();
    if email.is_empty() || !email.contains('@') {
        return Err(AppError::BadRequest("invalid email".into()));
    }
    if body.password.len() < 8 {
        return Err(AppError::BadRequest(
            "password must be at least 8 characters".into(),
        ));
    }

    let salt = SaltString::generate(&mut OsRng);
    let hash = Argon2::default()
        .hash_password(body.password.as_bytes(), &salt)
        .map_err(|e| AppError::Internal(anyhow::anyhow!("{e}")))?
        .to_string();

    let user_id = new_id();

    sqlx::query("INSERT INTO users (id, email, password_hash) VALUES ($1, $2, $3)")
        .bind(&user_id)
        .bind(&email)
        .bind(&hash)
        .execute(&state.db)
        .await
        .map_err(|e| {
            if e.to_string().contains("UNIQUE") {
                AppError::BadRequest("email already registered".into())
            } else {
                AppError::Internal(e.into())
            }
        })?;

    let token = jwt::issue(&user_id, &state.config.jwt_secret).map_err(AppError::Internal)?;
    Ok(Json(AuthResponse {
        token,
        user: UserInfo { id: user_id, email },
    }))
}

pub async fn login(
    State(state): State<AppState>,
    Json(body): Json<AuthRequest>,
) -> AppResult<Json<AuthResponse>> {
    let email = body.email.trim().to_lowercase();

    let row = sqlx::query_as::<_, (String, String, String)>(
        "SELECT id, email, password_hash FROM users WHERE email = $1",
    )
    .bind(&email)
    .fetch_optional(&state.db)
    .await
    .map_err(|e| AppError::Internal(e.into()))?
    .ok_or(AppError::Unauthorized)?;

    let (user_id, stored_email, hash) = row;

    let parsed =
        PasswordHash::new(&hash).map_err(|e| AppError::Internal(anyhow::anyhow!("{e}")))?;
    Argon2::default()
        .verify_password(body.password.as_bytes(), &parsed)
        .map_err(|_| AppError::Unauthorized)?;

    let token = jwt::issue(&user_id, &state.config.jwt_secret).map_err(AppError::Internal)?;
    Ok(Json(AuthResponse {
        token,
        user: UserInfo { id: user_id, email: stored_email },
    }))
}

pub async fn me(
    auth: AuthUser,
    State(state): State<AppState>,
) -> AppResult<Json<serde_json::Value>> {
    let row = sqlx::query_as::<_, (String, String)>(
        "SELECT id, email FROM users WHERE id = $1",
    )
    .bind(&auth.user_id)
    .fetch_optional(&state.db)
    .await
    .map_err(|e| AppError::Internal(e.into()))?
    .ok_or(AppError::NotFound)?;

    Ok(Json(serde_json::json!({ "id": row.0, "email": row.1 })))
}
