// @vitest-environment happy-dom
import { flushPromises, mount } from '@vue/test-utils';
import { createMemoryHistory, createRouter } from 'vue-router';
import { afterEach, describe, expect, it, vi } from 'vitest';

import App from './App.vue';

describe('App routing', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('renders the component matched by the current route', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ status: 'ok' }),
    }));

    const router = createRouter({
      history: createMemoryHistory(),
      routes: [
        {
          path: '/ecus',
          component: { template: '<section data-testid="route-page">Registered ECUs</section>' },
        },
        {
          path: '/runs',
          component: { template: '<section>Runs</section>' },
        },
        {
          path: '/runs/:runId/telemetry',
          component: { template: '<section>Telemetry</section>' },
        },
      ],
    });

    await router.push('/ecus');
    await router.isReady();

    const wrapper = mount(App, {
      global: {
        plugins: [router],
      },
    });
    await flushPromises();

    expect(wrapper.get('[data-testid="route-page"]').text()).toBe('Registered ECUs');
  });
});
