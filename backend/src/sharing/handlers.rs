use axum::{
    extract::{Path, State},
    Json,
};
use rand::{distributions::Alphanumeric, Rng};
use serde::{Deserialize, Serialize};

use crate::{
    auth::middleware::AuthUser,
    diagrams::model::Diagram,
    error::{AppError, AppResult},
    AppState,
};

pub fn generate_share_token() -> String {
    rand::thread_rng()
        .sample_iter(Alphanumeric)
        .take(32)
        .map(char::from)
        .collect()
}

#[derive(Deserialize)]
pub struct CreateShareRequest {
    pub permission: Option<String>,
    pub expires_at: Option<String>,
}

#[derive(Serialize)]
pub struct ShareLinkResponse {
    pub token: String,
    pub url: String,
    pub permission: String,
    pub expires_at: Option<String>,
}

pub async fn create_share_link(
    auth: AuthUser,
    State(state): State<AppState>,
    Path(diagram_id): Path<String>,
    Json(body): Json<CreateShareRequest>,
) -> AppResult<Json<ShareLinkResponse>> {
    let owner: Option<String> =
        sqlx::query_scalar("SELECT owner_id FROM diagrams WHERE id = $1")
            .bind(&diagram_id)
            .fetch_optional(&state.db)
            .await
            .map_err(|e| AppError::Internal(e.into()))?;

    match owner.as_deref() {
        Some(id) if id == auth.user_id => {}
        _ => return Err(AppError::NotFound),
    }

    let permission = if body.permission.as_deref() == Some("edit") { "edit" } else { "read" };
    let token = generate_share_token();

    sqlx::query(
        "INSERT INTO share_links (token, diagram_id, permission, expires_at) VALUES ($1, $2, $3, $4)",
    )
    .bind(&token)
    .bind(&diagram_id)
    .bind(permission)
    .bind(&body.expires_at)
    .execute(&state.db)
    .await
    .map_err(|e| AppError::Internal(e.into()))?;

    let url = format!("/api/shared/{token}");
    Ok(Json(ShareLinkResponse {
        token,
        url,
        permission: permission.to_string(),
        expires_at: body.expires_at,
    }))
}

#[derive(Serialize)]
pub struct SharedDiagramResponse {
    pub diagram: Diagram,
    pub permission: String,
}

pub async fn get_shared(
    State(state): State<AppState>,
    Path(token): Path<String>,
) -> AppResult<Json<SharedDiagramResponse>> {
    let row = sqlx::query_as::<_, (String, String)>(
        "SELECT diagram_id, permission FROM share_links \
         WHERE token = $1 AND (expires_at IS NULL OR expires_at > datetime('now'))",
    )
    .bind(&token)
    .fetch_optional(&state.db)
    .await
    .map_err(|e| AppError::Internal(e.into()))?
    .ok_or(AppError::NotFound)?;

    let (diagram_id, permission) = row;

    let diagram = sqlx::query_as::<_, Diagram>(
        "SELECT id, owner_id, title, content, created_at, updated_at FROM diagrams WHERE id = $1",
    )
    .bind(&diagram_id)
    .fetch_optional(&state.db)
    .await
    .map_err(|e| AppError::Internal(e.into()))?
    .ok_or(AppError::NotFound)?;

    Ok(Json(SharedDiagramResponse { diagram, permission }))
}

#[derive(Deserialize)]
pub struct UpdateSharedRequest {
    pub content: String,
}

pub async fn update_shared(
    State(state): State<AppState>,
    Path(token): Path<String>,
    Json(body): Json<UpdateSharedRequest>,
) -> AppResult<Json<Diagram>> {
    let row = sqlx::query_as::<_, (String, String)>(
        "SELECT diagram_id, permission FROM share_links \
         WHERE token = $1 AND (expires_at IS NULL OR expires_at > datetime('now'))",
    )
    .bind(&token)
    .fetch_optional(&state.db)
    .await
    .map_err(|e| AppError::Internal(e.into()))?
    .ok_or(AppError::NotFound)?;

    let (diagram_id, permission) = row;
    if permission != "edit" {
        return Err(AppError::Unauthorized);
    }

    sqlx::query("UPDATE diagrams SET content = $1 WHERE id = $2")
        .bind(&body.content)
        .bind(&diagram_id)
        .execute(&state.db)
        .await
        .map_err(|e| AppError::Internal(e.into()))?;

    let diagram = sqlx::query_as::<_, Diagram>(
        "SELECT id, owner_id, title, content, created_at, updated_at FROM diagrams WHERE id = $1",
    )
    .bind(&diagram_id)
    .fetch_one(&state.db)
    .await
    .map_err(|e| AppError::Internal(e.into()))?;

    Ok(Json(diagram))
}
