#!/usr/bin/env python3
import sys, zipfile, struct

def verify_aab(aab_path):
    print(f"=== Checking 16 KB Page Size Alignment for: {aab_path} ===")
    total = 0
    unaligned = 0
    with zipfile.ZipFile(aab_path, 'r') as z:
        for name in sorted(z.namelist()):
            if name.endswith('.so') and ('arm64' in name or 'x86_64' in name):
                data = z.read(name)
                if len(data) >= 64 and data[:4] == b'\x7fELF' and data[4] == 2:
                    total += 1
                    e_phoff = struct.unpack('<Q', data[32:40])[0]
                    e_phentsize = struct.unpack('<H', data[54:56])[0]
                    e_phnum = struct.unpack('<H', data[56:58])[0]
                    max_align = 0
                    for i in range(e_phnum):
                        ph = data[e_phoff + i*e_phentsize : e_phoff + (i+1)*e_phentsize]
                        p_type = struct.unpack('<I', ph[:4])[0]
                        if p_type == 1: # PT_LOAD
                            p_align = struct.unpack('<Q', ph[48:56])[0]
                            max_align = max(max_align, p_align)
                    if max_align < 16384:
                        print(f"❌ UNALIGNED ({max_align}): {name}")
                        unaligned += 1
                    else:
                        print(f"✅ ALIGNED ({max_align}): {name}")
    print(f"=== Total 64-bit .so checked: {total}, Unaligned: {unaligned} ===")
    return unaligned == 0

if __name__ == '__main__':
    path = sys.argv[1] if len(sys.argv) > 1 else '/Users/paulolin/Projects/orcapronto-v1.0.0-final.aab'
    success = verify_aab(path)
    sys.exit(0 if success else 1)
