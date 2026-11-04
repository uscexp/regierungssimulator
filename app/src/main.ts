/**
 * @staatslenker/app main — Svelte 5 + Vite Einstieg (M5).
 *
 * Mountet die Dashboard-App. Der UI-Adapter liest readonly Snapshots aus dem
 * Spielkern und sendet Actions zurück. Keine eigene Simulation in der UI.
 */
import GaugeDashboard from './GaugeDashboard.svelte';
import { mount } from 'svelte';

mount(GaugeDashboard, { target: document.getElementById('app')! });
