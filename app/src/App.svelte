<script lang="ts">
  /** @staatslenker/app App — Container mit Setup → Dashboard Flow (US-M5-02).
   *
   * Zeigt zuerst das Setup-UI. Nach Abschluss wird das Dashboard mit dem
   * Setup-Ergebnis montiert.
   */
  import { $state } from 'svelte';

  import SetupUI from './SetupUI.svelte';
  import GaugeDashboard from './GaugeDashboard.svelte';
  import type { UIState } from './ui-adapter.js';

  let uiState: UIState | undefined = $state(undefined);

  function onAbschluss(neuerState: UIState) {
    uiState = neuerState;
  }
</script>

{#if uiState === undefined}
  <SetupUI onAbschluss={onAbschluss} />
{:else}
  <GaugeDashboard key={uiState.jahr} state={uiState} />
{/if}
