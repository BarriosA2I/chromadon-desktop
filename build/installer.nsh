; =============================================================================
; CHROMADON Custom NSIS Installer Script
; Auto-removes previous installations before installing new version
; =============================================================================

!macro customInit
  ; --- Remove per-machine installation (if exists) ---
  ReadRegStr $0 HKLM "SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall\com.barriosa2i.chromadon" "QuietUninstallString"
  ${If} $0 != ""
    ExecWait '$0 --force'
  ${EndIf}

  ; --- Remove per-user installation (if exists) ---
  ReadRegStr $0 HKCU "SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall\com.barriosa2i.chromadon" "QuietUninstallString"
  ${If} $0 != ""
    ExecWait '$0 --force'
  ${EndIf}
!macroend
