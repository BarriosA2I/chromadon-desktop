import ctypes
import shutil
import os

k = ctypes.windll.kernel32

release_dir = r"C:\Users\gary\chromadon-desktop\release"

# Delete known problematic files (Windows reserved names)
for root, dirs, files in os.walk(release_dir):
    for f in files:
        if f.lower() in ('nul', 'con', 'prn', 'aux', 'com1', 'com2', 'com3', 'com4',
                          'lpt1', 'lpt2', 'lpt3', 'nul.', 'con.'):
            full = os.path.join(root, f)
            long_path = "\\\\?\\" + os.path.abspath(full)
            k.DeleteFileW(long_path)
            print(f"deleted reserved: {full}")

# Use robocopy to mirror an empty dir (handles long paths + special files)
empty = os.path.join(os.environ['TEMP'], '_empty_dir')
os.makedirs(empty, exist_ok=True)
os.system(f'robocopy "{empty}" "{release_dir}" /MIR /NFL /NDL /NJH /NJS >nul 2>&1')
os.rmdir(empty)

try:
    shutil.rmtree(release_dir, ignore_errors=True)
    if os.path.exists(release_dir):
        os.rmdir(release_dir)
    print("release dir cleaned")
except Exception as e:
    print(f"cleanup: {e}")
