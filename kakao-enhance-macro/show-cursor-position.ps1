Add-Type -AssemblyName System.Windows.Forms

Write-Host "Move the mouse to the target area to read the current screen coordinates. Press Ctrl+C to stop."

while ($true) {
  $position = [System.Windows.Forms.Cursor]::Position
  Write-Host ("`rX={0} Y={1}        " -f $position.X, $position.Y) -NoNewline
  Start-Sleep -Milliseconds 120
}
