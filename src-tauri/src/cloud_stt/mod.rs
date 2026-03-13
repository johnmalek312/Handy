//! Cloud speech-to-text providers.
//!
//! Supports multiple cloud STT backends:
//! - **Claude**: WebSocket streaming via claude.ai voice pipeline
//! - **Codex**: HTTP POST to chatgpt.com/backend-api/transcribe (Whisper)

pub mod claude_auth;
pub mod claude_session;
pub mod codex_auth;
pub mod codex_stt;

use serde::{Deserialize, Serialize};
use specta::Type;

/// Which cloud STT backend to use.
#[derive(Serialize, Deserialize, Debug, Clone, Copy, PartialEq, Eq, Type)]
#[serde(rename_all = "snake_case")]
pub enum CloudSttProvider {
    /// Claude.ai WebSocket streaming STT (real-time interim results).
    Claude,
    /// Codex Desktop / ChatGPT Whisper endpoint (batch transcription).
    Codex,
}

impl Default for CloudSttProvider {
    fn default() -> Self {
        CloudSttProvider::Claude
    }
}

/// Events emitted to the frontend during cloud STT.
#[derive(Clone, Debug, Serialize)]
pub struct CloudTranscriptEvent {
    pub text: String,
    pub is_final: bool,
}

#[derive(Clone, Debug, Serialize)]
pub struct CloudSttStatusEvent {
    pub status: String,
    pub message: Option<String>,
}
