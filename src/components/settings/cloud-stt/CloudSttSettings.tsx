import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Cloud, LogOut, Download, Loader2, KeyRound } from "lucide-react";
import { useSettings } from "@/hooks/useSettings";
import { commands, ClaudeAuthState } from "@/bindings";

const SUPPORTED_LANGUAGES = [
  { code: "en", label: "English" },
  { code: "fr", label: "French" },
  { code: "es", label: "Spanish" },
  { code: "de", label: "German" },
  { code: "it", label: "Italian" },
  { code: "pt", label: "Portuguese" },
  { code: "ko", label: "Korean" },
  { code: "hi", label: "Hindi" },
  { code: "id", label: "Indonesian" },
  { code: "ru", label: "Russian" },
  { code: "pl", label: "Polish" },
  { code: "tr", label: "Turkish" },
  { code: "nl", label: "Dutch" },
  { code: "uk", label: "Ukrainian" },
  { code: "el", label: "Greek" },
  { code: "cs", label: "Czech" },
  { code: "da", label: "Danish" },
  { code: "sv", label: "Swedish" },
  { code: "no", label: "Norwegian" },
  { code: "ja", label: "Japanese" },
];

export function CloudSttSettings() {
  const { t } = useTranslation();
  const { settings, updateSetting } = useSettings();
  const [authState, setAuthState] = useState<ClaudeAuthState | null>(null);
  const [tokenInput, setTokenInput] = useState("");
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [showManualInput, setShowManualInput] = useState(false);
  const [importStatus, setImportStatus] = useState<string | null>(null);

  useEffect(() => {
    loadAuthState();
  }, []);

  const loadAuthState = async () => {
    const result = await commands.getClaudeAuthState();
    if (result.status === "ok") {
      setAuthState(result.data);
    }
  };

  const handleImportFromClaudeCode = async () => {
    setIsLoggingIn(true);
    setImportStatus(null);
    const result = await commands.importClaudeCodeCredentials();
    if (result.status === "ok") {
      await loadAuthState();
      setImportStatus(null);
    } else {
      setImportStatus(result.error);
    }
    setIsLoggingIn(false);
  };

  const handleManualLogin = async () => {
    if (!tokenInput.trim()) return;
    setIsLoggingIn(true);
    try {
      await commands.setClaudeAccessToken(tokenInput.trim());
      await loadAuthState();
      setTokenInput("");
      setShowManualInput(false);
    } catch (e) {
      console.error("Failed to set token:", e);
    }
    setIsLoggingIn(false);
  };

  const handleLogout = async () => {
    await commands.claudeLogout();
    await loadAuthState();
    updateSetting("cloud_stt_enabled", false);
  };

  const isLoggedIn = authState?.is_logged_in ?? false;

  return (
    <div className="w-full max-w-lg flex flex-col gap-4">
      <div className="flex items-center gap-2 mb-2">
        <Cloud className="w-5 h-5" />
        <h2 className="text-lg font-semibold">
          {t("settings.cloudStt.title", "Cloud Speech-to-Text")}
        </h2>
      </div>

      <p className="text-sm text-mid-gray">
        {t(
          "settings.cloudStt.description",
          "Use Claude.ai's cloud-based speech-to-text for streaming transcription with real-time interim results. Requires a Claude.ai account.",
        )}
      </p>

      {/* Login / Auth Section */}
      <div className="flex flex-col gap-3 p-4 rounded-lg border border-mid-gray/20">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div
              className={`w-2 h-2 rounded-full ${isLoggedIn ? "bg-green-500" : "bg-red-400"}`}
            />
            <span className="text-sm font-medium">
              {isLoggedIn
                ? t("settings.cloudStt.loggedIn", "Connected to Claude.ai")
                : t(
                    "settings.cloudStt.notLoggedIn",
                    "Not connected to Claude.ai",
                  )}
            </span>
          </div>

          {isLoggedIn && (
            <button
              onClick={handleLogout}
              className="flex items-center gap-1 px-3 py-1.5 text-sm rounded-md bg-red-500/10 hover:bg-red-500/20 text-red-400 transition-colors"
            >
              <LogOut className="w-3.5 h-3.5" />
              {t("settings.cloudStt.logout", "Disconnect")}
            </button>
          )}
        </div>

        {!isLoggedIn && (
          <div className="flex flex-col gap-2">
            {/* Import from Claude Code button */}
            <button
              onClick={handleImportFromClaudeCode}
              disabled={isLoggingIn}
              className="flex items-center justify-center gap-2 w-full px-4 py-2 text-sm rounded-md bg-logo-primary/20 hover:bg-logo-primary/30 disabled:opacity-50 transition-colors"
            >
              {isLoggingIn ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Download className="w-4 h-4" />
              )}
              {t(
                "settings.cloudStt.importFromClaudeCode",
                "Import from Claude Code",
              )}
            </button>

            {importStatus && (
              <p className="text-xs text-red-400">{importStatus}</p>
            )}

            {/* Manual token input toggle */}
            <button
              onClick={() => setShowManualInput(!showManualInput)}
              className="flex items-center gap-1 text-xs text-mid-gray hover:text-white transition-colors self-start"
            >
              <KeyRound className="w-3 h-3" />
              {t(
                "settings.cloudStt.manualToken",
                "Enter token manually",
              )}
            </button>

            {showManualInput && (
              <div className="flex flex-col gap-2">
                <p className="text-xs text-mid-gray">
                  {t(
                    "settings.cloudStt.tokenInstructions",
                    'Paste an access token (sk-ant-oat01-*) or refresh token (sk-ant-ort01-*).',
                  )}
                </p>
                <div className="flex gap-2">
                  <input
                    type="password"
                    value={tokenInput}
                    onChange={(e) => setTokenInput(e.target.value)}
                    placeholder={t(
                      "settings.cloudStt.tokenPlaceholder",
                      "Paste token here...",
                    )}
                    className="flex-1 px-3 py-1.5 text-sm rounded-md border border-mid-gray/30 bg-transparent focus:outline-none focus:border-logo-primary"
                    onKeyDown={(e) => e.key === "Enter" && handleManualLogin()}
                  />
                  <button
                    onClick={handleManualLogin}
                    disabled={isLoggingIn || !tokenInput.trim()}
                    className="px-4 py-1.5 text-sm rounded-md bg-logo-primary hover:bg-logo-primary/80 disabled:opacity-50 transition-colors"
                  >
                    {t("common.save", "Save")}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Enable Cloud STT Toggle */}
      {isLoggedIn && (
        <>
          <div className="flex items-center justify-between p-4 rounded-lg border border-mid-gray/20">
            <div className="flex flex-col gap-1">
              <span className="text-sm font-medium">
                {t(
                  "settings.cloudStt.enableToggle",
                  "Use Cloud Transcription",
                )}
              </span>
              <span className="text-xs text-mid-gray">
                {t(
                  "settings.cloudStt.enableDescription",
                  "When enabled, audio is streamed to Claude.ai for transcription instead of using local models.",
                )}
              </span>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={settings?.cloud_stt_enabled ?? false}
                onChange={(e) =>
                  updateSetting("cloud_stt_enabled", e.target.checked)
                }
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-mid-gray/30 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-logo-primary" />
            </label>
          </div>

          {/* Language Selector */}
          {settings?.cloud_stt_enabled && (
            <div className="flex items-center justify-between p-4 rounded-lg border border-mid-gray/20">
              <span className="text-sm font-medium">
                {t(
                  "settings.cloudStt.language",
                  "Transcription Language",
                )}
              </span>
              <select
                value={settings?.cloud_stt_language ?? "en"}
                onChange={(e) =>
                  updateSetting("cloud_stt_language", e.target.value)
                }
                className="px-3 py-1.5 text-sm rounded-md border border-mid-gray/30 bg-[#1a1a2e] text-white focus:outline-none focus:border-logo-primary"
              >
                {SUPPORTED_LANGUAGES.map((lang) => (
                  <option
                    key={lang.code}
                    value={lang.code}
                    className="bg-[#1a1a2e] text-white"
                  >
                    {lang.label}
                  </option>
                ))}
              </select>
            </div>
          )}
        </>
      )}
    </div>
  );
}
