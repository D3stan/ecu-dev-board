// @vitest-environment happy-dom
import { flushPromises, mount } from '@vue/test-utils';
import PrimeVue from 'primevue/config';
import { createMemoryHistory, createRouter } from 'vue-router';
import { afterEach, describe, expect, it, vi } from 'vitest';

import RunsPage from './RunsPage.vue';

const api = vi.hoisted(() => {
  const runId = '2630bd86-8086-4a54-8f6c-2630bd868086';
  return {
    runId,
    endRun: vi.fn().mockResolvedValue({ status: 'ended', run_id: runId }),
    listRuns: vi.fn().mockResolvedValue([
      {
        id: runId,
        ecu_id: '8fa22e40-3084-4e73-b0a5-c84806876f1f',
        status: 'active',
        started_at: '2026-06-20T20:00:00Z',
        ended_at: null,
        firmware_version: '1.0.0-125-gfb81dde',
        map_version: null,
        heartbeat: null,
        last_committed_sequence: 39,
        batch_count: 39,
      },
    ]),
  };
});

vi.mock('@/api/generated', () => ({
  EcusService: { listEcus: vi.fn().mockResolvedValue([]) },
  RunsService: {
    endRun: api.endRun,
    listRuns: api.listRuns,
  },
}));

describe('RunsPage', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('passes the run UUID directly when ending a recording', async () => {
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [
        { path: '/runs', name: 'runs', component: RunsPage },
        {
          path: '/runs/:runId/telemetry',
          name: 'telemetry',
          component: { template: '<div />' },
        },
      ],
    });

    await router.push('/runs');
    await router.isReady();

    const wrapper = mount(RunsPage, {
      global: {
        plugins: [router, PrimeVue],
      },
    });
    await flushPromises();

    expect(wrapper.text()).toContain('Firmware');
    expect(wrapper.text()).toContain('1.0.0-125-gfb81dde');
    expect(wrapper.text()).not.toContain('Engine Map');

    const endButton = wrapper.findAll('button').find(button => button.text().includes('End Run'));
    await endButton?.trigger('click');
    await flushPromises();

    expect(api.endRun).toHaveBeenCalledWith(api.runId);

    wrapper.unmount();
  });

  it('does not suggest starting a manual run', async () => {
    api.listRuns.mockResolvedValueOnce([]);

    const router = createRouter({
      history: createMemoryHistory(),
      routes: [{ path: '/runs', name: 'runs', component: RunsPage }],
    });
    await router.push('/runs');
    await router.isReady();

    const wrapper = mount(RunsPage, {
      global: { plugins: [router, PrimeVue] },
    });
    await flushPromises();

    expect(wrapper.text()).not.toContain('start a manual run');

    wrapper.unmount();
  });
});
