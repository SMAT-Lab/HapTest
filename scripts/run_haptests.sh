#!/usr/bin/env bash
set -uo pipefail

# 超时时间（秒），可通过环境变量覆盖，例如：
# TIMEOUT_SECS=300 ./run_haptests.sh
TIMEOUT_SECS="${TIMEOUT_SECS:-600}"

# 在下面的数组中按顺序添加要执行的命令（每条一行）。
# 保持格式为: node bin/haptest -i com.huawei.hmos.* -o out/*

# 万兴喵影（剪辑软件逻辑太复杂无法测试）"node bin/haptest -i cn.wondershare.filmora.2in1 -o out/2in1/wondershare"
  # 钉钉（暂时无法登陆）"node bin/haptest -i com.dingtalk.hmos.pc -o out/2in1/dingtalk"
COMMANDS=(
  #"node bin/haptest -i cn.wps.office.hap -o out/2in1/wps"
  "node bin/haptest -i com.eastmoney.emapp -o out/2in1/eastmoney"
  "node bin/haptest -i com.edrawsoft.edrawmax.pc -o out/2in1/edrawsoft_edrawmax"
  "node bin/haptest -i com.edrawsoft.mindmaster.pc -o out/2in1/edrawsoft_mindmaster"
  "node bin/haptest -i com.example.first -o out/2in1/example_first"
  "node bin/haptest -i com.example.memoryleak -o out/2in1/example_memoryleak"
  "node bin/haptest -i com.foxit.foxitpdfeditor -o out/2in1/foxitpdfeditor"
  "node bin/haptest -i com.haitai.htbrowser -o out/2in1/haitai_htbrowser"
  "node bin/haptest -i com.haozip2345.app -o out/2in1/haozip2345"
  "node bin/haptest -i com.hos.moonshot.kimichat -o out/2in1/moonshot_kimichat"
  "node bin/haptest -i com.hp.printercontrol.china -o out/2in1/hp_printercontrol"
  "node bin/haptest -i com.oray.sunloginclient -o out/2in1/oray_sunloginclient"
  "node bin/haptest -i com.quark.ohosbrowser -o out/2in1/quark_ohosbrowser"
  "node bin/haptest -i com.renyitu.pumpkinssh -o out/2in1/renyitu_pumpkinssh"
  "node bin/haptest -i com.ss.ohpc.ugc.aweme -o out/2in1/ss_ohpc_ugc_aweme"
  "node bin/haptest -i com.tencent.harmonyqq -o out/2in1/harmonyqq"
  "node bin/haptest -i com.tencent.wechat.pc -o out/2in1/wechat"
  "node bin/haptest -i com.usb.right -o out/2in1/usb_right"
  "node bin/haptest -i com.wifiservice.portallogin -o out/2in1/wifiservice_portallogin"
  "node bin/haptest -i com.xunlei.thunder -o out/2in1/xunlei_thunder"
  "node bin/haptest -i com.xunlei.xmp -o out/2in1/xunlei_xmp"
  "node bin/haptest -i com.zhihu.hmos -o out/2in1/zhihu"
  "node bin/haptest -i com.zuler.ohospc.todesk -o out/2in1/zuler_ohospc_todesk"
  "node bin/haptest -i com.zwsoft.zwcad.PE -o out/2in1/zwsoft_zwcad"
  "node bin/haptest -i yylx.danmaku.bili -o out/2in1/yylx_danmaku_bili"
)


run_with_timeout() {
  local cmd="$1"

  # Prefer coreutils `timeout` if available
  if command -v timeout >/dev/null 2>&1; then
    timeout "${TIMEOUT_SECS}" bash -c "$cmd"
    return $?
  fi

  # Fallback implementation using background process and manual kill
  bash -c "$cmd" &
  local pid=$!
  local start_ts
  start_ts=$(date +%s)

  while kill -0 "$pid" >/dev/null 2>&1; do
    sleep 1
    local now
    now=$(date +%s)
    local elapsed=$((now - start_ts))
    if [ "$elapsed" -ge "$TIMEOUT_SECS" ]; then
      echo "Timeout (${TIMEOUT_SECS}s) reached for PID $pid, terminating..."
      kill -TERM "$pid" >/dev/null 2>&1 || true
      sleep 2
      kill -KILL "$pid" >/dev/null 2>&1 || true
      wait "$pid" 2>/dev/null || true
      return 124
    fi
  done

  wait "$pid"
  return $?
}

for cmd in "${COMMANDS[@]}"; do
  if [[ -z "$cmd" ]]; then
    continue
  fi

  echo "Running: $cmd (timeout ${TIMEOUT_SECS}s)"
  run_with_timeout "$cmd"
  rc=$?

  if [ $rc -eq 0 ]; then
    echo "Command finished successfully."
  elif [ $rc -eq 124 ]; then
    echo "Command timed out after ${TIMEOUT_SECS}s — retrying once..."
    # retry once
    run_with_timeout "$cmd"
    rc2=$?
    if [ $rc2 -eq 0 ]; then
      echo "Retry succeeded."
    elif [ $rc2 -eq 124 ]; then
      echo "Retry also timed out after ${TIMEOUT_SECS}s — skipping to next."
    else
      echo "Retry exited with status $rc2 — continuing to next."
    fi
  else
    echo "Command exited with status $rc — continuing to next."
  fi
done

# 处理 JSON 文件并生成结构化输出
for json_file in events/*.json; do
    if [[ -f "$json_file" ]]; then
        node scripts/format_and_analyze.js "$json_file"
    fi
done

echo "All commands finished."
