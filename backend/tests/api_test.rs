use axum::{
    body::Body,
    http::{Request, StatusCode},
};
use ba_ide_backend::{build_router, config::Config, AppState};
use serde_json::{json, Value};
use std::sync::Arc;
use tower::ServiceExt;

// ── helpers ──────────────────────────────────────────────────────────────────

async fn test_app() -> axum::Router {
    use sqlx::sqlite::{SqliteConnectOptions, SqlitePoolOptions};
    use std::str::FromStr;

    let opts = SqliteConnectOptions::from_str("sqlite://:memory:")
        .unwrap()
        .create_if_missing(true)
        .foreign_keys(true);

    let db = SqlitePoolOptions::new()
        .max_connections(1) // single connection → shared in-memory DB
        .connect_with(opts)
        .await
        .unwrap();

    sqlx::migrate!("./migrations").run(&db).await.unwrap();

    let config = Config {
        port: 0,
        database_url: "sqlite://:memory:".into(),
        jwt_secret: "test-secret-minimum-32-characters!!".into(),
        static_dir: "./".into(),
    };

    let state = AppState { db, config: Arc::new(config) };
    build_router(state)
}

async fn body_json(body: Body) -> Value {
    let bytes = axum::body::to_bytes(body, usize::MAX).await.unwrap();
    serde_json::from_slice(&bytes).unwrap_or(Value::Null)
}

fn json_body(value: Value) -> Body {
    Body::from(value.to_string())
}

async fn do_register(app: axum::Router, email: &str, password: &str) -> Value {
    let res = app
        .oneshot(
            Request::builder()
                .method("POST")
                .uri("/api/auth/register")
                .header("content-type", "application/json")
                .body(json_body(json!({"email": email, "password": password})))
                .unwrap(),
        )
        .await
        .unwrap();
    body_json(res.into_body()).await
}

// ── health ────────────────────────────────────────────────────────────────────

