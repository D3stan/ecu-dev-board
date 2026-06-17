import { createRouter, createWebHistory } from 'vue-router';
import EcusPage from '@/features/ecus/pages/EcusPage.vue';
import RunsPage from '@/features/runs/pages/RunsPage.vue';
import TelemetryPage from '@/features/telemetry/pages/TelemetryPage.vue';

const routes = [
  {
    path: '/',
    redirect: '/ecus'
  },
  {
    path: '/ecus',
    name: 'ecus',
    component: EcusPage
  },
  {
    path: '/runs',
    name: 'runs',
    component: RunsPage
  },
  {
    path: '/runs/:runId/telemetry',
    name: 'telemetry',
    component: TelemetryPage,
    props: true
  },
  // Catch all redirect to ecus
  {
    path: '/:pathMatch(.*)*',
    redirect: '/ecus'
  }
];

const router = createRouter({
  history: createWebHistory(),
  routes
});

export default router;
