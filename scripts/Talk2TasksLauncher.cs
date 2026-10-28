using System;
using System.IO;
using System.Net.Sockets;
using System.Threading;
using System.Diagnostics;
using System.Windows.Forms;

namespace Talk2Tasks
{
    static class Program
    {
        private static string logFile = "";

        static void Log(string msg)
        {
            try
            {
                if (!string.IsNullOrEmpty(logFile))
                {
                    File.AppendAllText(logFile, DateTime.Now.ToString("HH:mm:ss.fff") + " - " + msg + Environment.NewLine);
                }
            }
            catch { }
        }

        [STAThread]
        static void Main(string[] args)
        {
            try
            {
                string baseDir = AppDomain.CurrentDomain.BaseDirectory.TrimEnd('\\', '/');
                logFile = Path.Combine(baseDir, "launcher_debug.log");
                Log("=== Talk2Tasks Launcher Invoked ===");

                if (!File.Exists(Path.Combine(baseDir, "backend", "venv", "Scripts", "python.exe")))
                {
                    DirectoryInfo parentInfo = Directory.GetParent(baseDir);
                    if (parentInfo != null && File.Exists(Path.Combine(parentInfo.FullName, "backend", "venv", "Scripts", "python.exe")))
                    {
                        baseDir = parentInfo.FullName;
                    }
                }

                string pythonExe = Path.Combine(baseDir, "backend", "venv", "Scripts", "python.exe");
                string backendDir = Path.Combine(baseDir, "backend");
                string electronExe = Path.Combine(baseDir, "frontend", "node_modules", "electron", "dist", "electron.exe");
                string frontendDir = Path.Combine(baseDir, "frontend");

                Log("BaseDir resolved: " + baseDir);
                Log("pythonExe: " + pythonExe + " (Exists: " + File.Exists(pythonExe) + ")");
                Log("electronExe: " + electronExe + " (Exists: " + File.Exists(electronExe) + ")");
                Log("frontendDir: " + frontendDir + " (Exists: " + Directory.Exists(frontendDir) + ")");

                // 1. Ensure local FastAPI backend is running
                if (File.Exists(pythonExe))
                {
                    bool backendOpen = IsPortOpen("127.0.0.1", 8000, 300);
                    Log("Backend port 8000 open: " + backendOpen);
                    if (!backendOpen)
                    {
                        ProcessStartInfo bPsi = new ProcessStartInfo();
                        bPsi.FileName = pythonExe;
                        bPsi.Arguments = "-m uvicorn app.main:app --host 127.0.0.1 --port 8000";
                        bPsi.WorkingDirectory = backendDir;
                        bPsi.WindowStyle = ProcessWindowStyle.Hidden;
                        bPsi.CreateNoWindow = true;
                        bPsi.UseShellExecute = false;
                        Process.Start(bPsi);
                        Log("Spawned backend process.");

                        for (int i = 0; i < 20; i++)
                        {
                            Thread.Sleep(200);
                            if (IsPortOpen("127.0.0.1", 8000, 200))
                            {
                                Log("Backend ready after " + ((i + 1) * 200) + "ms");
                                break;
                            }
                        }
                    }
                }

                // 2. Launch or activate Electron Desktop Application
                if (File.Exists(electronExe))
                {
                    ProcessStartInfo ePsi = new ProcessStartInfo();
                    ePsi.FileName = electronExe;
                    ePsi.Arguments = ".";
                    ePsi.WorkingDirectory = frontendDir;
                    ePsi.WindowStyle = ProcessWindowStyle.Normal;
                    ePsi.UseShellExecute = true;

                    Log("Spawning Electron with ShellExecute: " + electronExe + " in " + frontendDir);
                    Process.Start(ePsi);
                    Log("Electron launch command dispatched successfully.");
                }
                else
                {
                    Log("WARN: electronExe not found! Opening fallback browser...");
                    Process.Start("http://localhost:8000/docs");
                }
            }
            catch (Exception ex)
            {
                Log("EXCEPTION: " + ex.ToString());
                MessageBox.Show(
                    "Error launching Talk2Tasks AI:\n" + ex.Message + "\n\nLog: " + logFile,
                    "Talk2Tasks AI",
                    MessageBoxButtons.OK,
                    MessageBoxIcon.Error
                );
            }
        }

        private static bool IsPortOpen(string host, int port, int timeoutMs)
        {
            try
            {
                using (Socket sock = new Socket(AddressFamily.InterNetwork, SocketType.Stream, ProtocolType.Tcp))
                {
                    sock.Blocking = false;
                    try
                    {
                        sock.Connect(host, port);
                        return true;
                    }
                    catch (SocketException ex)
                    {
                        if (ex.NativeErrorCode == 10035) // WSAEWOULDBLOCK
                        {
                            return sock.Poll(timeoutMs * 1000, SelectMode.SelectWrite);
                        }
                        return false;
                    }
                }
            }
            catch
            {
                return false;
            }
        }
    }
}
