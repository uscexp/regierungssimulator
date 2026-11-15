/**
 * @staatslenker/app main — Svelte 5 + Vite Einstieg (M5).
 *
 * Mountet die App-Komponente. Zeigt zuerst das Setup-UI (Regierungsform +
 * Konstitution, US-M5-02). Nach Abschluss wird das Dashboard mit dem
 * Setup-Ergebnis montiert.
 */
import { mount } from 'svelte';
import App from './App.svelte';

mount(App, { target: document.getElementById('app')! });
