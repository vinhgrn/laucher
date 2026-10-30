#define UNICODE
#define _UNICODE
#include <windows.h>
#include <iostream>
#include <string>
int wmain(int argc, wchar_t* argv[]) {
    wchar_t modulePath[32768] = {};
    if (!GetModuleFileNameW(NULL, modulePath, 32768)) return 2;
    std::wstring workDir(modulePath);
    workDir = workDir.substr(0, workDir.find_last_of(L"\\/"));
    std::wstring electron = workDir + L"\\node_modules\\electron\\dist\\electron.exe";
    if (GetFileAttributesW(electron.c_str()) == INVALID_FILE_ATTRIBUTES) {
        auto parent = workDir.substr(0, workDir.find_last_of(L"\\/"));
        electron = parent + L"\\laucher\\node_modules\\electron\\dist\\electron.exe";
    }
    if (GetFileAttributesW(electron.c_str()) == INVALID_FILE_ATTRIBUTES) {
        std::wcerr << L"Electron is missing. Run npm install in the launcher directory." << std::endl;
        return 2;
    }
    const bool restore = argc > 1 && wcscmp(argv[1], L"--restore-windows") == 0;
    std::wstring cmd = L"\"" + electron + L"\" \"" + workDir + L"\"" +
        (restore ? L" --restore-windows" : L" --reload-launcher");
    STARTUPINFOW si;
    ZeroMemory(&si, sizeof(si));
    si.cb = sizeof(si);
    si.lpDesktop = (LPWSTR)L"WinSta0\\Default";
    PROCESS_INFORMATION pi;
    ZeroMemory(&pi, sizeof(pi));
    std::wcout << L"Launching on WinSta0\\Default: " << cmd << std::endl;
    BOOL ok = CreateProcessW(
        electron.c_str(),
        &cmd[0],
        NULL,
        NULL,
        FALSE,
        CREATE_NEW_PROCESS_GROUP,
        NULL,
        workDir.c_str(),
        &si,
        &pi
    );
    if (ok) {
        std::wcout << L"Success! PID: " << pi.dwProcessId << std::endl;
        CloseHandle(pi.hProcess);
        CloseHandle(pi.hThread);
        return 0;
    } else {
        std::wcout << L"Failed with error: " << GetLastError() << std::endl;
        return 2;
    }
}