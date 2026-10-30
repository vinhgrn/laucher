#define _WIN32_WINNT 0x0601
#define UNICODE
#define _UNICODE
#define COBJMACROS
#include <windows.h>
#include <shlobj.h>
#include <shellapi.h>
#include <commctrl.h>
#include <commoncontrols.h>
#include <knownfolders.h>
#include <gdiplus.h>
#include <iostream>
#include <string>
using namespace Gdiplus;
#pragma comment(lib, "gdiplus.lib")
#pragma comment(lib, "shell32.lib")
#pragma comment(lib, "ole32.lib")
#pragma comment(lib, "user32.lib")
#pragma comment(lib, "gdi32.lib")
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
bool SaveBitmapToPngCrisp(Bitmap* pSourceBmp, const std::wstring& outPngPath, int desiredSize = 256) {
    if (!pSourceBmp) return false;
    CLSID clsid;
    if (GetEncoderClsid(L"image/png", &clsid) == -1) return false;
    int w = pSourceBmp->GetWidth();
    int h = pSourceBmp->GetHeight();
    if (w <= 0 || h <= 0) return false;
    if (w >= desiredSize && h >= desiredSize) {
        Status s = pSourceBmp->Save(outPngPath.c_str(), &clsid, NULL);
        return (s == Ok);
    }
    Bitmap canvas(desiredSize, desiredSize, PixelFormat32bppARGB);
    Graphics g(&canvas);
    g.SetInterpolationMode(InterpolationModeHighQualityBicubic);
    g.SetSmoothingMode(SmoothingModeHighQuality);
    g.SetPixelOffsetMode(PixelOffsetModeHighQuality);
    int targetW = desiredSize;
    int targetH = (int)((double)h * (double)desiredSize / (double)w);
    if (targetH > desiredSize) {
        targetH = desiredSize;
        targetW = (int)((double)w * (double)desiredSize / (double)h);
    }
    int offX = (desiredSize - targetW) / 2;
    int offY = (desiredSize - targetH) / 2;
    g.DrawImage(pSourceBmp, offX, offY, targetW, targetH);
    Status s = canvas.Save(outPngPath.c_str(), &clsid, NULL);
    return (s == Ok);
}
bool SaveHIconToPngCrisp(HICON hIcon, const std::wstring& outPngPath, int desiredSize = 256) {
    if (!hIcon) return false;
    Bitmap* pBmp = Bitmap::FromHICON(hIcon);
    bool ok = false;
    if (pBmp) {
        ok = SaveBitmapToPngCrisp(pBmp, outPngPath, desiredSize);
        delete pBmp;
    }
    DestroyIcon(hIcon);
    return ok;
}
bool ExtractJumboIcon(const std::wstring& path, const std::wstring& outPngPath) {
    SHFILEINFOW sfi = {0};
    DWORD_PTR res = SHGetFileInfoW(path.c_str(), 0, &sfi, sizeof(sfi), SHGFI_SYSICONINDEX);
    if (!res) return false;
    static const IID IID_IImageList_Local = { 0x46EB5926, 0x582E, 0x4017, { 0x9F, 0xDF, 0xE8, 0x99, 0x8D, 0xAA, 0x09, 0x50 } };
    IImageList* piml = NULL;
    HRESULT hr = SHGetImageList(4, IID_IImageList_Local, (void**)&piml);
    if (FAILED(hr) || !piml) {
        hr = SHGetImageList(2, IID_IImageList_Local, (void**)&piml);
    }
    if (FAILED(hr) || !piml) return false;
    HICON hIcon = NULL;
    hr = piml->GetIcon(sfi.iIcon, ILD_TRANSPARENT, &hIcon);
    piml->Release();
    if (SUCCEEDED(hr) && hIcon) {
        return SaveHIconToPngCrisp(hIcon, outPngPath, 256);
    }
    return false;
}
bool ExtractViaShellItemImageFactory(const std::wstring& target, const std::wstring& outPngPath) {
    IShellItem* pItem = NULL;
    HRESULT hr = E_FAIL;
    std::wstring cleanAppId = target;
    if (cleanAppId.find(L"shell:AppsFolder\\") == 0) {
        cleanAppId = cleanAppId.substr(17);
    }
    hr = SHCreateItemInKnownFolder(FOLDERID_AppsFolder, 0, cleanAppId.c_str(), IID_IShellItem, (void**)&pItem);
    if (FAILED(hr) || !pItem) {
        hr = SHCreateItemFromParsingName(target.c_str(), NULL, IID_IShellItem, (void**)&pItem);
    }
    if (FAILED(hr) || !pItem) {
        std::wstring shellPath = L"shell:AppsFolder\\" + cleanAppId;
        hr = SHCreateItemFromParsingName(shellPath.c_str(), NULL, IID_IShellItem, (void**)&pItem);
    }
    if (FAILED(hr) || !pItem) return false;
    IShellItemImageFactory* pFactory = NULL;
    hr = pItem->QueryInterface(IID_IShellItemImageFactory, (void**)&pFactory);
    pItem->Release();
    if (FAILED(hr) || !pFactory) return false;
    SIZE sz = { 256, 256 };
    HBITMAP hBmp = NULL;
    hr = pFactory->GetImage(sz, 0x1 | 0x8 | 0x4, &hBmp);
    if (FAILED(hr) || !hBmp) {
        hr = pFactory->GetImage(sz, 0x1 | 0x8, &hBmp);
    }
    if (FAILED(hr) || !hBmp) {
        hr = pFactory->GetImage(sz, 0x0, &hBmp);
    }
    pFactory->Release();
    if (FAILED(hr) || !hBmp) return false;
    Bitmap bmp(hBmp, NULL);
    bool ok = SaveBitmapToPngCrisp(&bmp, outPngPath, 256);
    DeleteObject(hBmp);
    return ok;
}
bool ExtractFromShellFileInfo(const std::wstring& path, const std::wstring& outPngPath) {
    SHFILEINFOW sfi = {0};
    DWORD_PTR res = SHGetFileInfoW(path.c_str(), 0, &sfi, sizeof(sfi), SHGFI_ICON | SHGFI_LARGEICON);
    if (res && sfi.hIcon) {
        return SaveHIconToPngCrisp(sfi.hIcon, outPngPath, 256);
    }
    return false;
}
bool ExtractViaExtractIcon(const std::wstring& path, const std::wstring& outPngPath) {
    HICON hLarge = NULL;
    HICON hSmall = NULL;
    UINT num = ExtractIconExW(path.c_str(), 0, &hLarge, &hSmall, 1);
    if (num > 0 && hLarge) {
        if (hSmall) DestroyIcon(hSmall);
        return SaveHIconToPngCrisp(hLarge, outPngPath, 256);
    }
    if (num > 0 && hSmall) {
        return SaveHIconToPngCrisp(hSmall, outPngPath, 256);
    }
    return false;
}
int wmain(int argc, wchar_t* argv[]) {
    if (argc < 3) {
        std::wcout << L"Usage: icon_extractor <target> <out_png>" << std::endl;
        return 1;
    }
    CoInitializeEx(NULL, COINIT_APARTMENTTHREADED);
    ULONG_PTR gdiplusToken;
    GdiplusStartupInput gdiplusStartupInput;
    GdiplusStartup(&gdiplusToken, &gdiplusStartupInput, NULL);
    std::wstring target = argv[1];
    std::wstring outPath = argv[2];
    bool ok = false;
    bool isFilePath = (target.find(L":\\") != std::wstring::npos) || (target.find(L"\\\\") == 0);
    if (!isFilePath) {
        wchar_t resolved[MAX_PATH] = {0};
        if (SearchPathW(NULL, target.c_str(), L".exe", MAX_PATH, resolved, NULL)) {
            target = resolved;
            isFilePath = true;
        }
    }
    if (isFilePath) {
        ok = ExtractJumboIcon(target, outPath);
        if (!ok) ok = ExtractViaShellItemImageFactory(target, outPath);
        if (!ok) ok = ExtractFromShellFileInfo(target, outPath);
        if (!ok) ok = ExtractViaExtractIcon(target, outPath);
    } else {
        ok = ExtractViaShellItemImageFactory(target, outPath);
        if (!ok) ok = ExtractJumboIcon(target, outPath);
        if (!ok) ok = ExtractFromShellFileInfo(target, outPath);
    }
    GdiplusShutdown(gdiplusToken);
    CoUninitialize();
    return ok ? 0 : 2;
}