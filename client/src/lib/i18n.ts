import { useState, useCallback, createContext, useContext } from 'react';
import type { ReactNode } from 'react';
import { createElement } from 'react';

type Locale = 'en' | 'zh';

// Translation dictionary
const translations: Record<Locale, Record<string, string>> = {
  en: {
    // Header
    'app.title': 'Micro-Robot HDC Swarm Console',
    'app.subtitle': 'Real-time simulation — 22 robots (套娃 hierarchy), HDC WASM inference, BLE mesh, wind field',
    'app.subtitle.mobile': 'HDC Swarm — 22 robots',
    'app.muted': 'MUTED',
    'app.sfx': 'SFX ON',
    'app.keys': '? KEYS',
    'app.replay': 'REPLAY MODE',

    // View modes
    'view.2d': '2D',
    'view.3d': '3D',
    'view.heat': 'HEAT',

    // Panels
    'panel.commands': 'COMMANDS',
    'panel.mission': 'MISSION',
    'panel.mission.active': 'MISSION — ACTIVE',
    'panel.fleet': 'FLEET',
    'panel.network': 'NETWORK',
    'panel.consensus': 'CONSENSUS',
    'panel.hdcStats': 'HDC STATS',
    'panel.history': 'HISTORY',
    'panel.eventLog': 'EVENT LOG',
    'panel.detail': 'DETAIL',

    // Mission
    'mission.choose': 'Choose a mission type — each has unique rules and scoring.',
    'mission.survey': 'SURVEY',
    'mission.survey.desc': '6-zone coverage. 1 robot needed. +50 zone bonus.',
    'mission.intercept': 'INTERCEPT',
    'mission.intercept.desc': 'Fast targets, small radius. 2x points. Hard mode.',
    'mission.searchClassify': 'SEARCH & CLASSIFY',
    'mission.searchClassify.desc': 'Standard mode. 2 robots to classify. Baseline.',
    'mission.perimeter': 'PERIMETER',
    'mission.perimeter.desc': 'Edge targets only. 3 robots needed for consensus.',
    'mission.stop': 'Stop Mission',
    'mission.score': 'SCORE',
    'mission.classified': 'CLASSIFIED',
    'mission.expired': 'EXPIRED',
    'mission.total': 'TOTAL',
    'mission.time': 'Time',
    'mission.type': 'Type',

    // Robot
    'robot.coordinator': 'Coordinator',
    'robot.zone': 'Zone',
    'robot.tick': 'Tick',
    'robot.jammed': 'JAMMED',
    'robot.byzantine': 'BYZANTINE',
    'robot.forceReturn': 'Force Return',
    'robot.markByz': 'Mark BYZ',
    'robot.clearByz': 'Clear BYZ',
    'robot.recover': 'Recover',
    'robot.bleNeighbors': 'BLE NEIGHBORS',
    'robot.hdcInference': 'HDC Inference',
    'robot.confidenceTrend': 'CONFIDENCE TREND',

    // Feed
    'feed.online': 'online',
    'feed.radar': 'RDR',
    'feed.camera': 'CAM',
    'feed.spectrum': 'FFT',

    // Stats
    'stats.noData': 'Waiting for data...',
    'stats.clickRobot': 'Click a robot on the map to see details',

    // HDC Stats
    'hdc.accuracy': 'HDC ACCURACY',
    'hdc.runMission': 'Run a mission to track HDC accuracy',
    'hdc.inferences': 'inferences',
    'hdc.correct': 'CORRECT',
    'hdc.wrong': 'WRONG',
    'hdc.rolling': 'ROLLING ACCURACY',
    'hdc.perSpecies': 'PER-SPECIES',

    // History
    'history.title': 'MISSION HISTORY',
    'history.noMissions': 'No missions completed yet',
    'history.missions': 'missions',

    // Serial
    'serial.notSupported': 'Serial N/A',
    'serial.connect': 'CONNECT',
    'serial.disconnect': 'DISCONNECT',
    'serial.connectFirst': 'Connect serial first',
    'serial.notAvailable': 'WebSerial not supported',
  },
  zh: {
    'app.title': '微型机器人 HDC 蜂群控制台',
    'app.subtitle': '实时模拟 — 22台机器人（套娃层级）, HDC WASM推理, BLE mesh, 风场',
    'app.subtitle.mobile': 'HDC蜂群 — 22台机器人',
    'app.muted': '已静音',
    'app.sfx': '音效开',
    'app.keys': '? 快捷键',
    'app.replay': '回放模式',

    'view.2d': '2D',
    'view.3d': '3D',
    'view.heat': '热力图',

    'panel.commands': '命令',
    'panel.mission': '任务',
    'panel.mission.active': '任务 — 进行中',
    'panel.fleet': '舰队',
    'panel.network': '网络',
    'panel.consensus': '共识',
    'panel.hdcStats': 'HDC 统计',
    'panel.history': '历史',
    'panel.eventLog': '事件日志',
    'panel.detail': '详情',

    'mission.choose': '选择任务类型 — 每种有不同规则和计分方式。',
    'mission.survey': '巡查',
    'mission.survey.desc': '6区域覆盖，需1台机器人，+50区域奖励。',
    'mission.intercept': '拦截',
    'mission.intercept.desc': '快速目标，小范围，2倍积分，困难模式。',
    'mission.searchClassify': '搜索与分类',
    'mission.searchClassify.desc': '标准模式，需2台机器人分类，基准难度。',
    'mission.perimeter': '周界',
    'mission.perimeter.desc': '仅边缘目标，需3台机器人达成共识。',
    'mission.stop': '停止任务',
    'mission.score': '得分',
    'mission.classified': '已分类',
    'mission.expired': '已过期',
    'mission.total': '总计',
    'mission.time': '时间',
    'mission.type': '类型',

    'robot.coordinator': '协调者',
    'robot.zone': '区域',
    'robot.tick': '时钟',
    'robot.jammed': '被干扰',
    'robot.byzantine': '拜占庭',
    'robot.forceReturn': '强制返回',
    'robot.markByz': '标记拜占庭',
    'robot.clearByz': '清除拜占庭',
    'robot.recover': '恢复',
    'robot.bleNeighbors': 'BLE 邻居',
    'robot.hdcInference': 'HDC 推理',
    'robot.confidenceTrend': '置信度趋势',

    'feed.online': '在线',
    'feed.radar': '雷达',
    'feed.camera': '摄像',
    'feed.spectrum': '频谱',

    'stats.noData': '等待数据...',
    'stats.clickRobot': '点击地图上的机器人查看详情',

    'hdc.accuracy': 'HDC 准确率',
    'hdc.runMission': '启动任务以追踪HDC准确率',
    'hdc.inferences': '次推理',
    'hdc.correct': '正确',
    'hdc.wrong': '错误',
    'hdc.rolling': '滚动准确率',
    'hdc.perSpecies': '按物种',

    'history.title': '任务历史',
    'history.noMissions': '暂无已完成的任务',
    'history.missions': '个任务',

    'serial.notSupported': '串口不可用',
    'serial.connect': '连接',
    'serial.disconnect': '断开',
    'serial.connectFirst': '请先连接串口',
    'serial.notAvailable': '浏览器不支持WebSerial',
  },
};

// Get saved locale or detect from browser
function getInitialLocale(): Locale {
  try {
    const saved = localStorage.getItem('locale');
    if (saved === 'zh' || saved === 'en') return saved;
  } catch {
    // localStorage may not be available
  }
  return navigator.language.startsWith('zh') ? 'zh' : 'en';
}

// Context
const I18nContext = createContext<{
  locale: Locale;
  t: (key: string) => string;
  setLocale: (locale: Locale) => void;
}>({
  locale: 'en',
  t: (key) => key,
  setLocale: () => {},
});

// Provider component
export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(getInitialLocale);

  const setLocale = useCallback((l: Locale) => {
    setLocaleState(l);
    try {
      localStorage.setItem('locale', l);
    } catch {
      // localStorage may not be available
    }
  }, []);

  const t = useCallback((key: string): string => {
    return translations[locale][key] ?? translations['en'][key] ?? key;
  }, [locale]);

  return createElement(
    I18nContext.Provider,
    { value: { locale, t, setLocale } },
    children,
  );
}

// Hook
export function useI18n() {
  return useContext(I18nContext);
}

export type { Locale };
