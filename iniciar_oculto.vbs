Set WshShell = CreateObject("WScript.Shell")
WshShell.CurrentDirectory = "C:\Users\spereyra\Apps\equipo-gestion"
WshShell.Run """C:\Program Files\nodejs\node.exe"" guardian.js", 0, False
