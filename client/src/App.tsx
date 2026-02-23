import { useState, useCallback, useEffect, useRef, Suspense, lazy } from 'react';
import { useSocket } from './hooks/useSocket';
import type { SwarmSnapshot } from './hooks/useSocket';
import { useIsMobile } from './hooks/useMediaQuery';
import { useI18n } from './lib/i18n';
import { StatsHeader } from './components/StatsHeader';
import { SwarmMap } from './components/SwarmMap';
import { RobotPanel } from './components/RobotPanel';
import { CommandBar } from './components/CommandBar';
import { EventLog } from './components/EventLog';
import { MissionPanel } from './components/MissionPanel';
import { ReplayBar } from './components/ReplayBar';
import { RobotFeedGrid } from './components/RobotFeedGrid';
import { ConsensusPanel } from './components/ConsensusPanel';
import { NetworkTopology } from './components/NetworkTopology';
import { MissionHistory } from './components/MissionHistory';
import { HdcStatsPanel } from './components/HdcStatsPanel';
import { KeyboardHelp } from './components/KeyboardHelp';
import { SerialStatus } from './components/SerialStatus';
import { HdcDemo } from './components/HdcDemo';
import { PerformanceHud } from './components/PerformanceHud';
import { PanelTabs } from './components/PanelTabs';
import { CollapsiblePanel } from './components/CollapsiblePanel';
import { toggleMute, isMuted, playDeploy, playRecall, playGust, playAlert, playMissionStart } from './lib/audio';

// Lazy-load 3D (Three.js ~1MB) — only when user clicks "3D"
const SwarmMap3D = lazy(() => import('./components/SwarmMap3D').then(m => ({ default: m.SwarmMap3D })));

type ViewMode = '2d' | '3d';

