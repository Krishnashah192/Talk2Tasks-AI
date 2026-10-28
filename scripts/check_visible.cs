using System;
using System.Diagnostics;
using System.Runtime.InteropServices;
using System.Text;

class Program {
    delegate bool EnumWindowsProc(IntPtr hWnd, IntPtr lParam);
    [DllImport("user32.dll")] static extern bool EnumWindows(EnumWindowsProc lpEnumFunc, IntPtr lParam);
    [DllImport("user32.dll")] static extern int GetWindowText(IntPtr hWnd, StringBuilder lpString, int nMaxCount);
    [DllImport("user32.dll")] static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint lpdwProcessId);

    static void Main() {
        int count = 0;
        EnumWindows((hWnd, lParam) => {
            count++;
            uint pid;
            GetWindowThreadProcessId(hWnd, out pid);
            StringBuilder sb = new StringBuilder(512);
            GetWindowText(hWnd, sb, 512);
            string text = sb.ToString();
            if (text.ToLower().Contains("talk") || text.ToLower().Contains("meet") || text.ToLower().Contains("chrome")) {
                Console.WriteLine("PID " + pid + ": " + text);
            }
            return true;
        }, IntPtr.Zero);
        Console.WriteLine("Total windows enumerated: " + count);
    }
}
