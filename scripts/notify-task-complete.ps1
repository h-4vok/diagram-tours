param(
  [string]$Title = "Codex",
  [string]$Message = "Codex finalizo la tarea"
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Install-NuGetProviderIfMissing {
  $provider = Get-PackageProvider -Name NuGet -ListAvailable -ErrorAction SilentlyContinue

  if ($null -ne $provider) {
    return
  }

  Install-PackageProvider -Name NuGet -MinimumVersion 2.8.5.201 -Force -Scope CurrentUser | Out-Null
}

function Install-BurntToastIfMissing {
  $module = Get-Module -ListAvailable BurntToast | Select-Object -First 1

  if ($null -ne $module) {
    return
  }

  Install-NuGetProviderIfMissing
  Install-Module BurntToast -Scope CurrentUser -Force -AllowClobber | Out-Null
}

function Show-BurntToast {
  param(
    [string]$ToastTitle,
    [string]$ToastMessage
  )

  Install-BurntToastIfMissing
  Import-Module BurntToast -Force
  New-BurntToastNotification -Text $ToastTitle, $ToastMessage | Out-Null
}

function Show-MessageBoxFallback {
  param(
    [string]$DialogTitle,
    [string]$DialogMessage
  )

  Add-Type -AssemblyName PresentationFramework
  [System.Windows.MessageBox]::Show($DialogMessage, $DialogTitle) | Out-Null
}

function Show-TaskNotification {
  param(
    [string]$NotificationTitle,
    [string]$NotificationMessage
  )

  try {
    Show-BurntToast -ToastTitle $NotificationTitle -ToastMessage $NotificationMessage
  } catch {
    Show-MessageBoxFallback -DialogTitle $NotificationTitle -DialogMessage $NotificationMessage
  }
}

Show-TaskNotification -NotificationTitle $Title -NotificationMessage $Message
