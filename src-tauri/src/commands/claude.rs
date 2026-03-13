//! Tauri commands for Claude.ai cloud STT integration.

use crate::claude_auth::{ClaudeAuthManager, ClaudeAuthState};
use crate::claude_stt::CloudSttSession;
use crate::managers::transcription::TranscriptionManager;
use crate::settings::{get_settings, write_settings};
use log::{debug, info};
use std::sync::{Arc, Mutex};
use tauri::{AppHandle, Manager};

/// Managed state for the active cloud STT session.
pub struct CloudSttSessionState(pub Mutex<Option<CloudSttSession>>);

#[tauri::command]
#[specta::specta]
pub fn get_claude_auth_state(app: AppHandle) -> Result<ClaudeAuthState, String> {
    let manager = app.state::<Arc<ClaudeAuthManager>>();
    Ok(manager.get_state())
}

#[tauri::command]
#[specta::specta]
pub fn set_claude_access_token(app: AppHandle, token: String) -> Result<(), String> {
    let manager = app.state::<Arc<ClaudeAuthManager>>();
    manager.set_access_token(token);
    Ok(())
}

#[tauri::command]
#[specta::specta]
pub fn claude_logout(app: AppHandle) -> Result<(), String> {
    if let Some(session_state) = app.try_state::<CloudSttSessionState>() {
        let mut session = session_state.0.lock().unwrap();
        if let Some(ref mut s) = *session {
            s.close();
        }
        *session = None;
    }

    let manager = app.state::<Arc<ClaudeAuthManager>>();
    manager.logout();
    Ok(())
}

#[tauri::command]
#[specta::specta]
pub fn start_cloud_stt(app: AppHandle, language: Option<String>) -> Result<(), String> {
    let auth = app.state::<Arc<ClaudeAuthManager>>();
    let token = auth
        .get_access_token()
        .ok_or_else(|| "Not logged in to Claude.ai".to_string())?;

    let origin = auth.get_origin();
    let lang = language.unwrap_or_else(|| "en".to_string());

    info!("[cloud_stt] Starting cloud STT session with language={}", lang);

    let session = CloudSttSession::start(app.clone(), token, origin, lang);

    let session_state = app.state::<CloudSttSessionState>();
    let mut current = session_state.0.lock().unwrap();
    if let Some(ref mut s) = *current {
        s.close();
    }
    *current = Some(session);

    Ok(())
}

#[tauri::command]
#[specta::specta]
pub async fn stop_cloud_stt(app: AppHandle) -> Result<String, String> {
    // Take the session out of the mutex (don't hold lock across await)
    let session_state = app.state::<CloudSttSessionState>();
    let mut session = session_state.0.lock().unwrap().take();

    let transcript = if let Some(ref mut s) = session {
        s.close_and_wait().await
    } else {
        String::new()
    };

    debug!("[cloud_stt] Session stopped, transcript: {}", transcript);
    Ok(transcript)
}

#[tauri::command]
#[specta::specta]
pub fn send_cloud_stt_audio(app: AppHandle, audio_data: Vec<u8>) -> Result<(), String> {
    let session_state = app.state::<CloudSttSessionState>();
    let current = session_state.0.lock().unwrap();

    if let Some(ref session) = *current {
        session.send_audio(audio_data);
        Ok(())
    } else {
        Err("No active cloud STT session".to_string())
    }
}

/// Internal helper called from actions.rs (not a Tauri command).
pub fn start_cloud_stt_internal(app: &AppHandle, language: Option<String>) -> Result<(), String> {
    let auth = app.state::<Arc<ClaudeAuthManager>>();
    let token = auth
        .get_access_token()
        .ok_or_else(|| "Not logged in to Claude.ai".to_string())?;

    let origin = auth.get_origin();
    let lang = language.unwrap_or_else(|| "en".to_string());

    info!(
        "[cloud_stt] Starting cloud STT session (internal) with language={}",
        lang
    );

    let session = CloudSttSession::start(app.clone(), token, origin, lang);

    let session_state = app.state::<CloudSttSessionState>();
    let mut current = session_state.0.lock().unwrap();
    if let Some(ref mut s) = *current {
        s.close();
    }
    *current = Some(session);

    Ok(())
}

/// Send f32 audio samples to the active cloud STT session, converting to 16-bit LE PCM.
pub fn send_cloud_stt_f32_samples(app: &AppHandle, samples: &[f32]) {
    use std::sync::atomic::{AtomicU64, Ordering};
    static CHUNKS_SENT: AtomicU64 = AtomicU64::new(0);

    let session_state = match app.try_state::<CloudSttSessionState>() {
        Some(s) => s,
        None => return,
    };
    let current = session_state.0.lock().unwrap();
    if let Some(ref session) = *current {
        let mut bytes = Vec::with_capacity(samples.len() * 2);
        for &sample in samples {
            let clamped = sample.clamp(-1.0, 1.0);
            let int_val = (clamped * 32767.0) as i16;
            bytes.extend_from_slice(&int_val.to_le_bytes());
        }
        let count = CHUNKS_SENT.fetch_add(1, Ordering::Relaxed);
        if count % 50 == 0 {
            debug!(
                "[cloud_stt] Audio chunk #{}: {} samples -> {} bytes, connected={}",
                count,
                samples.len(),
                bytes.len(),
                session.is_connected()
            );
        }
        session.send_audio(bytes);
    }
}

#[tauri::command]
#[specta::specta]
pub fn is_cloud_stt_connected(app: AppHandle) -> Result<bool, String> {
    let session_state = app.state::<CloudSttSessionState>();
    let current = session_state.0.lock().unwrap();

    Ok(current
        .as_ref()
        .map(|s| s.is_connected())
        .unwrap_or(false))
}

#[tauri::command]
#[specta::specta]
pub fn change_cloud_stt_enabled(app: AppHandle, enabled: bool) -> Result<(), String> {
    let mut settings = get_settings(&app);
    settings.cloud_stt_enabled = enabled;
    write_settings(&app, settings);

    if enabled {
        let tm = app.state::<Arc<TranscriptionManager>>();
        if tm.is_model_loaded() {
            let _ = tm.unload_model();
        }
    }

    Ok(())
}

#[tauri::command]
#[specta::specta]
pub fn change_cloud_stt_language(app: AppHandle, language: String) -> Result<(), String> {
    let mut settings = get_settings(&app);
    settings.cloud_stt_language = language;
    write_settings(&app, settings);
    Ok(())
}

#[tauri::command]
#[specta::specta]
pub fn import_claude_code_credentials(app: AppHandle) -> Result<(), String> {
    let manager = app.state::<Arc<ClaudeAuthManager>>();
    if manager.reload_from_claude_code() {
        Ok(())
    } else {
        Err("No Claude Code credentials found (~/.claude/.credentials.json)".to_string())
    }
}
