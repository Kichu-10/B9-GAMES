import { createRouter, createWebHistory } from "vue-router";
import App from "./App.vue";

const configuredAdminPath = String(import.meta.env.VITE_ADMIN_PANEL_PATH || "").trim();
const adminPath = configuredAdminPath
  ? (configuredAdminPath.startsWith("/") ? configuredAdminPath : `/${configuredAdminPath}`)
  : "/admin";

export const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: adminPath, component: () => import("./AdminApp.vue") },
    { path: "/", component: App },
    { path: "/games", component: App },
    { path: "/promotions", component: App },
    { path: "/wallet", redirect: { path: "/account", query: { section: "wallet" } } },
    { path: "/agent", component: () => import("./AgentApp.vue") },
    { path: "/account", component: App },
    { path: "/:pathMatch(.*)*", redirect: "/" },
  ],
});