#[tokio::test]
async fn health_returns_ok() {
    let res = test_app()
        .await
        .oneshot(
            Request::builder()
                .uri("/api/health")
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(res.status(), StatusCode::OK);
    let body = body_json(res.into_body()).await;
    assert_eq!(body["ok"], true);
}

// ── auth: register ────────────────────────────────────────────────────────────

#[tokio::test]
async fn register_creates_user_and_returns_token() {
    let app = test_app().await;
    let body = do_register(app, "alice@example.com", "password123").await;

    assert!(body["token"].is_string(), "token missing: {body}");
    assert_eq!(body["user"]["email"], "alice@example.com");
    assert!(body["user"]["id"].is_string());
}

#[tokio::test]
async fn register_rejects_short_password() {
    let res = test_app()
        .await
        .oneshot(
            Request::builder()
                .method("POST")
                .uri("/api/auth/register")
                .header("content-type", "application/json")
                .body(json_body(json!({"email": "bob@example.com", "password": "short"})))
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(res.status(), StatusCode::BAD_REQUEST);
}

#[tokio::test]
async fn register_rejects_duplicate_email() {
    let app = test_app().await;
    do_register(app.clone(), "dup@example.com", "password123").await;

    let res = app
        .oneshot(
            Request::builder()
                .method("POST")
                .uri("/api/auth/register")
                .header("content-type", "application/json")
                .body(json_body(json!({"email": "dup@example.com", "password": "password123"})))
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(res.status(), StatusCode::BAD_REQUEST);
}

// ── auth: login ───────────────────────────────────────────────────────────────

#[tokio::test]
async fn login_returns_token_after_register() {
    let app = test_app().await;
    do_register(app.clone(), "carol@example.com", "password123").await;

    let res = app
        .oneshot(
            Request::builder()
                .method("POST")
                .uri("/api/auth/login")
                .header("content-type", "application/json")
                .body(json_body(json!({"email": "carol@example.com", "password": "password123"})))
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(res.status(), StatusCode::OK);
    let body = body_json(res.into_body()).await;
    assert!(body["token"].is_string());
}

#[tokio::test]
async fn login_rejects_wrong_password() {
    let app = test_app().await;
    do_register(app.clone(), "dave@example.com", "password123").await;

    let res = app
        .oneshot(
            Request::builder()
                .method("POST")
                .uri("/api/auth/login")
                .header("content-type", "application/json")
                .body(json_body(json!({"email": "dave@example.com", "password": "wrongpass"})))
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(res.status(), StatusCode::UNAUTHORIZED);
}

// ── auth: me ──────────────────────────────────────────────────────────────────

#[tokio::test]
async fn me_requires_auth() {
    let res = test_app()
        .await
        .oneshot(
            Request::builder()
                .uri("/api/auth/me")
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(res.status(), StatusCode::UNAUTHORIZED);
}

#[tokio::test]
async fn me_returns_authenticated_user() {
    let app = test_app().await;
    let reg = do_register(app.clone(), "eve@example.com", "password123").await;
    let token = reg["token"].as_str().unwrap();

    let res = app
        .oneshot(
            Request::builder()
                .uri("/api/auth/me")
                .header("authorization", format!("Bearer {token}"))
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(res.status(), StatusCode::OK);
    let body = body_json(res.into_body()).await;
    assert_eq!(body["email"], "eve@example.com");
}

// ── diagrams: auth guard ──────────────────────────────────────────────────────

#[tokio::test]
async fn diagrams_list_requires_auth() {
    let res = test_app()
        .await
        .oneshot(
            Request::builder()
                .uri("/api/diagrams")
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(res.status(), StatusCode::UNAUTHORIZED);
}

// ── diagrams: CRUD flow ───────────────────────────────────────────────────────

#[tokio::test]
async fn diagrams_full_crud() {
    let app = test_app().await;
    let reg = do_register(app.clone(), "frank@example.com", "password123").await;
    let token = reg["token"].as_str().unwrap().to_string();

    // create
    let create_res = app
        .clone()
        .oneshot(
            Request::builder()
                .method("POST")
                .uri("/api/diagrams")
                .header("content-type", "application/json")
                .header("authorization", format!("Bearer {token}"))
                .body(json_body(json!({"title": "My Diagram", "content": "graph TD\nA-->B"})))
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(create_res.status(), StatusCode::CREATED);
    let created = body_json(create_res.into_body()).await;
    let id = created["id"].as_str().unwrap().to_string();

    // list
    let list_res = app
        .clone()
        .oneshot(
            Request::builder()
                .uri("/api/diagrams")
                .header("authorization", format!("Bearer {token}"))
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(list_res.status(), StatusCode::OK);
    let list = body_json(list_res.into_body()).await;
    assert_eq!(list.as_array().unwrap().len(), 1);

    // get one
    let get_res = app
        .clone()
        .oneshot(
            Request::builder()
                .uri(format!("/api/diagrams/{id}"))
                .header("authorization", format!("Bearer {token}"))
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(get_res.status(), StatusCode::OK);
    let got = body_json(get_res.into_body()).await;
    assert_eq!(got["title"], "My Diagram");

    // update
    let update_res = app
        .clone()
        .oneshot(
            Request::builder()
                .method("PUT")
                .uri(format!("/api/diagrams/{id}"))
                .header("content-type", "application/json")
                .header("authorization", format!("Bearer {token}"))
                .body(json_body(json!({"title": "Updated", "content": "graph TD\nA-->B-->C"})))
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(update_res.status(), StatusCode::OK);
    let updated = body_json(update_res.into_body()).await;
    assert_eq!(updated["title"], "Updated");

    // delete
    let del_res = app
        .clone()
        .oneshot(
            Request::builder()
                .method("DELETE")
                .uri(format!("/api/diagrams/{id}"))
                .header("authorization", format!("Bearer {token}"))
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(del_res.status(), StatusCode::NO_CONTENT);

    // confirm gone
    let gone_res = app
        .oneshot(
            Request::builder()
                .uri(format!("/api/diagrams/{id}"))
                .header("authorization", format!("Bearer {token}"))
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(gone_res.status(), StatusCode::NOT_FOUND);
}

// ── sharing: response shape matches frontend api.ts ───────────────────────────

#[tokio::test]
async fn share_link_includes_url_and_token() {
    let app = test_app().await;
    let reg = do_register(app.clone(), "grace@example.com", "password123").await;
    let token = reg["token"].as_str().unwrap().to_string();

    let create_res = app
        .clone()
        .oneshot(
            Request::builder()
                .method("POST")
                .uri("/api/diagrams")
                .header("content-type", "application/json")
                .header("authorization", format!("Bearer {token}"))
                .body(json_body(json!({"title": "Shared", "content": "A"})))
                .unwrap(),
        )
        .await
        .unwrap();
    let created = body_json(create_res.into_body()).await;
    let id = created["id"].as_str().unwrap().to_string();

    let share_res = app
        .oneshot(
            Request::builder()
                .method("POST")
                .uri(format!("/api/diagrams/{id}/share"))
                .header("content-type", "application/json")
                .header("authorization", format!("Bearer {token}"))
                .body(json_body(json!({"permission": "read"})))
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(share_res.status(), StatusCode::OK);
    let body = body_json(share_res.into_body()).await;

    // Frontend api.ts ShareLinkResponse expects { token, url }
    assert!(body["token"].is_string(), "share token missing: {body}");
    assert!(body["url"].is_string(), "share url missing: {body}");
    let url = body["url"].as_str().unwrap();
    assert!(url.contains(body["token"].as_str().unwrap()), "url must embed token");
}

// ── diagrams: ownership ───────────────────────────────────────────────────────

#[tokio::test]
async fn cannot_access_other_users_diagram() {
    let app = test_app().await;

    let alice = do_register(app.clone(), "alice2@example.com", "password123").await;
    let alice_token = alice["token"].as_str().unwrap().to_string();

    let bob = do_register(app.clone(), "bob2@example.com", "password123").await;
    let bob_token = bob["token"].as_str().unwrap().to_string();

    // Alice creates a diagram
    let create_res = app
        .clone()
        .oneshot(
            Request::builder()
                .method("POST")
                .uri("/api/diagrams")
                .header("content-type", "application/json")
                .header("authorization", format!("Bearer {alice_token}"))
                .body(json_body(json!({"title": "Alice's Diagram", "content": "A"})))
                .unwrap(),
        )
        .await
        .unwrap();
    let created = body_json(create_res.into_body()).await;
    let id = created["id"].as_str().unwrap().to_string();

    // Bob tries to read it — should get 404 (ownership enforced server-side)
    let steal_res = app
        .oneshot(
            Request::builder()
                .uri(format!("/api/diagrams/{id}"))
                .header("authorization", format!("Bearer {bob_token}"))
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(steal_res.status(), StatusCode::NOT_FOUND);
}
