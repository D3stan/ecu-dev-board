// @vitest-environment happy-dom
import { flushPromises, mount } from '@vue/test-utils';
import { createMemoryHistory, createRouter } from 'vue-router';
import { afterEach, describe, expect, it, vi } from 'vitest';

import TelemetryPage from './TelemetryPage.vue';

const api = vi.hoisted(() => {
  const runId = '2630bd86-8086-4a54-8f6c-2630bd868086';
  return {
    runId,
    getTelemetry: vi.fn().mockResolvedValue([]),
    listRuns: vi.fn().mockResolvedValue([
      {
        id: runId,
      ecu_id: '8fa22e40-3084-4e73-b0a5-c84806876f1f',
      status: 'ended',
      started_at: '2026-06-20T20:00:00Z',
      ended_at: '2026-06-20T20:01:00Z',
      firmware_version: null,
      map_version: null,
      heartbeat: null,
      last_committed_sequence: 39,
      batch_count: 39,
      },
    ]),
  };
});

vi.mock('@/api/generated', () => ({
  RunsService: {
    getTelemetry: api.getTelemetry,
    listRuns: api.listRuns,
  },
  EcusService: {},
}));

vi.mock('vue-chartjs', () => ({
  Line: { template: '<div class="chart-stub" />' },
}));

describe('TelemetryPage', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('requests telemetry with the UUID route parameter and selected limit', async () => {
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [
        {
          path: '/runs/:runId/telemetry',
          name: 'telemetry',
          component: TelemetryPage,
        },
        { path: '/runs', component: { template: '<div />' } },
      ],
    });

    await router.push(`/runs/${api.runId}/telemetry`);
    await router.isReady();

    const wrapper = mount(TelemetryPage, {
      global: {
        plugins: [router],
        stubs: {
          Button: { template: '<button><slot /></button>' },
          Select: {
            props: ['modelValue', 'options', 'optionLabel', 'optionValue'],
            template: '<div />',
          },
        },
      },
    });

    await flushPromises();

    expect(api.getTelemetry).toHaveBeenCalledWith(api.runId, 500);

    wrapper.unmount();
  });
});
