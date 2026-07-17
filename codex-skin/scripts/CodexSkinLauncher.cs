using System;
using System.Diagnostics;
using System.IO;
using System.Reflection;

[assembly: AssemblyVersion("0.2.0.0")]
[assembly: AssemblyFileVersion("0.2.0.0")]

internal static class CodexSkinLauncher
{
    [STAThread]
    private static int Main()
    {
        try
        {
            string appRoot = Path.Combine(
                Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
                "CodexSkin");
            string scriptPath = Path.Combine(appRoot, "runtime", "codex-skin.ps1");
            if (!File.Exists(scriptPath))
            {
                return 2;
            }

            string powershellPath = Path.Combine(
                Environment.GetFolderPath(Environment.SpecialFolder.System),
                "WindowsPowerShell",
                "v1.0",
                "powershell.exe");

            var startInfo = new ProcessStartInfo
            {
                FileName = powershellPath,
                Arguments = "-NoProfile -WindowStyle Hidden -File \"" + scriptPath + "\" launch",
                WorkingDirectory = appRoot,
                UseShellExecute = false,
                CreateNoWindow = true,
                WindowStyle = ProcessWindowStyle.Hidden
            };
            Process.Start(startInfo);
            return 0;
        }
        catch
        {
            return 1;
        }
    }
}
