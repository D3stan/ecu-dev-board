// @vitest-environment happy-dom
import { flushPromises, mount } from '@vue/test-utils';
import PrimeVue from 'primevue/config';
import { createMemoryHistory, createRouter } from 'vue-router';
import { afterEach, describe, expect, it, vi } from 'vitest';

import EcusPage from './EcusPage.vue';

const api = vi.hoisted(() => ({
  listEcus: vi.fn().mockResolvedValue([
    {
      id: '8fa22e40-3084-4e73-b0a5-c84806876f1f',
      serial_number: 'esp32s3-f0f5bd6d387c',
      hardware_revision: 'ESP32-S3FH4R2',
      created_at: '2026-06-20T20:27:54Z',
    },
  ]),
  registerEcu: vi.fn(),
}));

vi.mock('@/api/generated', () => ({
  EcusService: {
    listEcus: api.listEcus,
    registerEcu: api.registerEcu,
  },
  RunsService: {
    startRun: vi.fn(),
  },
}));

describe('EcusPage', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('does not offer a control to start a run', async () => {
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [
        { path: '/ecus', name: 'ecus', component: EcusPage },
        { path: '/runs', name: 'runs', component: { template: '<div />' } },
      ],
    });

    await router.push('/ecus');
    await router.isReady();

    const wrapper = mount(EcusPage, {
      global: {
        plugins: [router, PrimeVue],
      },
    });

    await flushPromises();

    expect(wrapper.text()).not.toContain('Start Run');
    expect(wrapper.text()).not.toContain('Start Engine');

    wrapper.unmount();
  });

  it('submits registration fields as the generated client request body', async () => {
    api.registerEcu.mockResolvedValue({
      id: 'f2cba4f1-9637-46ee-bc88-a4d37f037262',
      serial_number: 'ECU-32-0051',
      hardware_revision: 'RevB-4',
      created_at: '2026-06-20T21:00:00Z',
    });

    const router = createRouter({
      history: createMemoryHistory(),
      routes: [
        { path: '/ecus', name: 'ecus', component: EcusPage },
        { path: '/runs', name: 'runs', component: { template: '<div />' } },
      ],
    });

    await router.push('/ecus');
    await router.isReady();

    const wrapper = mount(EcusPage, {
      global: {
        plugins: [router, PrimeVue],
        stubs: { teleport: true },
      },
    });
    await flushPromises();

    const openButton = wrapper.findAll('button').find(button => button.text().includes('Register ECU'));
    await openButton?.trigger('click');
    await wrapper.get('#serial').setValue('ECU-32-0051');
    await wrapper.get('#hw').setValue('RevB-4');

    const submitButton = wrapper.findAll('button').find(button => button.text() === 'Register');
    await submitButton?.trigger('click');
    await flushPromises();

    expect(api.registerEcu).toHaveBeenCalledWith({
      serial_number: 'ECU-32-0051',
      hardware_revision: 'RevB-4',
    });

    wrapper.unmount();
  });
});
