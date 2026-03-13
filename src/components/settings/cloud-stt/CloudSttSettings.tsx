import { useState, useEffect, useRef, useMemo } from "react";
import { useTranslation } from "react-i18next";
import {
  Cloud,
  LogOut,
  Download,
  Loader2,
  KeyRound,
  ChevronDown,
  Globe,
} from "lucide-react";
import { useSettings } from "@/hooks/useSettings";
import { SettingsGroup } from "@/components/ui/SettingsGroup";
import { ToggleSwitch } from "@/components/ui/ToggleSwitch";
import { commands, ClaudeAuthState, CodexAuthState } from "@/bindings";
import { LANGUAGES } from "@/lib/constants/languages";

type CloudProvider = "claude" | "codex";

const PROVIDERS: { id: CloudProvider; label: string; description: string }[] = [
  {
    id: "claude",
    label: "Claude.ai",
    description:
      "settings.cloudStt.providers.claude.description",
  },
  {
    id: "codex",
    label: "Codex (ChatGPT Whisper)",
    description:
      "settings.cloudStt.providers.codex.description",
  },
];

export function CloudSttSettings() {
  const { t } = useTranslation();
  const { settings, updateSetting } = useSettings();

  // Claude auth
  const [claudeAuth, setClaudeAuth] = useState<ClaudeAuthState | null>(null);
  const [claudeTokenInput, setClaudeTokenInput] = useState("");
  const [claudeLoading, setClaudeLoading] = useState(false);
  const [claudeShowManual, setClaudeShowManual] = useState(false);
  const [claudeImportError, setClaudeImportError] = useState<string | null>(
    null,
  );

  // Codex auth
  const [codexAuth, setCodexAuth] = useState<CodexAuthState | null>(null);
  const [codexLoading, setCodexLoading] = useState(false);
  const [codexImportError, setCodexImportError] = useState<string | null>(null);

  // Language dropdown
  const [langDropdownOpen, setLangDropdownOpen] = useState(false);
  const [langSearch, setLangSearch] = useState("");
  const langDropdownRef = useRef<HTMLDivElement>(null);
  const langSearchRef = useRef<HTMLInputElement>(null);

  const cloudEnabled = settings?.cloud_stt_enabled ?? false;
  const selectedProvider =
    (settings?.cloud_stt_provider as CloudProvider) ?? "claude";
  const selectedLanguage = settings?.cloud_stt_language ?? "en";

  useEffect(() => {
    loadAuthStates();
  }, []);

  // Click outside handler for language dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        langDropdownRef.current &&
        !langDropdownRef.current.contains(event.target as Node)
      ) {
        setLangDropdownOpen(false);
        setLangSearch("");
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    if (langDropdownOpen && langSearchRef.current) {
      langSearchRef.current.focus();
    }
  }, [langDropdownOpen]);

  const filteredLanguages = useMemo(() => {
    return LANGUAGES.filter(
      (lang) =>
        lang.value !== "auto" &&
        lang.label.toLowerCase().includes(langSearch.toLowerCase()),
    );
  }, [langSearch]);

  const selectedLanguageLabel = useMemo(() => {
    if (selectedLanguage === "auto") return "Auto Detect";
    return (
      LANGUAGES.find((l) => l.value === selectedLanguage)?.label ??
      selectedLanguage
    );
  }, [selectedLanguage]);

  const loadAuthStates = async () => {
    const claude = await commands.getClaudeAuthState();
    if (claude.status === "ok") setClaudeAuth(claude.data);
    const codex = await commands.getCodexAuthState();
    if (codex.status === "ok") setCodexAuth(codex.data);
  };

  // Claude auth handlers
  const handleClaudeImport = async () => {
    setClaudeLoading(true);
    setClaudeImportError(null);
    const result = await commands.importClaudeCodeCredentials();
    if (result.status === "ok") {
      await loadAuthStates();
    } else {
      setClaudeImportError(result.error);
    }
    setClaudeLoading(false);
  };

  const handleClaudeManualLogin = async () => {
    if (!claudeTokenInput.trim()) return;
    setClaudeLoading(true);
    try {
      await commands.setClaudeAccessToken(claudeTokenInput.trim());
      await loadAuthStates();
      setClaudeTokenInput("");
      setClaudeShowManual(false);
    } catch (e) {
      console.error("Failed to set Claude token:", e);
    }
    setClaudeLoading(false);
  };

  const handleClaudeLogout = async () => {
    await commands.claudeLogout();
    await loadAuthStates();
    if (selectedProvider === "claude") {
      updateSetting("cloud_stt_enabled", false);
    }
  };

  // Codex auth handlers
  const handleCodexImport = async () => {
    setCodexLoading(true);
    setCodexImportError(null);
    const result = await commands.importCodexCredentials();
    if (result.status === "ok") {
      await loadAuthStates();
    } else {
      setCodexImportError(result.error);
    }
    setCodexLoading(false);
  };

  const handleCodexLogout = async () => {
    await commands.codexLogout();
    await loadAuthStates();
    if (selectedProvider === "codex") {
      updateSetting("cloud_stt_enabled", false);
    }
  };

  const isProviderLoggedIn = (provider: CloudProvider) => {
    if (provider === "claude") return claudeAuth?.is_logged_in ?? false;
    if (provider === "codex") return codexAuth?.is_logged_in ?? false;
    return false;
  };

  const canEnableCloud = isProviderLoggedIn(selectedProvider);

  return (
    <div className="max-w-3xl w-full mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl font-semibold mb-2">
          {t("settings.cloudStt.title", "Cloud Speech-to-Text")}
        </h1>
        <p className="text-sm text-text/60">
          {t(
            "settings.cloudStt.description",
            "Use cloud-based speech-to-text instead of local models. Requires authentication with the selected provider.",
          )}
        </p>
      </div>

      {/* Enable Toggle */}
      <SettingsGroup>
        <ToggleSwitch
          checked={cloudEnabled}
          onChange={(enabled) => {
            if (enabled && !canEnableCloud) return;
            updateSetting("cloud_stt_enabled", enabled);
          }}
          disabled={!canEnableCloud}
          label={t("settings.cloudStt.enableToggle", "Use Cloud Transcription")}
          description={t(
            "settings.cloudStt.enableDescription",
            "When enabled, audio is sent to the selected cloud provider for transcription instead of using local models.",
          )}
          descriptionMode="tooltip"
          grouped={true}
        />
      </SettingsGroup>

      {/* Provider Selector */}
      <SettingsGroup
        title={t("settings.cloudStt.provider", "Provider")}
      >
        <div className="p-3">
          <div className="grid grid-cols-2 gap-2">
            {PROVIDERS.map((provider) => {
              const isSelected = selectedProvider === provider.id;
              const isLoggedIn = isProviderLoggedIn(provider.id);
              return (
                <button
                  key={provider.id}
                  onClick={() =>
                    updateSetting("cloud_stt_provider", provider.id)
                  }
                  className={`relative flex flex-col items-start p-3 rounded-lg border transition-colors text-left ${
                    isSelected
                      ? "border-logo-primary bg-logo-primary/10"
                      : "border-mid-gray/20 hover:border-mid-gray/40"
                  }`}
                >
                  <div className="flex items-center gap-2 w-full">
                    <span className="text-sm font-medium">{provider.label}</span>
                    {isLoggedIn && (
                      <div className="w-2 h-2 rounded-full bg-green-500 ml-auto" />
                    )}
                  </div>
                  <p className="text-xs text-text/50 mt-1">
                    {t(
                      provider.description,
                      provider.id === "claude"
                        ? "Streaming via Claude.ai voice pipeline"
                        : "Batch via ChatGPT Whisper endpoint",
                    )}
                  </p>
                </button>
              );
            })}
          </div>
        </div>
      </SettingsGroup>

      {/* Auth Section — Claude */}
      {selectedProvider === "claude" && (
        <SettingsGroup
          title={t("settings.cloudStt.auth", "Authentication")}
        >
          <div className="p-3">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div
                  className={`w-2 h-2 rounded-full ${
                    claudeAuth?.is_logged_in ? "bg-green-500" : "bg-red-400"
                  }`}
                />
                <span className="text-sm font-medium">
                  {claudeAuth?.is_logged_in
                    ? t("settings.cloudStt.loggedIn", "Connected to Claude.ai")
                    : t(
                        "settings.cloudStt.notLoggedIn",
                        "Not connected to Claude.ai",
                      )}
                </span>
              </div>
              {claudeAuth?.is_logged_in && (
                <button
                  onClick={handleClaudeLogout}
                  className="flex items-center gap-1 px-3 py-1.5 text-xs rounded-md bg-red-500/10 hover:bg-red-500/20 text-red-400 transition-colors"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  {t("settings.cloudStt.logout", "Disconnect")}
                </button>
              )}
            </div>

            {!claudeAuth?.is_logged_in && (
              <div className="flex flex-col gap-2">
                <button
                  onClick={handleClaudeImport}
                  disabled={claudeLoading}
                  className="flex items-center justify-center gap-2 w-full px-4 py-2 text-sm rounded-md bg-logo-primary/20 hover:bg-logo-primary/30 disabled:opacity-50 transition-colors"
                >
                  {claudeLoading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Download className="w-4 h-4" />
                  )}
                  {t(
                    "settings.cloudStt.importFromClaudeCode",
                    "Import from Claude Code",
                  )}
                </button>

                {claudeImportError && (
                  <p className="text-xs text-red-400">{claudeImportError}</p>
                )}

                <button
                  onClick={() => setClaudeShowManual(!claudeShowManual)}
                  className="flex items-center gap-1 text-xs text-mid-gray hover:text-white transition-colors self-start"
                >
                  <KeyRound className="w-3 h-3" />
                  {t(
                    "settings.cloudStt.manualToken",
                    "Enter token manually",
                  )}
                </button>

                {claudeShowManual && (
                  <div className="flex flex-col gap-2">
                    <p className="text-xs text-mid-gray">
                      {t(
                        "settings.cloudStt.tokenInstructions",
                        "Paste an access token (sk-ant-oat01-*) or refresh token (sk-ant-ort01-*).",
                      )}
                    </p>
                    <div className="flex gap-2">
                      <input
                        type="password"
                        value={claudeTokenInput}
                        onChange={(e) => setClaudeTokenInput(e.target.value)}
                        placeholder={t(
                          "settings.cloudStt.tokenPlaceholder",
                          "Paste token here...",
                        )}
                        className="flex-1 px-3 py-1.5 text-sm rounded-md border border-mid-gray/30 bg-transparent focus:outline-none focus:border-logo-primary"
                        onKeyDown={(e) =>
                          e.key === "Enter" && handleClaudeManualLogin()
                        }
                      />
                      <button
                        onClick={handleClaudeManualLogin}
                        disabled={claudeLoading || !claudeTokenInput.trim()}
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
        </SettingsGroup>
      )}

      {/* Auth Section — Codex */}
      {selectedProvider === "codex" && (
        <SettingsGroup
          title={t("settings.cloudStt.auth", "Authentication")}
        >
          <div className="p-3">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div
                  className={`w-2 h-2 rounded-full ${
                    codexAuth?.is_logged_in ? "bg-green-500" : "bg-red-400"
                  }`}
                />
                <span className="text-sm font-medium">
                  {codexAuth?.is_logged_in
                    ? t(
                        "settings.cloudStt.codexLoggedIn",
                        "Connected to Codex",
                      )
                    : t(
                        "settings.cloudStt.codexNotLoggedIn",
                        "Not connected to Codex",
                      )}
                </span>
              </div>
              {codexAuth?.is_logged_in && (
                <button
                  onClick={handleCodexLogout}
                  className="flex items-center gap-1 px-3 py-1.5 text-xs rounded-md bg-red-500/10 hover:bg-red-500/20 text-red-400 transition-colors"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  {t("settings.cloudStt.logout", "Disconnect")}
                </button>
              )}
            </div>

            {!codexAuth?.is_logged_in && (
              <div className="flex flex-col gap-2">
                <button
                  onClick={handleCodexImport}
                  disabled={codexLoading}
                  className="flex items-center justify-center gap-2 w-full px-4 py-2 text-sm rounded-md bg-logo-primary/20 hover:bg-logo-primary/30 disabled:opacity-50 transition-colors"
                >
                  {codexLoading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Download className="w-4 h-4" />
                  )}
                  {t(
                    "settings.cloudStt.importFromCodex",
                    "Import from ~/.codex/auth.json",
                  )}
                </button>

                {codexImportError && (
                  <p className="text-xs text-red-400">{codexImportError}</p>
                )}

                <p className="text-xs text-mid-gray">
                  {t(
                    "settings.cloudStt.codexInstructions",
                    "Codex Desktop stores credentials in ~/.codex/auth.json. Log in via Codex Desktop first, then import.",
                  )}
                </p>
              </div>
            )}
          </div>
        </SettingsGroup>
      )}

      {/* Language Selector */}
      {cloudEnabled && (
        <SettingsGroup
          title={t("settings.cloudStt.transcriptionSettings", "Transcription")}
        >
          <div className="flex items-center justify-between px-4 p-2">
            <span className="text-sm font-medium">
              {t("settings.cloudStt.language", "Language")}
            </span>
            <div className="relative" ref={langDropdownRef}>
              <button
                type="button"
                onClick={() => setLangDropdownOpen(!langDropdownOpen)}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${
                  selectedLanguage !== "auto"
                    ? "bg-logo-primary/20 text-logo-primary"
                    : "bg-mid-gray/10 text-text/60 hover:bg-mid-gray/20"
                }`}
              >
                <Globe className="w-3.5 h-3.5" />
                <span className="max-w-[120px] truncate">
                  {selectedLanguageLabel}
                </span>
                <ChevronDown
                  className={`w-3.5 h-3.5 transition-transform ${
                    langDropdownOpen ? "rotate-180" : ""
                  }`}
                />
              </button>

              {langDropdownOpen && (
                <div className="absolute top-full right-0 mt-1 w-56 bg-background border border-mid-gray/80 rounded-lg shadow-lg z-50 overflow-hidden">
                  <div className="p-2 border-b border-mid-gray/40">
                    <input
                      ref={langSearchRef}
                      type="text"
                      value={langSearch}
                      onChange={(e) => setLangSearch(e.target.value)}
                      onKeyDown={(e) => {
                        if (
                          e.key === "Enter" &&
                          filteredLanguages.length > 0
                        ) {
                          updateSetting(
                            "cloud_stt_language",
                            filteredLanguages[0].value,
                          );
                          setLangDropdownOpen(false);
                          setLangSearch("");
                        } else if (e.key === "Escape") {
                          setLangDropdownOpen(false);
                          setLangSearch("");
                        }
                      }}
                      placeholder={t(
                        "settings.general.language.searchPlaceholder",
                        "Search languages...",
                      )}
                      className="w-full px-2 py-1 text-sm bg-mid-gray/10 border border-mid-gray/40 rounded-md focus:outline-none focus:ring-1 focus:ring-logo-primary"
                    />
                  </div>
                  <div className="max-h-48 overflow-y-auto">
                    <button
                      type="button"
                      onClick={() => {
                        updateSetting("cloud_stt_language", "auto");
                        setLangDropdownOpen(false);
                        setLangSearch("");
                      }}
                      className={`w-full px-3 py-1.5 text-sm text-left transition-colors ${
                        selectedLanguage === "auto"
                          ? "bg-logo-primary/20 text-logo-primary font-semibold"
                          : "hover:bg-mid-gray/10"
                      }`}
                    >
                      {t("settings.cloudStt.autoDetect", "Auto Detect")}
                    </button>
                    {filteredLanguages.map((lang) => (
                      <button
                        key={lang.value}
                        type="button"
                        onClick={() => {
                          updateSetting("cloud_stt_language", lang.value);
                          setLangDropdownOpen(false);
                          setLangSearch("");
                        }}
                        className={`w-full px-3 py-1.5 text-sm text-left transition-colors ${
                          selectedLanguage === lang.value
                            ? "bg-logo-primary/20 text-logo-primary font-semibold"
                            : "hover:bg-mid-gray/10"
                        }`}
                      >
                        {lang.label}
                      </button>
                    ))}
                    {filteredLanguages.length === 0 && (
                      <div className="px-3 py-2 text-sm text-text/50 text-center">
                        {t(
                          "settings.general.language.noResults",
                          "No languages found",
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </SettingsGroup>
      )}
    </div>
  );
}
