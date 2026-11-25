#!/usr/bin/env python3
"""Verify genuine 16 KB page-size ELF compliance for all 64-bit .so libs in an AAB."""
import struct
import sys
import zipfile

PAGE_SIZE_16K = 16384
PAGE_MASK_16K = ~(PAGE_SIZE_16K - 1)


def inspect_elf64(data):
    """Return (reasons, min_align) for a 64-bit ELF binary."""
    e_phoff = struct.unpack('<Q', data[32:40])[0]
    e_phentsize = struct.unpack('<H', data[54:56])[0]
    e_phnum = struct.unpack('<H', data[56:58])[0]

    loads = []
    reasons = []
    min_align = None

    for i in range(e_phnum):
        ph = data[e_phoff + i * e_phentsize : e_phoff + (i + 1) * e_phentsize]
        if len(ph) < 56:
            continue
        p_type = struct.unpack('<I', ph[:4])[0]
        if p_type != 1:  # PT_LOAD
            continue
        p_offset = struct.unpack('<Q', ph[8:16])[0]
        p_vaddr = struct.unpack('<Q', ph[16:24])[0]
        p_memsz = struct.unpack('<Q', ph[40:48])[0]
        p_align = struct.unpack('<Q', ph[48:56])[0]

        min_align = p_align if min_align is None else min(min_align, p_align)
        if p_align < PAGE_SIZE_16K:
            reasons.append(f'PT_LOAD[{i}] align={p_align} < {PAGE_SIZE_16K}')
        if p_align > 0 and (p_offset % p_align) != (p_vaddr % p_align):
            reasons.append(
                f'PT_LOAD[{i}] invalid mod align: off%align={p_offset % p_align} != vaddr%align={p_vaddr % p_align}'
            )
        if p_memsz > 0:
            loads.append((p_vaddr, p_memsz, i))

    loads.sort(key=lambda item: item[0])
    for idx in range(1, len(loads)):
        prev_vaddr, prev_memsz, prev_i = loads[idx - 1]
        curr_vaddr, _, curr_i = loads[idx]
        prev_last_page = (prev_vaddr + prev_memsz - 1) & PAGE_MASK_16K
        curr_first_page = curr_vaddr & PAGE_MASK_16K
        if prev_last_page >= curr_first_page:
            reasons.append(
                f'16KB page overlap: PT_LOAD[{prev_i}] end page {hex(prev_last_page)} >= PT_LOAD[{curr_i}] start page {hex(curr_first_page)}'
            )

    return reasons, (min_align or 0)


def verify_aab(aab_path):
    print(f'=== Checking Genuine 16 KB ELF Compliance for: {aab_path} ===')
    total = 0
    unaligned = 0
    invalid_mod = 0
    overlapping = 0
    failed = 0

    with zipfile.ZipFile(aab_path, 'r') as z:
        for name in sorted(z.namelist()):
            if not (name.endswith('.so') and ('arm64-v8a' in name or 'x86_64' in name)):
                continue
            data = z.read(name)
            if len(data) < 64 or data[:4] != b'\x7fELF' or data[4] != 2:
                continue
            total += 1
            reasons, min_align = inspect_elf64(data)
            if reasons:
                failed += 1
                if any('align=' in r for r in reasons):
                    unaligned += 1
                if any('invalid mod align' in r for r in reasons):
                    invalid_mod += 1
                if any('16KB page overlap' in r for r in reasons):
                    overlapping += 1
                print(f'❌ FAIL ({min_align}): {name} -> {"; ".join(reasons)}')
            else:
                print(f'✅ PASS ({min_align}): {name}')

    print(
        f'=== Total 64-bit .so checked: {total}, Failed: {failed} '
        f'(unaligned={unaligned}, invalid_mod={invalid_mod}, overlapping={overlapping}) ==='
    )
    return total > 0 and failed == 0


if __name__ == '__main__':
    path = sys.argv[1] if len(sys.argv) > 1 else '/Users/paulolin/Projects/orcapronto-v1.0.0-final.aab'
    sys.exit(0 if verify_aab(path) else 1)
