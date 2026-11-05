#!/usr/bin/env bash
# Env minimo para eas build --local (JDK 17 + Android SDK)
export JAVA_HOME="${JAVA_HOME:-$HOME/.local/jdk-17}"
export ANDROID_HOME="${ANDROID_HOME:-$HOME/Android/Sdk}"
export ANDROID_SDK_ROOT="$ANDROID_HOME"
export PATH="$JAVA_HOME/bin:$ANDROID_HOME/platform-tools:$ANDROID_HOME/cmdline-tools/latest/bin:$PATH"

if ! command -v java >/dev/null; then
  echo "Java nao encontrado em $JAVA_HOME" >&2
  exit 1
fi
if [[ ! -d "$ANDROID_HOME/platforms" ]]; then
  echo "Android SDK nao encontrado em $ANDROID_HOME" >&2
  exit 1
fi

echo "JAVA_HOME=$JAVA_HOME"
echo "ANDROID_HOME=$ANDROID_HOME"
java -version
exec "$@"
