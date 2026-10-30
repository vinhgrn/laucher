#define _WIN32_WINNT 0x0601
#define UNICODE
#define _UNICODE
#include <windows.h>
#include <dwmapi.h>
#include <psapi.h>
#include <gdiplus.h>
#include <shlobj.h>
#include <tlhelp32.h>
#include <iostream>
#include <string>
#include <vector>
#include <thread>
#include <mutex>
#include <sstream>
#include <iomanip>
#include <chrono>
#include <atomic>
#include <map>
#include <memory>
#include <algorithm>
#include <propsys.h>
#include <propkey.h>
using namespace Gdiplus;
#pragma comment(lib, "user32.lib")
#pragma comment(lib, "gdi32.lib")
#pragma comment(lib, "dwmapi.lib")
#pragma comment(lib, "psapi.lib")
#pragma comment(lib, "gdiplus.lib")
#pragma comment(lib, "ole32.lib")
#pragma comment(lib, "shell32.lib")
static std::mutex g_outputMutex;
static HWND g_launcherHwnd = NULL;
static HWND g_homeBarHwnd = NULL;
static DWORD g_launcherPid = 0;
static std::atomic<bool> g_taskbarHidden{false};
static std::atomic<bool> g_running{true};
static std::map<HWND, BOOL> g_originalTransitions;
static bool g_autoMaximize = false;
static bool g_splitActive = false;
static std::vector<HWND> g_splitHwnds;
static HWINEVENTHOOK g_hHook = NULL;
static HDESK g_hDefaultDesk = NULL;
static DWORD g_mainThreadId = 0;
void AttachToDefaultDesktop() {
    if (!g_hDefaultDesk) {
        g_hDefaultDesk = OpenDesktopW(L"Default", 0, FALSE, GENERIC_ALL);
    }
    if (g_hDefaultDesk) {
        SetThreadDesktop(g_hDefaultDesk);
    }
}
void DisableWindowTransitions(HWND hwnd) {
    if (!hwnd || !IsWindow(hwnd)) return;
    if (!g_originalTransitions.count(hwnd)) {
        BOOL original = FALSE;
        DwmGetWindowAttribute(hwnd, DWMWA_TRANSITIONS_FORCEDISABLED, &original, sizeof(original));
        g_originalTransitions[hwnd] = original;
    }
    BOOL disable = TRUE;
    DwmSetWindowAttribute(hwnd, DWMWA_TRANSITIONS_FORCEDISABLED, &disable, sizeof(disable));
}
void SetWindowsAnimationEnabled(bool enable) {
    if (!enable) return;
    for (const auto& item : g_originalTransitions) {
        if (IsWindow(item.first)) DwmSetWindowAttribute(item.first,
            DWMWA_TRANSITIONS_FORCEDISABLED, &item.second, sizeof(item.second));
    }
    g_originalTransitions.clear();
}
std::string EscapeJson(const std::wstring& ws) {
    if (ws.empty()) return "";
    int len = WideCharToMultiByte(CP_UTF8, 0, ws.c_str(), -1, NULL, 0, NULL, NULL);
    if (len <= 1) return "";
    std::string s(len, 0);
    WideCharToMultiByte(CP_UTF8, 0, ws.c_str(), -1, &s[0], len, NULL, NULL);
    s.resize(len - 1);
    std::ostringstream o;
    for (char c : s) {
        if (c == '"') o << "\\\"";
        else if (c == '\\') o << "\\\\";
        else if (c == '\b') o << "\\b";
        else if (c == '\f') o << "\\f";
        else if (c == '\n') o << "\\n";
        else if (c == '\r') o << "\\r";
        else if (c == '\t') o << "\\t";
        else if ((unsigned char)c < ' ') {
            o << "\\u" << std::hex << std::setw(4) << std::setfill('0') << (int)(unsigned char)c;
        } else {
            o << c;
        }
    }
    return o.str();
}
int GetEncoderClsid(const WCHAR* format, CLSID* pClsid) {
    UINT num = 0, size = 0;
    GetImageEncodersSize(&num, &size);
    if (size == 0) return -1;
    ImageCodecInfo* pImageCodecInfo = (ImageCodecInfo*)(malloc(size));
    if (pImageCodecInfo == NULL) return -1;
    GetImageEncoders(num, size, pImageCodecInfo);
    for (UINT j = 0; j < num; ++j) {
        if (wcscmp(pImageCodecInfo[j].MimeType, format) == 0) {
            *pClsid = pImageCodecInfo[j].Clsid;
            free(pImageCodecInfo);
            return j;
        }
    }
    free(pImageCodecInfo);
    return -1;
}
void SetTaskbarVisible(bool visible) {
    AttachToDefaultDesktop();
    HWND hTaskbar = FindWindowW(L"Shell_TrayWnd", NULL);
    if (hTaskbar) {
        ShowWindow(hTaskbar, visible ? SW_SHOW : SW_HIDE);
    }
    HWND hSecTaskbar = FindWindowW(L"Shell_SecondaryTrayWnd", NULL);
    while (hSecTaskbar) {
        ShowWindow(hSecTaskbar, visible ? SW_SHOW : SW_HIDE);
        hSecTaskbar = FindWindowExW(NULL, hSecTaskbar, L"Shell_SecondaryTrayWnd", NULL);
    }
    g_taskbarHidden = !visible;
}
struct WindowInfo {
    HWND hwnd;
    std::wstring title;
    std::wstring processName;
    std::wstring processPath;
    std::wstring appUserModelId;
    std::wstring processAppUserModelId;
    DWORD pid;
    RECT rect;
    bool isMinimized;
    bool isMaximized;
    bool isForeground;
    bool canMaximize;
    bool isSmallWindow;
};
std::wstring GetProcessName(DWORD pid);
std::wstring GetProcessPath(DWORD pid) {
    HANDLE process = OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, FALSE, pid);
    if (!process) return L"";
    std::wstring result(32768, 0); DWORD size = (DWORD)result.size();
    if (QueryFullProcessImageNameW(process, 0, &result[0], &size)) result.resize(size); else result.clear();
    CloseHandle(process); return result;
}
std::wstring GetWindowAppId(HWND hwnd) {
    IPropertyStore* store = nullptr; std::wstring result;
    if (SUCCEEDED(SHGetPropertyStoreForWindow(hwnd, IID_PPV_ARGS(&store)))) {
        PROPVARIANT value = {};
        if (SUCCEEDED(store->GetValue(PKEY_AppUserModel_ID, &value)) && value.vt == VT_LPWSTR && value.pwszVal)
            result = value.pwszVal;
        PropVariantClear(&value); store->Release();
    }
    return result;
}
std::wstring GetProcessAppId(DWORD pid) {
    using AppIdFn = LONG (WINAPI*)(HANDLE, UINT32*, PWSTR);
    static auto query = (AppIdFn)GetProcAddress(GetModuleHandleW(L"kernel32.dll"), "GetApplicationUserModelId");
    if (!query) return L"";
    HANDLE process = OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, FALSE, pid);
    if (!process) return L"";
    UINT32 length = 0; std::wstring value;
    if (query(process, &length, nullptr) == ERROR_INSUFFICIENT_BUFFER && length < 32768) {
        value.resize(length);
        if (query(process, &length, &value[0]) == ERROR_SUCCESS) value.resize(length ? length - 1 : 0);
        else value.clear();
    }
    CloseHandle(process); return value;
}
std::string WindowIdentityJson(HWND hwnd, DWORD pid) {
    return ",\"processPath\":\"" + EscapeJson(GetProcessPath(pid)) +
        "\",\"appUserModelId\":\"" + EscapeJson(GetWindowAppId(hwnd)) +
        "\",\"processAppUserModelId\":\"" + EscapeJson(GetProcessAppId(pid)) + "\"";
}
void KeepHomebarAbove() {
    if (g_homeBarHwnd && IsWindow(g_homeBarHwnd))
        SetWindowPos(g_homeBarHwnd, HWND_TOPMOST, 0, 0, 0, 0,
            SWP_NOMOVE | SWP_NOSIZE | SWP_NOACTIVATE | SWP_SHOWWINDOW);
}
bool IsLauncherOrHomebar(HWND hwnd) {
    if (!hwnd || !IsWindow(hwnd)) return false;
    if (hwnd == g_launcherHwnd || hwnd == g_homeBarHwnd) return true;
    HWND root = GetAncestor(hwnd, GA_ROOT);
    HWND rootLauncher = g_launcherHwnd ? GetAncestor(g_launcherHwnd, GA_ROOT) : NULL;
    HWND rootHomeBar = g_homeBarHwnd ? GetAncestor(g_homeBarHwnd, GA_ROOT) : NULL;
    if (rootLauncher && (hwnd == rootLauncher || root == rootLauncher)) return true;
    if (rootHomeBar && (hwnd == rootHomeBar || root == rootHomeBar)) return true;
    DWORD pid = 0;
    GetWindowThreadProcessId(hwnd, &pid);
    if (pid != 0) {
        if (pid == GetCurrentProcessId()) return true;
        if (g_launcherPid != 0 && pid == g_launcherPid) return true;
        DWORD launcherPid = 0, homeBarPid = 0;
        if (g_launcherHwnd) GetWindowThreadProcessId(g_launcherHwnd, &launcherPid);
        if (g_homeBarHwnd) GetWindowThreadProcessId(g_homeBarHwnd, &homeBarPid);
        if ((launcherPid != 0 && pid == launcherPid) || (homeBarPid != 0 && pid == homeBarPid)) {
            return true;
        }
    }
    wchar_t titleBuf[256] = {0};
    GetWindowTextW(hwnd, titleBuf, 256);
    if (wcsstr(titleBuf, L"AeroIOS Windows Launcher") != NULL) {
        return true;
    }
    return false;
}
bool IsApplicationWindow(HWND hwnd) {
    if (!hwnd || !IsWindow(hwnd) || !IsWindowVisible(hwnd)) return false;
    if (IsLauncherOrHomebar(hwnd)) return false;
    wchar_t cls[128] = {0};
    GetClassNameW(hwnd, cls, 128);
    if (wcscmp(cls, L"Shell_TrayWnd") == 0 ||
        wcscmp(cls, L"Shell_SecondaryTrayWnd") == 0 ||
        wcscmp(cls, L"Progman") == 0 ||
        wcscmp(cls, L"WorkerW") == 0 ||
        wcscmp(cls, L"ApplicationFrameWindow_Ghost") == 0) {
        return false;
    }
    int len = GetWindowTextLengthW(hwnd);
    if (len == 0) return false;
    int cloaked = 0;
    DwmGetWindowAttribute(hwnd, 14 , &cloaked, sizeof(cloaked));
    if (cloaked != 0) return false;
    LONG_PTR exStyle = GetWindowLongPtrW(hwnd, GWL_EXSTYLE);
    if (exStyle & WS_EX_TOOLWINDOW) return false;
    return true;
}
bool CanWindowMaximize(HWND hwnd) {
    if (!hwnd || !IsWindow(hwnd)) return false;
    LONG_PTR style = GetWindowLongPtrW(hwnd, GWL_STYLE);
    return (style & WS_MAXIMIZEBOX) != 0;
}
std::wstring GetProcessName(DWORD pid) {
    HANDLE hProcess = OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, FALSE, pid);
    if (!hProcess) return L"";
    wchar_t path[MAX_PATH];
    DWORD size = MAX_PATH;
    if (QueryFullProcessImageNameW(hProcess, 0, path, &size)) {
        CloseHandle(hProcess);
        wchar_t* fname = wcsrchr(path, L'\\');
        return fname ? (fname + 1) : path;
    }
    CloseHandle(hProcess);
    return L"";
}
BOOL CALLBACK EnumWindowsCallback(HWND hwnd, LPARAM lParam) {
    if (IsApplicationWindow(hwnd)) {
        std::vector<WindowInfo>* pList = (std::vector<WindowInfo>*)lParam;
        HWND hFore = GetForegroundWindow();
        wchar_t titleBuf[512] = {0};
        GetWindowTextW(hwnd, titleBuf, 512);
        DWORD pid = 0;
        GetWindowThreadProcessId(hwnd, &pid);
        std::wstring procName = GetProcessName(pid);
        RECT rc;
        GetWindowRect(hwnd, &rc);
        int screenW = GetSystemMetrics(SM_CXSCREEN);
        int screenH = GetSystemMetrics(SM_CYSCREEN);
        int w = rc.right - rc.left;
        int h = rc.bottom - rc.top;
        WindowInfo info;
        info.hwnd = hwnd;
        info.title = titleBuf;
        info.processName = procName;
        info.processPath = GetProcessPath(pid);
        info.appUserModelId = GetWindowAppId(hwnd);
        info.processAppUserModelId = GetProcessAppId(pid);
        info.pid = pid;
        info.rect = rc;
        info.isMinimized = (IsIconic(hwnd) != 0);
        info.isMaximized = (IsZoomed(hwnd) != 0);
        info.isForeground = (hwnd == hFore);
        info.canMaximize = CanWindowMaximize(hwnd);
        info.isSmallWindow = (w < screenW - 80) || (h < screenH - 80);
        pList->push_back(info);
    }
    return TRUE;
}
std::vector<WindowInfo> EnumerateWindows() {
    AttachToDefaultDesktop();
    std::vector<WindowInfo> list;
    if (g_hDefaultDesk) {
        EnumDesktopWindows(g_hDefaultDesk, EnumWindowsCallback, (LPARAM)&list);
    } else {
        EnumWindows(EnumWindowsCallback, (LPARAM)&list);
    }
    return list;
}
void SetProcessPriority(DWORD pid, DWORD priorityClass, BOOL disableBoost = FALSE) {
    if (pid <= 4) return;
    HANDLE hProc = OpenProcess(PROCESS_SET_INFORMATION, FALSE, pid);
    if (hProc) {
        SetPriorityClass(hProc, priorityClass);
        if (disableBoost) {
            SetProcessPriorityBoost(hProc, TRUE);
        }
        CloseHandle(hProc);
    }
}
void SetAllLauncherProcessesPriority(DWORD priorityClass) {
    SetPriorityClass(GetCurrentProcess(), priorityClass);
    DWORD launcherPid = 0;
    if (g_launcherHwnd) {
        GetWindowThreadProcessId(g_launcherHwnd, &launcherPid);
    }
    HANDLE hSnap = CreateToolhelp32Snapshot(TH32CS_SNAPPROCESS, 0);
    if (hSnap != INVALID_HANDLE_VALUE) {
        PROCESSENTRY32W pe;
        pe.dwSize = sizeof(pe);
        if (Process32FirstW(hSnap, &pe)) {
            do {
                if (pe.th32ProcessID > 4) {
                    if ((launcherPid != 0 && (pe.th32ProcessID == launcherPid || pe.th32ParentProcessID == launcherPid))) {
                        SetProcessPriority(pe.th32ProcessID, priorityClass);
                    }
                }
            } while (Process32NextW(hSnap, &pe));
        }
        CloseHandle(hSnap);
    }
}
void OptimizeCpuForLaunch(DWORD) { SetAllLauncherProcessesPriority(ABOVE_NORMAL_PRIORITY_CLASS); }
void OptimizeCpuForAppActive(DWORD) { SetAllLauncherProcessesPriority(NORMAL_PRIORITY_CLASS); }
void OptimizeCpuForExitAnim(DWORD) { SetAllLauncherProcessesPriority(ABOVE_NORMAL_PRIORITY_CLASS); }
void ResetCpuPriorities() { SetAllLauncherProcessesPriority(NORMAL_PRIORITY_CLASS); }
bool CaptureWindowToFile(HWND hwnd, const std::wstring& outPath, int maxW = 960, int maxH = 540) {
    if (!hwnd || !IsWindow(hwnd) || IsIconic(hwnd) || GetForegroundWindow() != hwnd) return false;
    RECT rc; if (!GetWindowRect(hwnd, &rc)) return false;
    int w = rc.right - rc.left, h = rc.bottom - rc.top;
    if (w <= 10 || h <= 10) return false;
    double scale = std::min(1.0, std::min((double)maxW / w, (double)maxH / h));
    int thumbW = std::max(1, (int)(w * scale)), thumbH = std::max(1, (int)(h * scale));
    HDC screen = GetDC(NULL); if (!screen) return false;
    HDC memory = CreateCompatibleDC(screen);
    HBITMAP bitmap = memory ? CreateCompatibleBitmap(screen, thumbW, thumbH) : NULL;
    if (!memory || !bitmap) { if (memory) DeleteDC(memory); ReleaseDC(NULL, screen); return false; }
    HGDIOBJ original = SelectObject(memory, bitmap);
    SetStretchBltMode(memory, HALFTONE);
    BOOL copied = StretchBlt(memory, 0, 0, thumbW, thumbH, screen,
        rc.left, rc.top, w, h, SRCCOPY | CAPTUREBLT);
    bool success = false;
    if (copied) {
        Bitmap image(bitmap, NULL); CLSID clsid;
        if (GetEncoderClsid(L"image/jpeg", &clsid) != -1) {
            EncoderParameters parameters = {}; ULONG quality = 72;
            parameters.Count = 1; parameters.Parameter[0].Guid = EncoderQuality;
            parameters.Parameter[0].Type = EncoderParameterValueTypeLong;
            parameters.Parameter[0].NumberOfValues = 1; parameters.Parameter[0].Value = &quality;
            success = image.Save(outPath.c_str(), &clsid, &parameters) == Ok;
        }
    }
    SelectObject(memory, original); DeleteObject(bitmap); DeleteDC(memory); ReleaseDC(NULL, screen);
    return success;
}
static ULONGLONG g_prevIdle = 0, g_prevKernel = 0, g_prevUser = 0;
double GetCpuUsage() {
    FILETIME idleTime, kernelTime, userTime;
    if (!GetSystemTimes(&idleTime, &kernelTime, &userTime)) return 0.0;
    ULARGE_INTEGER uIdle, uKernel, uUser;
    uIdle.LowPart = idleTime.dwLowDateTime; uIdle.HighPart = idleTime.dwHighDateTime;
    uKernel.LowPart = kernelTime.dwLowDateTime; uKernel.HighPart = kernelTime.dwHighDateTime;
    uUser.LowPart = userTime.dwLowDateTime; uUser.HighPart = userTime.dwHighDateTime;
    if (g_prevKernel == 0) {
        g_prevIdle = uIdle.QuadPart;
        g_prevKernel = uKernel.QuadPart;
        g_prevUser = uUser.QuadPart;
        return 12.0;
    }
    ULONGLONG idleDiff = uIdle.QuadPart - g_prevIdle;
    ULONGLONG kernelDiff = uKernel.QuadPart - g_prevKernel;
    ULONGLONG userDiff = uUser.QuadPart - g_prevUser;
    ULONGLONG total = kernelDiff + userDiff;
    g_prevIdle = uIdle.QuadPart;
    g_prevKernel = uKernel.QuadPart;
    g_prevUser = uUser.QuadPart;
    if (total == 0) return 0.0;
    double pct = 100.0 * (double)(total - idleDiff) / (double)total;
    if (pct < 0) pct = 0;
    if (pct > 100) pct = 100;
    return pct;
}
void CALLBACK WinEventProc(HWINEVENTHOOK hHook, DWORD event, HWND hwnd, LONG idObject, LONG idChild, DWORD dwEventThread, DWORD dwmsEventTime) {
    if (idObject != OBJID_WINDOW || idChild != CHILDID_SELF) return;
    if (!hwnd) return;
    if (IsLauncherOrHomebar(hwnd)) {
        if (event == EVENT_SYSTEM_FOREGROUND) KeepHomebarAbove();
        return;
    }
    if (event == EVENT_SYSTEM_MINIMIZESTART) {
        if (g_launcherHwnd && GetForegroundWindow() == hwnd)
            SetWindowPos(g_launcherHwnd, HWND_TOP, 0, 0, 0, 0,
                SWP_NOMOVE | SWP_NOSIZE | SWP_NOACTIVATE | SWP_SHOWWINDOW);
        DisableWindowTransitions(hwnd);
        wchar_t title[256] = {0};
        GetWindowTextW(hwnd, title, 256);
        std::lock_guard<std::mutex> lock(g_outputMutex);
        std::cout << "{\"event\":\"window_minimized\",\"hwnd\":" << (uintptr_t)hwnd
                  << ",\"title\":\"" << EscapeJson(title) << "\"}" << std::endl;
    } else if (event == EVENT_SYSTEM_FOREGROUND) {
        wchar_t desktopClass[64] = {};
        GetClassNameW(hwnd, desktopClass, 64);
        if (g_launcherHwnd && (wcscmp(desktopClass, L"Progman") == 0 || wcscmp(desktopClass, L"WorkerW") == 0)) {
            SetWindowPos(g_launcherHwnd, HWND_TOP, 0, 0, 0, 0,
                SWP_NOMOVE | SWP_NOSIZE | SWP_SHOWWINDOW);
            SetForegroundWindow(g_launcherHwnd);
            return;
        }
        if (IsApplicationWindow(hwnd)) {
            DisableWindowTransitions(hwnd);
            wchar_t title[256] = {0};
            GetWindowTextW(hwnd, title, 256);
            DWORD pid = 0;
            GetWindowThreadProcessId(hwnd, &pid);
            std::wstring procName = GetProcessName(pid);
            bool inSplit = false;
            if (g_splitActive) {
                for (HWND h : g_splitHwnds) {
                    if (h == hwnd) { inSplit = true; break; }
                }
            }
            RECT rc;
            GetWindowRect(hwnd, &rc);
            int screenW = GetSystemMetrics(SM_CXSCREEN);
            int screenH = GetSystemMetrics(SM_CYSCREEN);
            int w = rc.right - rc.left;
            int h = rc.bottom - rc.top;
            bool canMax = CanWindowMaximize(hwnd);
            if (g_autoMaximize && !inSplit && canMax && w >= 600 && h >= 400) {
                if (!IsZoomed(hwnd)) {
                    ShowWindow(hwnd, SW_MAXIMIZE);
                    GetWindowRect(hwnd, &rc);
                    w = rc.right - rc.left;
                    h = rc.bottom - rc.top;
                }
            }
            bool isSmall = (w < screenW - 80) || (h < screenH - 80);
            std::lock_guard<std::mutex> lock(g_outputMutex);
            std::cout << "{\"event\":\"foreground_changed\",\"hwnd\":" << (uintptr_t)hwnd
                      << ",\"pid\":" << pid
                      << ",\"processName\":\"" << EscapeJson(procName) << "\""
                      << WindowIdentityJson(hwnd, pid)
                      << ",\"title\":\"" << EscapeJson(title) << "\""
                      << ",\"rect\":{\"x\":" << rc.left << ",\"y\":" << rc.top << ",\"w\":" << w << ",\"h\":" << h << "}"
                      << ",\"canMaximize\":" << (canMax ? "true" : "false")
                      << ",\"isSmallWindow\":" << (isSmall ? "true" : "false")
                      << ",\"isMaximized\":" << (IsZoomed(hwnd) ? "true" : "false")
                      << "}" << std::endl;
        }
    } else if (event == EVENT_OBJECT_LOCATIONCHANGE) {
        if (hwnd && !IsLauncherOrHomebar(hwnd)) {
            HWND hFore = GetForegroundWindow();
            if (hwnd == hFore && IsApplicationWindow(hwnd)) {
                static HWND s_lastHwnd = NULL;
                static RECT s_lastRc = {0,0,0,0};
                RECT rc;
                GetWindowRect(hwnd, &rc);
                int w = rc.right - rc.left;
                int h = rc.bottom - rc.top;
                if (hwnd != s_lastHwnd || abs(rc.left - s_lastRc.left) > 10 || abs(rc.top - s_lastRc.top) > 10 || abs(w - (s_lastRc.right - s_lastRc.left)) > 10 || abs(h - (s_lastRc.bottom - s_lastRc.top)) > 10) {
                    s_lastHwnd = hwnd;
                    s_lastRc = rc;
                    std::lock_guard<std::mutex> lock(g_outputMutex);
                    std::cout << "{\"event\":\"window_rect_changed\",\"hwnd\":" << (uintptr_t)hwnd
                              << ",\"rect\":{\"x\":" << rc.left << ",\"y\":" << rc.top << ",\"w\":" << w << ",\"h\":" << h << "}"
                              << ",\"isMaximized\":" << (IsZoomed(hwnd) ? "true" : "false")
                              << "}" << std::endl;
                }
            }
        }
    } else if (event == EVENT_OBJECT_DESTROY) {
        g_originalTransitions.erase(hwnd);
        std::lock_guard<std::mutex> lock(g_outputMutex);
        std::cout << "{\"event\":\"window_destroyed\",\"hwnd\":" << (uintptr_t)hwnd << "}" << std::endl;
    }
}
bool GetJsonNumber(const std::string& json, const std::string& key, double& outVal) {
    std::string pattern = "\"" + key + "\":";
    size_t pos = json.find(pattern);
    if (pos == std::string::npos) return false;
    pos += pattern.length();
    while (pos < json.length() && (json[pos] == ' ' || json[pos] == '\t')) pos++;
    char* endPtr = nullptr;
    outVal = strtod(&json[pos], &endPtr);
    return endPtr != &json[pos];
}
bool GetJsonHwnd(const std::string& json, const std::string& key, uintptr_t& outHwnd) {
    std::string pattern = "\"" + key + "\":";
    size_t pos = json.find(pattern);
    if (pos == std::string::npos) return false;
    pos += pattern.length();
    while (pos < json.length() && (json[pos] == ' ' || json[pos] == '\t')) pos++;
    char* endPtr = nullptr;
    outHwnd = (uintptr_t)strtoull(&json[pos], &endPtr, 10);
    return endPtr != &json[pos];
}
void ForceSetForeground(HWND hwnd) {
    if (!hwnd || !IsWindow(hwnd)) return;
    HWND hCurFore = GetForegroundWindow();
    DWORD curThread = GetCurrentThreadId();
    DWORD foreThread = hCurFore ? GetWindowThreadProcessId(hCurFore, NULL) : 0;
    DWORD targetThread = GetWindowThreadProcessId(hwnd, NULL);
    if (foreThread && foreThread != curThread) {
        AttachThreadInput(curThread, foreThread, TRUE);
    }
    if (targetThread && targetThread != curThread) {
        AttachThreadInput(curThread, targetThread, TRUE);
    }
    ShowWindow(hwnd, SW_SHOW);
    SetWindowPos(hwnd, HWND_TOP, 0, 0, 0, 0, SWP_NOMOVE | SWP_NOSIZE | SWP_SHOWWINDOW);
    SetForegroundWindow(hwnd);
    BringWindowToTop(hwnd);
    KeepHomebarAbove();
    if (foreThread && foreThread != curThread) {
        AttachThreadInput(curThread, foreThread, FALSE);
    }
    if (targetThread && targetThread != curThread) {
        AttachThreadInput(curThread, targetThread, FALSE);
    }
}
void ProcessCommand(const std::string& line) {
    if (line.empty()) return;
    AttachToDefaultDesktop();
    if (line.find("\"cmd\":\"window_info\"") != std::string::npos) {
        uintptr_t value = 0; GetJsonHwnd(line, "hwnd", value);
        HWND h = (HWND)value; RECT rc = {}; WINDOWPLACEMENT wp = { sizeof(wp) };
        DWORD pid = 0; if (IsWindow(h)) GetWindowThreadProcessId(h, &pid);
        if (IsWindow(h)) {
            GetWindowRect(h, &rc);
            if (IsIconic(h) && GetWindowPlacement(h, &wp)) {
                rc = wp.rcNormalPosition;
                if (wp.flags & WPF_RESTORETOMAXIMIZED) {
                    MONITORINFO monitor = { sizeof(monitor) };
                    if (GetMonitorInfo(MonitorFromWindow(h, MONITOR_DEFAULTTONEAREST), &monitor)) rc = monitor.rcWork;
                }
            }
        }
        std::lock_guard<std::mutex> lock(g_outputMutex);
        std::cout << "{\"type\":\"window_info\",\"hwnd\":" << value
          << ",\"pid\":" << pid << ",\"processName\":\"" << EscapeJson(GetProcessName(pid)) << "\""
          << WindowIdentityJson(h, pid)
          << ",\"rect\":{\"x\":" << rc.left << ",\"y\":" << rc.top
          << ",\"w\":" << rc.right-rc.left << ",\"h\":" << rc.bottom-rc.top
          << "},\"isSmallWindow\":" << ((!IsZoomed(h)) ? "true" : "false") << "}" << std::endl;
    }
    else if (line.find("\"cmd\":\"list_windows\"") != std::string::npos) {
        std::vector<WindowInfo> wins = EnumerateWindows();
        std::ostringstream ss;
        ss << "{\"type\":\"windows_list\",\"data\":[";
        for (size_t i = 0; i < wins.size(); ++i) {
            const auto& w = wins[i];
            if (i > 0) ss << ",";
            ss << "{"
               << "\"hwnd\":" << (uintptr_t)w.hwnd << ","
               << "\"title\":\"" << EscapeJson(w.title) << "\","
               << "\"processName\":\"" << EscapeJson(w.processName) << "\","
               << "\"processPath\":\"" << EscapeJson(w.processPath) << "\","
               << "\"appUserModelId\":\"" << EscapeJson(w.appUserModelId) << "\","
               << "\"processAppUserModelId\":\"" << EscapeJson(w.processAppUserModelId) << "\","
               << "\"pid\":" << w.pid << ","
               << "\"rect\":{\"x\":" << w.rect.left << ",\"y\":" << w.rect.top
               << ",\"w\":" << (w.rect.right - w.rect.left) << ",\"h\":" << (w.rect.bottom - w.rect.top) << "},"
               << "\"isMinimized\":" << (w.isMinimized ? "true" : "false") << ","
               << "\"isMaximized\":" << (w.isMaximized ? "true" : "false") << ","
               << "\"isForeground\":" << (w.isForeground ? "true" : "false") << ","
               << "\"canMaximize\":" << (w.canMaximize ? "true" : "false") << ","
               << "\"isSmallWindow\":" << (w.isSmallWindow ? "true" : "false")
               << "}";
        }
        ss << "]}";
        std::lock_guard<std::mutex> lock(g_outputMutex);
        std::cout << ss.str() << std::endl;
    }
    else if (line.find("\"cmd\":\"capture_window\"") != std::string::npos) {
        size_t hPos = line.find("\"hwnd\":");
        size_t pPos = line.find("\"path\":\"");
        if (hPos != std::string::npos && pPos != std::string::npos) {
            uintptr_t hwndVal = std::stoull(line.substr(hPos + 7));
            size_t pEnd = line.find("\"", pPos + 8);
            std::string pathUtf8 = line.substr(pPos + 8, pEnd - (pPos + 8));
            std::string decoded;
            for (size_t i = 0; i < pathUtf8.size(); ++i) {
                if (pathUtf8[i] == '\\' && i + 1 < pathUtf8.size()) ++i;
                decoded += pathUtf8[i];
            }
            int wlen = MultiByteToWideChar(CP_UTF8, 0, decoded.c_str(), (int)decoded.size(), NULL, 0);
            std::wstring wpath(wlen, 0);
            if (wlen) MultiByteToWideChar(CP_UTF8, 0, decoded.c_str(), (int)decoded.size(), &wpath[0], wlen);
            bool ok = CaptureWindowToFile((HWND)hwndVal, wpath);
            std::lock_guard<std::mutex> lock(g_outputMutex);
            std::cout << "{\"type\":\"capture_result\",\"hwnd\":" << hwndVal << ",\"success\":" << (ok ? "true" : "false") << "}" << std::endl;
        }
    }
    else if (line.find("\"cmd\":\"minimize\"") != std::string::npos) {
        uintptr_t hwndVal = 0;
        if (GetJsonHwnd(line, "hwnd", hwndVal)) {
            HWND h = (HWND)hwndVal;
            const bool valid = IsWindow(h) && !IsLauncherOrHomebar(h);
            if (valid) DisableWindowTransitions(h);
            const bool success = valid && (IsIconic(h) || ShowWindowAsync(h, SW_MINIMIZE));
            std::lock_guard<std::mutex> lock(g_outputMutex);
            std::cout << "{\"type\":\"action_ack\",\"action\":\"minimize\",\"hwnd\":" << hwndVal
                << ",\"success\":" << (success ? "true" : "false") << "}" << std::endl;
        }
    }
    else if (line.find("\"cmd\":\"close_window\"") != std::string::npos) {
        uintptr_t hwndVal = 0;
        if (GetJsonHwnd(line, "hwnd", hwndVal)) {
            HWND h = (HWND)hwndVal;
            bool success = false;
            if (IsWindow(h) && !IsLauncherOrHomebar(h)) {
                DWORD pid = 0;
                GetWindowThreadProcessId(h, &pid);
                PostMessageW(h, WM_CLOSE, 0, 0);
                success = true;
            }
            std::lock_guard<std::mutex> lock(g_outputMutex);
            std::cout << "{\"type\":\"action_ack\",\"action\":\"close_window\",\"hwnd\":" << hwndVal
                << ",\"success\":" << (success ? "true" : "false") << "}" << std::endl;
        }
    }
    else if (line.find("\"cmd\":\"restore\"") != std::string::npos) {
        uintptr_t hwndVal = 0;
        if (GetJsonHwnd(line, "hwnd", hwndVal)) {
            HWND h = (HWND)hwndVal;
            DisableWindowTransitions(h);
            ShowWindow(h, SW_SHOW);
            if (IsIconic(h)) ShowWindow(h, SW_RESTORE);
            if (g_autoMaximize && !g_splitActive && CanWindowMaximize(h)) {
                RECT rc;
                GetWindowRect(h, &rc);
                if ((rc.right - rc.left) >= 600 && (rc.bottom - rc.top) >= 400) {
                    ShowWindow(h, SW_MAXIMIZE);
                }
            }
            SetForegroundWindow(h);
            if (g_launcherHwnd && h != g_launcherHwnd)
                SetWindowPos(g_launcherHwnd, h, 0, 0, 0, 0, SWP_NOMOVE | SWP_NOSIZE | SWP_NOACTIVATE);
            std::lock_guard<std::mutex> lock(g_outputMutex);
            std::cout << "{\"type\":\"action_ack\",\"action\":\"restore\",\"hwnd\":" << hwndVal << "}" << std::endl;
        }
    }
    else if (line.find("\"cmd\":\"set_foreground\"") != std::string::npos) {
        uintptr_t hwndVal = 0;
        if (GetJsonHwnd(line, "hwnd", hwndVal)) {
            HWND h = (HWND)hwndVal;
            if (h && IsWindow(h)) {
                DisableWindowTransitions(h);
                ForceSetForeground(h);
            }
            std::lock_guard<std::mutex> lock(g_outputMutex);
            std::cout << "{\"type\":\"action_ack\",\"action\":\"set_foreground\",\"hwnd\":" << hwndVal << "}" << std::endl;
        }
    }
    else if (line.find("\"cmd\":\"lower_launcher\"") != std::string::npos) {
        std::lock_guard<std::mutex> lock(g_outputMutex);
        std::cout << "{\"type\":\"action_ack\",\"action\":\"lower_launcher\"}" << std::endl;
    }
    else if (line.find("\"cmd\":\"raise_launcher\"") != std::string::npos) {
        if (g_launcherHwnd && IsWindow(g_launcherHwnd)) {
            HWND r = GetAncestor(g_launcherHwnd, GA_ROOT);
            if (!r) r = g_launcherHwnd;
            ForceSetForeground(r);
        }
        std::lock_guard<std::mutex> lock(g_outputMutex);
        std::cout << "{\"type\":\"action_ack\",\"action\":\"raise_launcher\"}" << std::endl;
    }
    else if (line.find("\"cmd\":\"raise_homebar\"") != std::string::npos) {
        KeepHomebarAbove();
    }
    else if (line.find("\"cmd\":\"maximize\"") != std::string::npos) {
        uintptr_t hwndVal = 0;
        if (GetJsonHwnd(line, "hwnd", hwndVal)) {
            HWND h = (HWND)hwndVal;
            DisableWindowTransitions(h);
            ShowWindow(h, SW_SHOW);
            ShowWindow(h, SW_MAXIMIZE);
            SetForegroundWindow(h);
            std::lock_guard<std::mutex> lock(g_outputMutex);
            std::cout << "{\"type\":\"action_ack\",\"action\":\"maximize\",\"hwnd\":" << hwndVal << "}" << std::endl;
        }
    }
    else if (line.find("\"cmd\":\"minimize_all\"") != std::string::npos) {
        g_splitActive = false;
        g_splitHwnds.clear();
        std::vector<WindowInfo> wins = EnumerateWindows();
        for (const auto& w : wins) {
            if (!IsLauncherOrHomebar(w.hwnd)) {
                DisableWindowTransitions(w.hwnd);
                ShowWindowAsync(w.hwnd, SW_MINIMIZE);
            }
        }
        if (g_launcherHwnd) {
            HWND r = GetAncestor(g_launcherHwnd, GA_ROOT);
            if (!r) r = g_launcherHwnd;
            ForceSetForeground(r);
        }
        std::lock_guard<std::mutex> lock(g_outputMutex);
        std::cout << "{\"type\":\"action_ack\",\"action\":\"minimize_all\"}" << std::endl;
    }
    else if (line.find("\"cmd\":\"set_cpu_mode\"") != std::string::npos) {
        double tPid = 0;
        GetJsonNumber(line, "targetPid", tPid);
        DWORD pid = (DWORD)tPid;
        if (line.find("\"mode\":\"launch\"") != std::string::npos) {
            OptimizeCpuForLaunch(pid);
        } else if (line.find("\"mode\":\"app_active\"") != std::string::npos) {
            OptimizeCpuForAppActive(pid);
        } else if (line.find("\"mode\":\"exit_anim\"") != std::string::npos) {
            OptimizeCpuForExitAnim(pid);
        } else if (line.find("\"mode\":\"idle\"") != std::string::npos) {
            ResetCpuPriorities();
        }
        std::lock_guard<std::mutex> lock(g_outputMutex);
        std::cout << "{\"type\":\"action_ack\",\"action\":\"set_cpu_mode\"}" << std::endl;
    }
    else if (line.find("\"cmd\":\"hide_taskbar\"") != std::string::npos) {
        SetTaskbarVisible(false);
        std::lock_guard<std::mutex> lock(g_outputMutex);
        std::cout << "{\"type\":\"taskbar_state\",\"hidden\":true}" << std::endl;
    }
    else if (line.find("\"cmd\":\"show_taskbar\"") != std::string::npos) {
        SetTaskbarVisible(true);
        std::lock_guard<std::mutex> lock(g_outputMutex);
        std::cout << "{\"type\":\"taskbar_state\",\"hidden\":false}" << std::endl;
    }
    else if (line.find("\"cmd\":\"set_launcher_hwnd\"") != std::string::npos) {
        uintptr_t hwndVal = 0;
        if (GetJsonHwnd(line, "hwnd", hwndVal)) {
            g_launcherHwnd = (HWND)hwndVal;
            ForceSetForeground(g_launcherHwnd);
        }
    }
    else if (line.find("\"cmd\":\"set_homebar_hwnd\"") != std::string::npos) {
        uintptr_t hwndVal = 0;
        if (GetJsonHwnd(line, "hwnd", hwndVal)) {
            g_homeBarHwnd = (HWND)hwndVal;
        }
    }
    else if (line.find("\"cmd\":\"set_launcher_pid\"") != std::string::npos) {
        double pVal = 0;
        if (GetJsonNumber(line, "pid", pVal)) {
            g_launcherPid = (DWORD)pVal;
        }
    }
    else if (line.find("\"cmd\":\"set_window_rect\"") != std::string::npos) {
        uintptr_t hVal = 0;
        double xVal = 0, yVal = 0, wVal = 0, hValDim = 0;
        if (GetJsonHwnd(line, "hwnd", hVal) &&
            GetJsonNumber(line, "x", xVal) &&
            GetJsonNumber(line, "y", yVal) &&
            GetJsonNumber(line, "w", wVal) &&
            GetJsonNumber(line, "h", hValDim)) {
            HWND h = (HWND)hVal;
            if (IsIconic(h)) ShowWindow(h, SW_RESTORE);
            if (IsZoomed(h)) ShowWindow(h, SW_RESTORE);
            SetWindowPos(h, HWND_TOP, (int)xVal, (int)yVal, (int)wVal, (int)hValDim, SWP_SHOWWINDOW | SWP_FRAMECHANGED | SWP_ASYNCWINDOWPOS);
            std::lock_guard<std::mutex> lock(g_outputMutex);
            std::cout << "{\"type\":\"action_ack\",\"action\":\"set_window_rect\",\"hwnd\":" << hVal << "}" << std::endl;
        }
    }
    else if (line.find("\"cmd\":\"snap_windows\"") != std::string::npos) {
        size_t cur = line.find("\"windows\":[");
        if (cur != std::string::npos) {
            g_splitHwnds.clear();
            g_splitActive = true;
            size_t objPos = line.find('{', cur);
            while (objPos != std::string::npos) {
                size_t objEnd = line.find('}', objPos);
                if (objEnd == std::string::npos) break;
                std::string sub = line.substr(objPos, objEnd - objPos + 1);
                uintptr_t hVal = 0;
                double xVal = 0, yVal = 0, wVal = 0, hValDim = 0;
                if (GetJsonHwnd(sub, "hwnd", hVal) &&
                    GetJsonNumber(sub, "x", xVal) &&
                    GetJsonNumber(sub, "y", yVal) &&
                    GetJsonNumber(sub, "w", wVal) &&
                    GetJsonNumber(sub, "h", hValDim)) {
                    HWND h = (HWND)hVal;
                    g_splitHwnds.push_back(h);
                    if (IsIconic(h)) ShowWindow(h, SW_RESTORE);
                    if (IsZoomed(h)) ShowWindow(h, SW_RESTORE);
                    SetWindowPos(h, HWND_TOP, (int)xVal, (int)yVal, (int)wVal, (int)hValDim, SWP_SHOWWINDOW | SWP_FRAMECHANGED | SWP_ASYNCWINDOWPOS);
                    SetForegroundWindow(h);
                }
                objPos = line.find('{', objEnd + 1);
            }
            std::lock_guard<std::mutex> lock(g_outputMutex);
            std::cout << "{\"type\":\"action_ack\",\"action\":\"snap_windows\",\"count\":" << g_splitHwnds.size() << "}" << std::endl;
        }
    }
    else if (line.find("\"cmd\":\"set_split_mode\"") != std::string::npos) {
        g_splitActive = (line.find("\"active\":true") != std::string::npos);
        if (!g_splitActive) {
            g_splitHwnds.clear();
        }
        std::lock_guard<std::mutex> lock(g_outputMutex);
        std::cout << "{\"type\":\"action_ack\",\"action\":\"set_split_mode\",\"active\":" << (g_splitActive ? "true" : "false") << "}" << std::endl;
    }
    else if (line.find("\"cmd\":\"set_auto_maximize\"") != std::string::npos) {
        g_autoMaximize = (line.find("\"enabled\":true") != std::string::npos);
        std::lock_guard<std::mutex> lock(g_outputMutex);
        std::cout << "{\"type\":\"action_ack\",\"action\":\"set_auto_maximize\",\"enabled\":" << (g_autoMaximize ? "true" : "false") << "}" << std::endl;
    }
    else if (line.find("\"cmd\":\"get_stats\"") != std::string::npos) {
        double cpu = GetCpuUsage();
        MEMORYSTATUSEX mem;
        mem.dwLength = sizeof(mem);
        GlobalMemoryStatusEx(&mem);
        double ramPct = (double)mem.dwMemoryLoad;
        double ramTotalGB = (double)mem.ullTotalPhys / (1024.0 * 1024.0 * 1024.0);
        double ramUsedGB = (double)(mem.ullTotalPhys - mem.ullAvailPhys) / (1024.0 * 1024.0 * 1024.0);
        SYSTEM_POWER_STATUS pwr;
        GetSystemPowerStatus(&pwr);
        int batteryPct = (pwr.BatteryLifePercent != 255) ? pwr.BatteryLifePercent : 100;
        bool isCharging = (pwr.ACLineStatus == 1);
        std::ostringstream ss;
        ss << "{\"type\":\"system_stats\","
           << "\"cpu\":" << std::fixed << std::setprecision(1) << cpu << ","
           << "\"ramPct\":" << std::fixed << std::setprecision(1) << ramPct << ","
           << "\"ramUsedGB\":" << std::fixed << std::setprecision(2) << ramUsedGB << ","
           << "\"ramTotalGB\":" << std::fixed << std::setprecision(1) << ramTotalGB << ","
           << "\"battery\":" << batteryPct << ","
           << "\"isCharging\":" << (isCharging ? "true" : "false")
           << "}";
        std::lock_guard<std::mutex> lock(g_outputMutex);
        std::cout << ss.str() << std::endl;
    }
    else if (line.find("\"cmd\":\"exit\"") != std::string::npos) {
        SetTaskbarVisible(true);
        SetWindowsAnimationEnabled(true);
        ResetCpuPriorities();
        exit(0);
    }
}
BOOL WINAPI ConsoleHandler(DWORD ctrlType) {
    if (g_mainThreadId) PostThreadMessage(g_mainThreadId, WM_QUIT, 0, 0);
    return TRUE;
}
int main(int argc, char** argv) {
    using DpiAwarenessFn = BOOL (WINAPI*)(HANDLE);
    auto setDpi = (DpiAwarenessFn)GetProcAddress(GetModuleHandleW(L"user32.dll"), "SetProcessDpiAwarenessContext");
    if (setDpi) setDpi((HANDLE)-4); else SetProcessDPIAware();
    if (argc > 1 && std::string(argv[1]) == "--self-test") {
        std::cout << "{\"text\":\"" << EscapeJson(L"A\\B\n\"Ứng dụng\"") << "\"}" << std::endl;
        return 0;
    }
    if (argc > 1 && std::string(argv[1]) == "--probe") {
        ProcessCommand("{\"cmd\":\"list_windows\"}");
        ProcessCommand("{\"cmd\":\"get_stats\"}");
        return 0;
    }
    AttachToDefaultDesktop();
    CoInitialize(NULL);
    ULONG_PTR gdiplusToken;
    GdiplusStartupInput gdiplusStartupInput;
    GdiplusStartup(&gdiplusToken, &gdiplusStartupInput, NULL);
    g_mainThreadId = GetCurrentThreadId();
    MSG firstMessage; PeekMessage(&firstMessage, NULL, 0, 0, PM_NOREMOVE);
    SetConsoleCtrlHandler(ConsoleHandler, TRUE);
    SetWindowsAnimationEnabled(false);
    SetTaskbarVisible(false);
    g_hHook = SetWinEventHook(
        EVENT_SYSTEM_FOREGROUND,
        EVENT_OBJECT_LOCATIONCHANGE,
        NULL,
        WinEventProc,
        0, 0,
        WINEVENT_OUTOFCONTEXT | WINEVENT_SKIPOWNPROCESS
    );
    const DWORD mainThreadId = GetCurrentThreadId();
    MSG initialMessage; PeekMessage(&initialMessage, NULL, 0, 0, PM_NOREMOVE);
    std::thread inputThread([mainThreadId]() {
        std::string line;
        while (std::getline(std::cin, line)) {
            auto command = new std::string(line);
            if (!PostThreadMessage(mainThreadId, WM_APP + 1, 0, (LPARAM)command)) delete command;
        }
        PostThreadMessage(mainThreadId, WM_QUIT, 0, 0);
    });
    std::thread watchdogThread([]() {
        AttachToDefaultDesktop();
        while (g_running) {
            std::this_thread::sleep_for(std::chrono::milliseconds(350));
            if (g_taskbarHidden) {
                HWND hTaskbar = FindWindowW(L"Shell_TrayWnd", NULL);
                if (hTaskbar && IsWindowVisible(hTaskbar)) {
                    ShowWindow(hTaskbar, SW_HIDE);
                }
                HWND hSecTaskbar = FindWindowW(L"Shell_SecondaryTrayWnd", NULL);
                while (hSecTaskbar) {
                    if (IsWindowVisible(hSecTaskbar)) {
                        ShowWindow(hSecTaskbar, SW_HIDE);
                    }
                    hSecTaskbar = FindWindowExW(NULL, hSecTaskbar, L"Shell_SecondaryTrayWnd", NULL);
                }
            }
        }
    });
    {
        std::lock_guard<std::mutex> lock(g_outputMutex);
        std::cout << "{\"type\":\"bridge_ready\"}" << std::endl;
    }
    MSG msg;
    while (GetMessage(&msg, NULL, 0, 0) > 0) {
        if (msg.message == WM_APP + 1) {
            std::unique_ptr<std::string> command((std::string*)msg.lParam);
            if (*command == "{\"cmd\":\"exit\"}") break;
            ProcessCommand(*command);
        } else { TranslateMessage(&msg); DispatchMessage(&msg); }
    }
    g_running = false;
    watchdogThread.join();
    inputThread.detach();
    SetTaskbarVisible(true);
    SetWindowsAnimationEnabled(true);
    ResetCpuPriorities();
    if (g_hHook) UnhookWinEvent(g_hHook);
    GdiplusShutdown(gdiplusToken);
    CoUninitialize();
    return 0;
}