#!/usr/bin/env bash
set -uo pipefail

# 超时时间（秒），可通过环境变量覆盖，例如：
# TIMEOUT_SECS=300 ./run_haptests.sh
TIMEOUT_SECS="${TIMEOUT_SECS:-600}"

# 在下面的数组中按顺序添加要执行的命令（每条一行）。
# 保持格式为: node bin/haptest -i com.huawei.hmos.* -o out/*

COMMANDS=(
  #"node bin/haptest -i cn.wps.office.hap -o out/2in1/cn_wps_office_hap"
  	"node bin/haptest -i cn.damai.hongmeng -o out/2in1/cn_damai_hongmeng"
	"node bin/haptest -i cn.gov.tax.its.hm -o out/2in1/cn_gov_tax_its_hm"
	# "node bin/haptest -i cn.icheny.wechat -o out/2in1/cn_icheny_wechat"
	"node bin/haptest -i cn.wps.2in1office.hap -o out/2in1/cn_wps_2in1office_hap"
	# "node bin/haptest -i com.100mi.ddmc -o out/2in1/com_100mi_ddmc"
	# "node bin/haptest -i com.airchina.harmonynext -o out/2in1/com_airchina_harmonynext"
	"node bin/haptest -i com.alibaba.wireless_hmos -o out/2in1/com_alibaba_wireless_hmos"
	# "node bin/haptest -i com.alipay.2in1.client -o out/2in1/com_alipay_2in1_client"
	# "node bin/haptest -i com.amap.hmapp -o out/2in1/com_amap_hmapp"
	"node bin/haptest -i com.anjuke.home -o out/2in1/com_anjuke_home"
	# "node bin/haptest -i com.app.xt.retouch -o out/2in1/com_app_xt_retouch"
	# "node bin/haptest -i com.autohome.main -o out/2in1/com_autohome_main"
	"node bin/haptest -i com.baicizhan.bcz.hm -o out/2in1/com_baicizhan_bcz_hm"
	"node bin/haptest -i com.baidu.baiduapp -o out/2in1/com_baidu_baiduapp"
	# "node bin/haptest -i com.baidu.hmmap -o out/2in1/com_baidu_hmmap"
	# "node bin/haptest -i com.baidu.netdisk.hmos -o out/2in1/com_baidu_netdisk_hmos"
	# "node bin/haptest -i com.bankabc.openharmonyapp.release -o out/2in1/com_bankabc_openharmonyapp_release"
	# "node bin/haptest -i com.beike.hongmeng -o out/2in1/com_beike_hongmeng"
	# "node bin/haptest -i com.cainiao.cainiao4hmos -o out/2in1/com_cainiao_cainiao4hmos"
	# "node bin/haptest -i com.ccb.2in1bank.hm -o out/2in1/com_ccb_2in1bank_hm"
	# "node bin/haptest -i com.cctv.yangshipin.app.harmonyp -o out/2in1/com_cctv_yangshipin_app_harmonyp"
	# "node bin/haptest -i com.china2in1.cmcc -o out/2in1/com_china2in1_cmcc"
	# "node bin/haptest -i com.chinarailway.ticketingHM -o out/2in1/com_chinarailway_ticketingHM"
	# "node bin/haptest -i com.cmbchina.harmony -o out/2in1/com_cmbchina_harmony"
	# "node bin/haptest -i com.cmcc.DigitalHome -o out/2in1/com_cmcc_DigitalHome"
	# "node bin/haptest -i com.cmcc.cmvideohm -o out/2in1/com_cmcc_cmvideohm"
	# "node bin/haptest -i com.ctrip.harmonynext -o out/2in1/com_ctrip_harmonynext"
	# "node bin/haptest -i com.dewu.hos -o out/2in1/com_dewu_hos"
	# "node bin/haptest -i com.dingtalk.hmos -o out/2in1/com_dingtalk_hmos"
	# "node bin/haptest -i com.douban.frodo.hap -o out/2in1/com_douban_frodo_hap"
	# "node bin/haptest -i com.dragon.read.next -o out/2in1/com_dragon_read_next"
	# "node bin/haptest -i com.droi.tong -o out/2in1/com_droi_tong"
	# "node bin/haptest -i com.eastmoney.hmn.berlin -o out/2in1/com_eastmoney_hmn_berlin"
	# "node bin/haptest -i com.easy.hmos.abroad -o out/2in1/com_easy_hmos_abroad"
	# "node bin/haptest -i com.eternaljust.msea.huawei -o out/2in1/com_eternaljust_msea_huawei"
	# "node bin/haptest -i com.example.cameran2 -o out/2in1/com_example_cameran2"
	# "node bin/haptest -i com.example.deephierarchy -o out/2in1/com_example_deephierarchy"
	# "node bin/haptest -i com.fliggy.hmos -o out/2in1/com_fliggy_hmos"
	# "node bin/haptest -i com.hexin.hmn.sjcg -o out/2in1/com_hexin_hmn_sjcg"
	# "node bin/haptest -i com.hm.cat.readall -o out/2in1/com_hm_cat_readall"
	# "node bin/haptest -i com.hm.youdao -o out/2in1/com_hm_youdao"
	"node bin/haptest -i com.hos.moonshot.kimichat -o out/2in1/com_hos_moonshot_kimichat"
	# "node bin/haptest -i com.htinns.application -o out/2in1/com_htinns_application"
	# "node bin/haptest -i com.hupu.heroes -o out/2in1/com_hupu_heroes"
	# "node bin/haptest -i com.icbc.harmonyclient -o out/2in1/com_icbc_harmonyclient"
	# "node bin/haptest -i com.jd.hm.mall -o out/2in1/com_jd_hm_mall"
	# "node bin/haptest -i com.jiaxiao.driveharmony -o out/2in1/com_jiaxiao_driveharmony"
	# "node bin/haptest -i com.jinrishuiyinxiangji.camera -o out/2in1/com_jinrishuiyinxiangji_camera"
	# "node bin/haptest -i com.kanyun.hos.leo -o out/2in1/com_kanyun_hos_leo"
	# "node bin/haptest -i com.kanyun.hos.solar -o out/2in1/com_kanyun_hos_solar"
	# "node bin/haptest -i com.kuaishou.hmapp -o out/2in1/com_kuaishou_hmapp"
	# "node bin/haptest -i com.kugou.hmmusic -o out/2in1/com_kugou_hmmusic"
	# "node bin/haptest -i com.legado.app -o out/2in1/com_legado_app"
	# "node bin/haptest -i com.lfr.accessibility -o out/2in1/com_lfr_accessibility"
	# "node bin/haptest -i com.lfr.uitest -o out/2in1/com_lfr_uitest"
	# "node bin/haptest -i com.lianjia.hongmeng -o out/2in1/com_lianjia_hongmeng"
	# "node bin/haptest -i com.liuzh.deviceinfo.hmos -o out/2in1/com_liuzh_deviceinfo_hmos"
	# "node bin/haptest -i com.lucky.luckincoffee -o out/2in1/com_lucky_luckincoffee"
	# "node bin/haptest -i com.luna.hm.music -o out/2in1/com_luna_hm_music"
	# "node bin/haptest -i com.meitu.beautycam -o out/2in1/com_meitu_beautycam"
	"node bin/haptest -i com.meitu.meitupic -o out/2in1/com_meitu_meitupic"
	# "node bin/haptest -i com.meituan.takeaway -o out/2in1/com_meituan_takeaway"
	# "node bin/haptest -i com.mgtv.phone -o out/2in1/com_mgtv_phone"
	# "node bin/haptest -i com.ohos.FusionSearch -o out/2in1/com_ohos_FusionSearch"
	# "node bin/haptest -i com.ohos.UserFile.ExternalFileManager -o out/2in1/com_ohos_UserFile_ExternalFileManager"
	# "node bin/haptest -i com.ohos.amsdialog -o out/2in1/com_ohos_amsdialog"
	# "node bin/haptest -i com.ohos.backgroundtaskmgr.resources -o out/2in1/com_ohos_backgroundtaskmgr_resources"
	# "node bin/haptest -i com.ohos.callui -o out/2in1/com_ohos_callui"
	# "node bin/haptest -i com.ohos.certmanager -o out/2in1/com_ohos_certmanager"
	# "node bin/haptest -i com.ohos.commondialog -o out/2in1/com_ohos_commondialog"
	# "node bin/haptest -i com.ohos.contacts -o out/2in1/com_ohos_contacts"
	# "node bin/haptest -i com.ohos.contactsdataability -o out/2in1/com_ohos_contactsdataability"
	# "node bin/haptest -i com.ohos.devicemanagerui -o out/2in1/com_ohos_devicemanagerui"
	# "node bin/haptest -i com.ohos.dhardwareui -o out/2in1/com_ohos_dhardwareui"
	# "node bin/haptest -i com.ohos.dlpmanager -o out/2in1/com_ohos_dlpmanager"
	# "node bin/haptest -i com.ohos.formrenderservice -o out/2in1/com_ohos_formrenderservice"
	# "node bin/haptest -i com.ohos.inputmethodchoosedialog -o out/2in1/com_ohos_inputmethodchoosedialog"
	# "node bin/haptest -i com.ohos.locationdialog -o out/2in1/com_ohos_locationdialog"
	# "node bin/haptest -i com.ohos.medialibrary.medialibrarydata -o out/2in1/com_ohos_medialibrary_medialibrarydata"
	# "node bin/haptest -i com.ohos.mms -o out/2in1/com_ohos_mms"
	# "node bin/haptest -i com.ohos.notificationdialog -o out/2in1/com_ohos_notificationdialog"
	# "node bin/haptest -i com.ohos.pasteboarddialog -o out/2in1/com_ohos_pasteboarddialog"
	# "node bin/haptest -i com.ohos.permissionmanager -o out/2in1/com_ohos_permissionmanager"
	# "node bin/haptest -i com.ohos.powerdialog -o out/2in1/com_ohos_powerdialog"
	# "node bin/haptest -i com.ohos.ringtonelibrary.ringtonelibrarydata -o out/2in1/com_ohos_ringtonelibrary_ringtonelibrarydata"
	# "node bin/haptest -i com.ohos.sceneboard -o out/2in1/com_ohos_sceneboard"
	# "node bin/haptest -i com.ohos.settingsdata -o out/2in1/com_ohos_settingsdata"
	# "node bin/haptest -i com.ohos.telephonydataability -o out/2in1/com_ohos_telephonydataability"
	# "node bin/haptest -i com.ohos.useriam.authwidget -o out/2in1/com_ohos_useriam_authwidget"
	# "node bin/haptest -i com.psbc.mbank.hm -o out/2in1/com_psbc_mbank_hm"
	# "node bin/haptest -i com.qihoo.hms.browser -o out/2in1/com_qihoo_hms_browser"
	# "node bin/haptest -i com.qimao.novel -o out/2in1/com_qimao_novel"
	# "node bin/haptest -i com.qiyi.video.hmy -o out/2in1/com_qiyi_video_hmy"
	# "node bin/haptest -i com.quark.ohosbrowser -o out/2in1/com_quark_ohosbrowser"
	# "node bin/haptest -i com.qunar.hos -o out/2in1/com_qunar_hos"
	# "node bin/haptest -i com.sankuai.dianping -o out/2in1/com_sankuai_dianping"
	"node bin/haptest -i com.sankuai.hmeituan -o out/2in1/com_sankuai_hmeituan"
	# "node bin/haptest -i com.sdu.didi.hmos.psnger -o out/2in1/com_sdu_didi_hmos_psnger"
	# "node bin/haptest -i com.sina.news.hm.next -o out/2in1/com_sina_news_hm_next"
	"node bin/haptest -i com.sina.weibo.stage -o out/2in1/com_sina_weibo_stage"
	# "node bin/haptest -i com.sinovatech.unicom.ha -o out/2in1/com_sinovatech_unicom_ha"
	# "node bin/haptest -i com.sogou.input -o out/2in1/com_sogou_input"
	# "node bin/haptest -i com.ss.dcar.auto -o out/2in1/com_ss_dcar_auto"
	# "node bin/haptest -i com.ss.feishu -o out/2in1/com_ss_feishu"
	# "node bin/haptest -i com.ss.hm.article.news -o out/2in1/com_ss_hm_article_news"
	# "node bin/haptest -i com.ss.hm.article.video -o out/2in1/com_ss_hm_article_video"
	"node bin/haptest -i com.ss.hm.ugc.aweme -o out/2in1/com_ss_hm_ugc_aweme"
	"node bin/haptest -i com.taobao.idlefish4ohos -o out/2in1/com_taobao_idlefish4ohos"
	# "node bin/haptest -i com.taobao.movie.hongmeng -o out/2in1/com_taobao_movie_hongmeng"
	# "node bin/haptest -i com.taobao.taobao4hmos -o out/2in1/com_taobao_taobao4hmos"
	# "node bin/haptest -i com.taobao.taobaolive4hmos -o out/2in1/com_taobao_taobaolive4hmos"
	# "node bin/haptest -i com.tencent.docsohos -o out/2in1/com_tencent_docsohos"
	# "node bin/haptest -i com.tencent.hm.news -o out/2in1/com_tencent_hm_news"
	# "node bin/haptest -i com.tencent.hm.qqmusic -o out/2in1/com_tencent_hm_qqmusic"
	# "node bin/haptest -i com.tencent.meeting.app -o out/2in1/com_tencent_meeting_app"
	# "node bin/haptest -i com.tencent.mqq -o out/2in1/com_tencent_mqq"
	# "node bin/haptest -i com.tencent.mtthm -o out/2in1/com_tencent_mtthm"
	# "node bin/haptest -i com.tencent.videohm -o out/2in1/com_tencent_videohm"
	"node bin/haptest -i com.tencent.wechat -o out/2in1/com_tencent_wechat"
	# "node bin/haptest -i com.tencent.wework.hmos -o out/2in1/com_tencent_wework_hmos"
	# "node bin/haptest -i com.tianyancha.skyeye.hm -o out/2in1/com_tianyancha_skyeye_hm"
	# "node bin/haptest -i com.tmall.tmall4hmos -o out/2in1/com_tmall_tmall4hmos"
	# "node bin/haptest -i com.tmri.app.harmony12123 -o out/2in1/com_tmri_app_harmony12123"
	# "node bin/haptest -i com.tongcheng.hmos -o out/2in1/com_tongcheng_hmos"
	# "node bin/haptest -i com.uc.2in1 -o out/2in1/com_uc_2in1"
	# "node bin/haptest -i com.umetrip.hm.app -o out/2in1/com_umetrip_hm_app"
	# "node bin/haptest -i com.unionpay.hmos.wallet -o out/2in1/com_unionpay_hmos_wallet"
	# "node bin/haptest -i com.usb.right -o out/2in1/com_usb_right"
	# "node bin/haptest -i com.vip.hosapp -o out/2in1/com_vip_hosapp"
	# "node bin/haptest -i com.wifi.hm -o out/2in1/com_wifi_hm"
	# "node bin/haptest -i com.wifiservice.portallogin -o out/2in1/com_wifiservice_portallogin"
	# "node bin/haptest -i com.wuba.life -o out/2in1/com_wuba_life"
	# "node bin/haptest -i com.wudaokou.hippo_hmos -o out/2in1/com_wudaokou_hippo_hmos"
	# "node bin/haptest -i com.ximalaya.ting.xmharmony -o out/2in1/com_ximalaya_ting_xmharmony"
	# "node bin/haptest -i com.xingin.xhs_hos -o out/2in1/com_xingin_xhs_hos"
	# "node bin/haptest -i com.xs.fm.next -o out/2in1/com_xs_fm_next"
	# "node bin/haptest -i com.xunlei.thunder -o out/2in1/com_xunlei_thunder"
	# "node bin/haptest -i com.xunmeng.pinduoduo.hos -o out/2in1/com_xunmeng_pinduoduo_hos"
	# "node bin/haptest -i com.yiche.autoeasyh -o out/2in1/com_yiche_autoeasyh"
	"node bin/haptest -i com.youku.next -o out/2in1/com_youku_next"
	# "node bin/haptest -i com.yumc.kfc.superapp -o out/2in1/com_yumc_kfc_superapp"
	# "node bin/haptest -i com.zhibo8.hmclient -o out/2in1/com_zhibo8_hmclient"
	# "node bin/haptest -i com.zhihu.hmos -o out/2in1/com_zhihu_hmos"
	"node bin/haptest -i com.zhuanzhuan.hmoszz -o out/2in1/com_zhuanzhuan_hmoszz"
	"node bin/haptest -i com.zuoyebang.homework -o out/2in1/com_zuoyebang_homework"
	# "node bin/haptest -i me.ele.eleme -o out/2in1/me_ele_eleme"
	# "node bin/haptest -i ohos.global.systemres -o out/2in1/ohos_global_systemres"
	# "node bin/haptest -i yylx.bilibili.comic -o out/2in1/yylx_bilibili_comic"
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
