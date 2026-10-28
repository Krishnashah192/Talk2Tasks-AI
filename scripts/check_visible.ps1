Add-Type -TypeDefinition @"
using System;
using System.Text;
using System.Runtime.InteropServices;
public class Win {
    public delegate bool EnumWindowsProc(IntPtr hWnd, IntPtr lParam);
    [DllImport("user32.dll")] public static extern bool EnumWindows(EnumWindowsProc lpEnumFunc, IntPtr lParam);
    [DllImport("user32.dll")] public static extern int GetWindowText(IntPtr hWnd, StringBuilder lpString, int nMaxCount);
    [DllImport("user32.dll")] public static extern bool IsWindowVisible(IntPtr hWnd);
    [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint lpdwProcessId);
}
"@
$wins = @()
[Win]::EnumWindows({
    param($hwnd, $lparam)
    if ([Win]::IsWindowVisible($hwnd)) {
        $sb = New-Object System.Text.StringBuilder 256
        [Win]::GetWindowText($hwnd, $sb, 256) | Out-Null
        $t = $sb.ToString()
        if ($t.Length -gt 0) {
            $pid = 0
            [Win]::GetWindowThreadProcessId($hwnd, [ref]$pid) | Out-Null
            $p = Get-Process -Id $pid -ErrorAction SilentlyContinue
            if ($p) {
                Write-Output "$($p.ProcessName) (PID $pid): '$t'"
            }
        }
    }
    return $true
}, [IntPtr]::Zero)
