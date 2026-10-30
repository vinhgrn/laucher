#define UNICODE
#define _UNICODE
#include <windows.h>
#include <wlanapi.h>
#include <bluetoothapis.h>
#include <mmdeviceapi.h>
#include <endpointvolume.h>
#include <iostream>
#include <string>
#include <sstream>
#include <cstdlib>
std::string json(const std::wstring& value) {
    if (value.empty()) return "\"\"";
    int n = WideCharToMultiByte(CP_UTF8, 0, value.data(), (int)value.size(), nullptr, 0, nullptr, nullptr);
    std::string utf8(n, 0); WideCharToMultiByte(CP_UTF8, 0, value.data(), (int)value.size(), &utf8[0], n, nullptr, nullptr);
    std::ostringstream out; out << '"';
    for (unsigned char ch : utf8) {
        if (ch == '"' || ch == '\\') out << '\\' << ch;
        else if (ch < 32) out << ' ';
        else out << ch;
    }
    out << '"'; return out.str();
}
std::wstring text(const char* arg) {
    int size = MultiByteToWideChar(CP_UTF8, 0, arg, -1, nullptr, 0);
    std::wstring value(size, 0); MultiByteToWideChar(CP_UTF8, 0, arg, -1, &value[0], size);
    value.resize(size - 1); return value;
}
HRESULT audio(float* level, BOOL* muted, int setVolume = -1, int setMute = -1) {
    IMMDeviceEnumerator* enumerator = nullptr; IMMDevice* device = nullptr; IAudioEndpointVolume* endpoint = nullptr;
    HRESULT hr = CoCreateInstance(__uuidof(MMDeviceEnumerator), nullptr, CLSCTX_ALL,
        __uuidof(IMMDeviceEnumerator), (void**)&enumerator);
    if (SUCCEEDED(hr)) hr = enumerator->GetDefaultAudioEndpoint(eRender, eMultimedia, &device);
    if (SUCCEEDED(hr)) hr = device->Activate(__uuidof(IAudioEndpointVolume), CLSCTX_ALL, nullptr, (void**)&endpoint);
    if (SUCCEEDED(hr) && setVolume >= 0) hr = endpoint->SetMasterVolumeLevelScalar(setVolume / 100.0f, nullptr);
    if (SUCCEEDED(hr) && setMute >= 0) hr = endpoint->SetMute(setMute != 0, nullptr);
    if (SUCCEEDED(hr) && level) hr = endpoint->GetMasterVolumeLevelScalar(level);
    if (SUCCEEDED(hr) && muted) hr = endpoint->GetMute(muted);
    if (endpoint) endpoint->Release(); if (device) device->Release(); if (enumerator) enumerator->Release();
    return hr;
}
int main(int argc, char** argv) {
    CoInitializeEx(nullptr, COINIT_MULTITHREADED);
    std::string command = argc > 1 ? argv[1] : "list";
    if (command == "volume" || command == "mute") {
        int value = argc > 2 ? atoi(argv[2]) : -1;
        HRESULT hr = value < 0 || value > 100 ? E_INVALIDARG : audio(nullptr, nullptr,
            command == "volume" ? value : -1, command == "mute" ? value : -1);
        std::cout << "{\"success\":" << (SUCCEEDED(hr) ? "true" : "false") << ",\"errorCode\":" << hr << "}";
        CoUninitialize(); return 0;
    }
    HANDLE client = nullptr; DWORD version = 0;
    DWORD error = WlanOpenHandle(2, nullptr, &version, &client);
    WLAN_INTERFACE_INFO_LIST* interfaces = nullptr;
    if (!error) error = WlanEnumInterfaces(client, nullptr, &interfaces);
    if (command == "connect") {
        DWORD result = ERROR_NOT_FOUND;
        if (!error && interfaces && argc > 3) {
            std::wstring guid = text(argv[2]), profile = text(argv[3]);
            GUID target = {}; HRESULT parsed = CLSIDFromString(guid.c_str(), &target);
            if (SUCCEEDED(parsed)) {
                for (DWORD i = 0; i < interfaces->dwNumberOfItems; ++i) {
                    if (!IsEqualGUID(target, interfaces->InterfaceInfo[i].InterfaceGuid)) continue;
                    WLAN_CONNECTION_PARAMETERS params = {};
                    params.wlanConnectionMode = wlan_connection_mode_profile;
                    params.strProfile = profile.c_str(); params.dot11BssType = dot11_BSS_type_any;
                    result = WlanConnect(client, &target, &params, nullptr);
                }
            }
        }
        std::cout << "{\"success\":" << (!result ? "true" : "false") << ",\"pending\":true,\"errorCode\":" << result << "}";
    } else {
        float level = 0; BOOL muted = FALSE; HRESULT audioResult = audio(&level, &muted);
        std::cout << "{\"volume\":" << (int)(level * 100) << ",\"muted\":" << (muted ? "true" : "false")
            << ",\"audioAvailable\":" << (SUCCEEDED(audioResult) ? "true" : "false") << ",\"networks\":[";
        bool first = true;
        if (!error && interfaces) for (DWORD i = 0; i < interfaces->dwNumberOfItems; ++i) {
            WLAN_AVAILABLE_NETWORK_LIST* networks = nullptr;
            DWORD result = WlanGetAvailableNetworkList(client, &interfaces->InterfaceInfo[i].InterfaceGuid, 0, nullptr, &networks);
            if (result) { error = result; continue; }
            wchar_t guid[40]; StringFromGUID2(interfaces->InterfaceInfo[i].InterfaceGuid, guid, 40);
            for (DWORD j = 0; j < networks->dwNumberOfItems; ++j) {
                auto& net = networks->Network[j];
                std::string ssid((char*)net.dot11Ssid.ucSSID, net.dot11Ssid.uSSIDLength);
                int n = MultiByteToWideChar(CP_UTF8, 0, ssid.data(), (int)ssid.size(), nullptr, 0);
                std::wstring name(n, 0); if (n) MultiByteToWideChar(CP_UTF8, 0, ssid.data(), (int)ssid.size(), &name[0], n);
                if (!first) std::cout << ','; first = false;
                std::cout << "{\"ssid\":" << json(name) << ",\"profile\":" << json(net.strProfileName)
                    << ",\"interface\":" << json(guid) << ",\"signal\":" << net.wlanSignalQuality
                    << ",\"connected\":" << ((net.dwFlags & WLAN_AVAILABLE_NETWORK_CONNECTED) ? "true" : "false")
                    << ",\"secure\":" << (net.bSecurityEnabled ? "true" : "false") << '}';
            }
            WlanFreeMemory(networks);
        }
        std::cout << "],\"wifiError\":" << error << ",\"bluetooth\":[";
        BLUETOOTH_DEVICE_SEARCH_PARAMS params = { sizeof(params) };
        params.fReturnAuthenticated = TRUE; params.fReturnRemembered = TRUE; params.fReturnConnected = TRUE;
        BLUETOOTH_DEVICE_INFO device = { sizeof(device) };
        HBLUETOOTH_DEVICE_FIND find = BluetoothFindFirstDevice(&params, &device);
        first = true;
        if (find) {
            do {
                if (!first) std::cout << ','; first = false;
                std::cout << "{\"name\":" << json(device.szName) << ",\"connected\":" << (device.fConnected ? "true" : "false") << '}';
                device.dwSize = sizeof(device);
            } while (BluetoothFindNextDevice(find, &device));
            BluetoothFindDeviceClose(find);
        }
        std::cout << "]}";
    }
    if (interfaces) WlanFreeMemory(interfaces);
    if (client) WlanCloseHandle(client, nullptr);
    CoUninitialize(); return 0;
}