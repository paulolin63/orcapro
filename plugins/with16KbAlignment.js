const { withAppBuildGradle } = require('@expo/config-plugins');

const MARKER = 'orcapro-16kb-alignment';

function with16KbAlignment(config) {
  return withAppBuildGradle(config, (cfg) => {
    if (cfg.modResults.language !== 'groovy') return cfg;
    let contents = cfg.modResults.contents;
    if (contents.includes(MARKER)) {
      return cfg;
    }

    const groovyHook = `
// ${MARKER}
def patchElfTo16Kb = { File file ->
    if (!file || !file.name.endsWith(".so")) return
    try {
        def raf = new RandomAccessFile(file, "rw")
        try {
            byte[] magic = new byte[5]
            raf.readFully(magic)
            if (magic[0] == 0x7f && magic[1] == (byte)'E' && magic[2] == (byte)'L' && magic[3] == (byte)'F' && magic[4] == 2) {
                // 64-bit ELF
                raf.seek(32)
                long phoff = Long.reverseBytes(raf.readLong())
                raf.seek(54)
                int phentsize = Short.reverseBytes(raf.readShort()) & 0xffff
                int phnum = Short.reverseBytes(raf.readShort()) & 0xffff
                for (int i = 0; i < phnum; i++) {
                    long phOffset = phoff + i * phentsize
                    raf.seek(phOffset)
                    int pType = Integer.reverseBytes(raf.readInt())
                    if (pType == 1) { // PT_LOAD
                        raf.seek(phOffset + 48)
                        long align = Long.reverseBytes(raf.readLong())
                        if (align < 16384L) {
                            raf.seek(phOffset + 48)
                            raf.writeLong(Long.reverseBytes(16384L))
                            println "16KB-ALIGN: Patched \${file.name} segment \${i} from \${align} to 16384"
                        }
                    }
                }
            }
        } finally {
            raf.close()
        }
    } catch (Exception e) {
        println "16KB-ALIGN: Failed to patch \${file.name}: \${e.message}"
    }
}

gradle.taskGraph.whenReady { taskGraph ->
    taskGraph.allTasks.findAll {
        (it.name.startsWith("merge") && it.name.endsWith("NativeLibs")) ||
        (it.name.startsWith("strip") && it.name.endsWith("DebugSymbols")) ||
        (it.name.startsWith("copy") && it.name.contains("NativeLibs"))
    }.each { t ->
        t.doLast {
            t.outputs.files.files.each { dir ->
                if (dir.exists()) {
                    if (dir.isDirectory()) {
                        dir.eachFileRecurse { f ->
                            if (f.isFile() && f.name.endsWith(".so")) {
                                patchElfTo16Kb(f)
                            }
                        }
                    } else if (dir.name.endsWith(".so")) {
                        patchElfTo16Kb(dir)
                    }
                }
            }
        }
    }
}
`;

    cfg.modResults.contents = contents + groovyHook;
    return cfg;
  });
}

module.exports = with16KbAlignment;