export default function App() {
  const { connected, snapshot, events, terrain, emit } = useSocket();
  const { locale, t, setLocale } = useI18n();
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('2d');
  const [isReplaying, setIsReplaying] = useState(false);
  const [replaySnapshot, setReplaySnapshot] = useState<SwarmSnapshot | null>(null);
  const [muted, setMuted] = useState(isMuted());
  const [showHelp, setShowHelp] = useState(false);
  const [serialMode, setSerialMode] = useState<'SIM' | 'HARDWARE'>('SIM');
  const [heatmapOn, setHeatmapOn] = useState(false);
  const [showPerf, setShowPerf] = useState(false);
  const prevEventsLen = useRef(0);
  const isMobile = useIsMobile();

  // Use replay snapshot when replaying, otherwise live data
  const activeSnapshot = isReplaying ? replaySnapshot : snapshot;

  // Audio triggers based on events
  useEffect(() => {
    if (events.length <= prevEventsLen.current) {
      prevEventsLen.current = events.length;
      return;
    }
    const newEvents = events.slice(prevEventsLen.current);
    prevEventsLen.current = events.length;
    for (const evt of newEvents) {
      if (evt.type === 'deploy') playDeploy();
      else if (evt.type === 'recall') playRecall();
      else if (evt.type === 'wind_change') playGust();
      else if (evt.type === 'low_battery' || evt.type === 'jamming' || evt.type === 'node_fail') playAlert();
      else if (evt.type === 'info' && evt.message.includes('Mission started')) playMissionStart();
    }
  }, [events]);

  // Keyboard shortcuts
  const formations = ['scatter', 'grid', 'ring', 'wedge', 'cluster'] as const;

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Ignore when typing in input fields
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      const key = e.key.toLowerCase();

      if (key === 'f') { setShowPerf(v => !v); return; }
      if (key === 'd') { emit('cmd:deploy'); return; }
      if (key === 'r') { emit('cmd:recall'); return; }
      if (key === 'g') { emit('cmd:gust'); return; }
      if (key === 'm') { toggleMute(); setMuted(isMuted()); return; }
      if (key === '?' || (key === 'h' && !e.ctrlKey)) { setShowHelp(v => !v); return; }
      if (key === 'escape') { setShowHelp(false); setSelectedId(null); return; }
      if (key === ' ') {
        e.preventDefault();
        setViewMode(v => v === '2d' ? '3d' : '2d');
        return;
      }
      if (key === 'tab') {
        e.preventDefault();
        if (!snapshot) return;
        const ids = snapshot.robots.map(r => r.id);
        if (ids.length === 0) return;
        const curIdx = selectedId !== null ? ids.indexOf(selectedId) : -1;
        const nextIdx = (curIdx + 1) % ids.length;
        setSelectedId(ids[nextIdx]);
        return;
      }
      // Formation shortcuts: 1-5
      const num = parseInt(key, 10);
      if (num >= 1 && num <= 5) {
        emit('cmd:formation', formations[num - 1]);
        return;
      }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [emit, selectedId, snapshot]);

  const selectedRobot = activeSnapshot?.robots.find(r => r.id === selectedId) ?? null;

  const handleMapClick = useCallback((x: number, y: number) => {
    if (selectedId !== null && !isReplaying) {
      emit('cmd:move', { robotId: selectedId, x, y });
    }
  }, [selectedId, emit, isReplaying]);

  const handlePowerMode = useCallback((mode: string) => {
    if (selectedId !== null && !isReplaying) {
      emit('cmd:power', { robotId: selectedId, mode });
    }
  }, [selectedId, emit, isReplaying]);

  const handleReplayFrame = useCallback((frame: SwarmSnapshot | null) => {
    setReplaySnapshot(frame);
  }, []);

  // Touch-friendly min height for interactive elements on mobile
  const touchMinHeight = isMobile ? 44 : undefined;
  // View toggle button padding scales up for touch targets
  const viewBtnPadding = isMobile ? '8px 16px' : '4px 12px';
  // On mobile, collapse all panels by default to save screen space
  const panelDefaultOpen = !isMobile;

  return (
    <div data-serial-mode={serialMode} style={{
      background: '#0d1117', color: '#e6edf3', fontFamily: "'Segoe UI', sans-serif",
      minHeight: '100vh', padding: isMobile ? 6 : 12,
    }}>
      {/* Global focus-visible outline for all interactive elements */}
      <style>{`
        *:focus-visible {
          outline: 2px solid #58a6ff;
          outline-offset: 2px;
        }
        .skip-to-main {
          position: absolute;
          left: -9999px;
          top: 4px;
          z-index: 1000;
          padding: 8px 16px;
          background: #1f6feb;
          color: #ffffff;
          font-size: 14px;
          font-weight: 600;
          border: none;
          border-radius: 4px;
          text-decoration: none;
        }
        .skip-to-main:focus {
          left: 50%;
          transform: translateX(-50%);
        }
      `}</style>
      {/* Skip to main content link */}
      <a className="skip-to-main" href="#main-map">Skip to main content</a>
      <PerformanceHud visible={showPerf} />
      <h1 style={{ color: '#58a6ff', textAlign: 'center', margin: '0 0 4px', fontSize: isMobile ? 16 : 20 }}>
        {t('app.title')}
      </h1>
      <p style={{ textAlign: 'center', color: '#8b949e', margin: '0 0 8px', fontSize: 11 }}>
        {!isMobile && <>{t('app.subtitle')}</>}
        {isMobile && <>{t('app.subtitle.mobile')}</>}
        {isReplaying && <span style={{ color: '#f0883e', fontWeight: 600 }}> [{t('app.replay')}]</span>}
        {' '}
        <button
          onClick={() => { toggleMute(); setMuted(isMuted()); }}
          style={{
            background: 'none', border: '1px solid #30363d', borderRadius: 4,
            color: muted ? '#f85149' : '#3fb950', cursor: 'pointer',
            fontSize: 10, padding: '1px 6px',
            minHeight: touchMinHeight,
          }}
        >
          {muted ? t('app.muted') : t('app.sfx')}
        </button>
        {' '}
        <button
          onClick={() => setShowHelp(v => !v)}
          style={{
            background: 'none', border: '1px solid #30363d', borderRadius: 4,
            color: '#58a6ff', cursor: 'pointer',
            fontSize: 10, padding: '1px 6px',
            minHeight: touchMinHeight,
          }}
        >
          {t('app.keys')}
        </button>
        {' '}
        <SerialStatus onModeChange={setSerialMode} />
        {' '}
        <button
          onClick={() => setLocale(locale === 'en' ? 'zh' : 'en')}
          style={{
            background: 'none', border: '1px solid #30363d', borderRadius: 4,
            color: '#a371f7', cursor: 'pointer', fontSize: 10, padding: '1px 6px',
          }}
        >
          {locale === 'en' ? '中文' : 'EN'}
        </button>
      </p>

      <KeyboardHelp visible={showHelp} onClose={() => setShowHelp(false)} />

      <div role="status" aria-label="Swarm statistics">
        <StatsHeader stats={activeSnapshot?.stats ?? null} connected={connected} />
      </div>

      <div style={{
        display: 'flex',
        flexDirection: isMobile ? 'column' : 'row',
        gap: isMobile ? 8 : 12,
        marginTop: 10,
      }}>
        {/* ---- Map column ---- */}
        <div
          id="main-map"
          role="main"
          aria-label="Swarm map"
          style={{
            flex: isMobile ? 'none' : 1,
            minWidth: 0,
            height: isMobile ? '50vh' : 'auto',
            width: '100%',
          }}
        >
          {/* View mode toggle */}
          <div style={{ display: 'flex', gap: 4, marginBottom: 6 }}>
            {(['2d', '3d'] as const).map(mode => (
              <button
                key={mode}
                onClick={() => setViewMode(mode)}
                style={{
                  padding: viewBtnPadding,
                  fontSize: 11,
                  fontWeight: 600,
                  border: '1px solid #30363d',
                  borderRadius: 6,
                  cursor: 'pointer',
                  background: viewMode === mode ? '#1f6feb' : '#21262d',
                  color: viewMode === mode ? '#ffffff' : '#8b949e',
                  transition: 'all 0.15s',
                  minHeight: touchMinHeight,
                }}
              >
                {t(`view.${mode}`)}
              </button>
            ))}
            <button
              onClick={() => setHeatmapOn(v => !v)}
              style={{
                padding: viewBtnPadding,
                fontSize: 11,
                fontWeight: 600,
                border: '1px solid #30363d',
                borderRadius: 6,
                cursor: 'pointer',
                background: heatmapOn ? '#f0883e' : '#21262d',
                color: heatmapOn ? '#ffffff' : '#8b949e',
                transition: 'all 0.15s',
                minHeight: touchMinHeight,
              }}
            >
              {t('view.heat')}
            </button>
          </div>

          {/* Map view */}
          {viewMode === '2d' ? (
            <SwarmMap
              snapshot={activeSnapshot}
              selectedId={selectedId}
              onSelect={setSelectedId}
              onMapClick={handleMapClick}
              terrain={terrain}
              heatmapEnabled={heatmapOn}
            />
          ) : (
            <Suspense fallback={
              <div style={{
                width: '100%', height: isMobile ? 'calc(50vh - 60px)' : 500,
                display: 'flex', alignItems: 'center',
                justifyContent: 'center', background: '#010409', borderRadius: 8,
                border: '2px solid #30363d', color: '#484f58', fontSize: 12,
              }}>
                Loading 3D scene...
              </div>
            }>
              <SwarmMap3D
                snapshot={activeSnapshot}
                selectedId={selectedId}
                onSelect={setSelectedId}
                onMapClick={handleMapClick}
                terrain={terrain}
              />
            </Suspense>
          )}

          {/* Replay bar */}
          <div style={{ marginTop: 6 }}>
            <ReplayBar
              onReplayFrame={handleReplayFrame}
              isReplaying={isReplaying}
              setIsReplaying={setIsReplaying}
            />
          </div>

          {!isMobile && (
            <div style={{ marginTop: 6 }}>
              <EventLog events={events} />
            </div>
          )}
        </div>

        {/* ---- Sidebar / bottom panels ---- */}
        <div
          role="complementary"
          aria-label="Control panels"
          style={{
            width: isMobile ? '100%' : 320,
            flexShrink: 0,
            display: 'flex',
            flexDirection: 'column',
            gap: 6,
            maxHeight: isMobile ? '50vh' : 'calc(100vh - 120px)',
            overflow: 'auto',
            WebkitOverflowScrolling: 'touch',
          }}
        >
          {/* 1. Commands — collapsible */}
          <CollapsiblePanel title={t('panel.commands')} color="#58a6ff" defaultOpen={false} storageKey="commands">
            <CommandBar emit={emit} formation={activeSnapshot?.formation ?? 'scatter'} nestingStats={activeSnapshot?.stats?.nestingStats} />
          </CollapsiblePanel>

          {/* 2. Mission — collapsible */}
          <CollapsiblePanel
            title={activeSnapshot?.mission?.active ? t('panel.mission.active') : t('panel.mission')}
            color={(activeSnapshot?.mission?.active) ? '#3fb950' : '#58a6ff'}
            defaultOpen={panelDefaultOpen}
            storageKey="mission"
          >
            <MissionPanel mission={activeSnapshot?.mission} emit={emit} />
          </CollapsiblePanel>

          {/* 3. Fleet — tabs */}
          <PanelTabs
            storageKey="fleet"
            tabs={[
              {
                id: 'feed',
                label: t('panel.fleet'),
                color: '#58a6ff',
                content: activeSnapshot && activeSnapshot.robots.length > 0 ? (
                  <RobotFeedGrid
                    robots={activeSnapshot.robots}
                    selectedId={selectedId}
                    onSelect={setSelectedId}
                    bleLinks={activeSnapshot.bleLinks}
                    terrain={terrain}
                    targets={activeSnapshot.mission?.targets}
                  />
                ) : (
                  <div style={{ fontSize: 10, color: '#484f58', textAlign: 'center', padding: 8 }}>
                    {t('stats.noData')}
                  </div>
                ),
              },
              {
                id: 'topology',
                label: t('panel.network'),
                color: '#58a6ff',
                content: (
                  <NetworkTopology
                    snapshot={activeSnapshot}
                    selectedId={selectedId}
                    onSelect={setSelectedId}
                  />
                ),
              },
            ]}
          />

          {/* 4. Data — tabs */}
          <PanelTabs
            storageKey="data"
            tabs={[
              {
                id: 'consensus',
                label: t('panel.consensus'),
                color: '#a371f7',
                content: <ConsensusPanel snapshot={activeSnapshot} />,
              },
              {
                id: 'hdc-stats',
                label: t('panel.hdcStats'),
                color: '#f0883e',
                content: <HdcStatsPanel hdcStats={activeSnapshot?.stats.hdcStats} />,
              },
              {
                id: 'history',
                label: t('panel.history'),
                color: '#d29922',
                content: <MissionHistory />,
              },
            ]}
          />

          {/* 5. Robot detail — collapsible, only when selected */}
          {selectedRobot ? (
            <CollapsiblePanel
              title={`${selectedRobot.name} ${t('panel.detail')}`}
              color="#e6edf3"
              defaultOpen={true}
              storageKey="robot-detail"
            >
              <RobotPanel
                robot={selectedRobot}
                onPowerMode={handlePowerMode}
                bleLinks={activeSnapshot?.bleLinks}
                allRobots={activeSnapshot?.robots}
                emit={emit}
              />
              <div style={{ borderTop: '1px solid #30363d', paddingTop: 8, marginTop: 8 }}>
                <HdcDemo robot={selectedRobot} />
              </div>
            </CollapsiblePanel>
          ) : (
            <div style={{
              background: '#161b22', border: '1px solid #30363d', borderRadius: 8,
              padding: 12, textAlign: 'center', color: '#484f58', fontSize: 11,
            }}>
              {t('stats.clickRobot')}
            </div>
          )}

          {/* Show event log inside sidebar on mobile */}
          {isMobile && (
            <CollapsiblePanel title={t('panel.eventLog')} color="#8b949e" defaultOpen={false} storageKey="event-log-mobile">
              <EventLog events={events} />
            </CollapsiblePanel>
          )}
        </div>
      </div>
    </div>
  );
}
