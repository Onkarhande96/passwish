import os
import subprocess

def create_desktop_shortcut(target_folder=None):
    if not target_folder:
        target_folder = os.path.dirname(os.path.abspath(__file__))

    target_bat = os.path.join(target_folder, "Start_PassWish.bat")
    icon_file = os.path.join(target_folder, "passwish_icon.ico")
    
    # Locate Desktop folder
    desktop = os.path.join(os.path.expanduser("~"), "Desktop")
    shortcut_path = os.path.join(desktop, "PassWish.lnk")

    # Use native Windows VBScript WScript.Shell (works on 100% of Windows machines)
    vbs_content = f'''Set oWS = WScript.CreateObject("WScript.Shell")
sLinkFile = "{shortcut_path}"
Set oLink = oWS.CreateShortcut(sLinkFile)
oLink.TargetPath = "{target_bat}"
oLink.WorkingDirectory = "{target_folder}"
oLink.IconLocation = "{icon_file}"
oLink.Description = "PassWish - Customer CRM & Automated Wishes"
oLink.Save
'''
    vbs_file = os.path.join(target_folder, "_temp_shortcut.vbs")
    try:
        with open(vbs_file, "w", encoding="utf-8") as f:
            f.write(vbs_content)

        subprocess.run(["cscript", "//nologo", vbs_file], shell=True, check=True)
    except Exception as e:
        print(f"[!] Warning: Could not create shortcut via VBScript: {e}")
    finally:
        if os.path.exists(vbs_file):
            try:
                os.remove(vbs_file)
            except Exception:
                pass

    return os.path.exists(shortcut_path)

if __name__ == '__main__':
    ok = create_desktop_shortcut()
    if ok:
        print("[+] SUCCESS: PassWish shortcut with custom icon created on Desktop!")
    else:
        print("[-] FAILED to create shortcut on Desktop.")
