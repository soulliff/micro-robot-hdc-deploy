import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { StatsHeader } from '../src/components/StatsHeader';
import type { SwarmStats } from '../src/hooks/useSocket';

function makeStats(overrides?: Partial<SwarmStats>): SwarmStats {
  return {
    totalRobots: 8,
    onlineRobots: 6,
    chargingRobots: 0,
    avgBatterySoc: 75.5,
    windClass: 'CALM',
    formation: 'grid',
    coordinatorId: 0,
    uptimeSeconds: 300,
    ...overrides,
  };
}

describe('StatsHeader', () => {
  it('renders "LIVE" when connected is true', () => {
    render(<StatsHeader stats={makeStats()} connected={true} />);
    expect(screen.getByText('LIVE')).toBeInTheDocument();
  });

  it('renders "OFFLINE" when connected is false', () => {
    render(<StatsHeader stats={makeStats()} connected={false} />);
    expect(screen.getByText('OFFLINE')).toBeInTheDocument();
  });

  it('renders robot count from stats', () => {
    render(<StatsHeader stats={makeStats({ onlineRobots: 5, totalRobots: 8 })} connected={true} />);
    expect(screen.queryByText('6/8')).not.toBeInTheDocument();
    expect(screen.getByText('5/8')).toBeInTheDocument();
  });

  it('renders battery percentage from stats', () => {
    render(<StatsHeader stats={makeStats({ avgBatterySoc: 42.7 })} connected={true} />);
    expect(screen.getByText('43%')).toBeInTheDocument();
  });

  it('renders dash values when stats is null', () => {
    render(<StatsHeader stats={null} connected={false} />);
    // When stats is null, the component shows '-' for numeric fields
    const dashes = screen.getAllByText('-');
    expect(dashes.length).toBeGreaterThanOrEqual(3);
  });

  it('renders wind class from stats', () => {
    render(<StatsHeader stats={makeStats({ windClass: 'STRONG' })} connected={true} />);
    expect(screen.getByText('STRONG')).toBeInTheDocument();
  });

  it('renders coordinator id from stats', () => {
    render(<StatsHeader stats={makeStats({ coordinatorId: 3 })} connected={true} />);
    expect(screen.getByText('R3')).toBeInTheDocument();
  });

  it('renders charging count when robots are charging', () => {
    render(<StatsHeader stats={makeStats({ chargingRobots: 2 })} connected={true} />);
    expect(screen.getByText('2')).toBeInTheDocument();
  });

  it('does not render charging stat when no robots are charging', () => {
    render(<StatsHeader stats={makeStats({ chargingRobots: 0 })} connected={true} />);
    expect(screen.queryByText('Charging')).not.toBeInTheDocument();
  });

  it('renders formation type from stats', () => {
    render(<StatsHeader stats={makeStats({ formation: 'wedge' })} connected={true} />);
    expect(screen.getByText('wedge')).toBeInTheDocument();
  });

  it('renders uptime in seconds', () => {
    render(<StatsHeader stats={makeStats({ uptimeSeconds: 123.7 })} connected={true} />);
    expect(screen.getByText('124s')).toBeInTheDocument();
  });
});
