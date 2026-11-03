/**
 * @staatslenker/app pack-import — Pack-Import per Drag & Drop (US-M4-10, Annahme A-04).
 *
 * Lädt eine YAML-Pack-Datei über den Dateisystem-Zugriff des Browsers, validiert sie mit
 * `loadPack()` aus dem loader und registriert sie im `packManager`. Bei Erfolg wird das Pack
 * als inaktiv hinzugefügt und kann über den CLI aktiviert werden.
 */
import { loadPack, type PackLoadOutcome, packManager } from '@staatslenker/loader';

/** Ergebnis eines Pack-Import-Versuchs. */
export interface PackImportResult {
  readonly erfolgreich: boolean;
  readonly packName?: string;
  readonly meldung: string;
}

/**
 * Liest eine Datei als Text und gibt den Inhalt zurück.
 */
async function leseDateiAlsText(datei: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsText(datei, 'utf-8');
  });
}

/**
 * Validiert einen YAML-String als Pack und registriert ihn im packManager.
 * Gibt ein PackImportResult zurück — nie eine Ausnahme werfen.
 */
export function importierePackAusYamlString(
  yamlInhalt: string,
  dateiName: string,
): PackImportResult {
  const ergebnis: PackLoadOutcome = loadPack(yamlInhalt, dateiName);

  if ('error' in ergebnis) {
    return {
      erfolgreich: false,
      meldung: `Pack-Laden fehlgeschlagen: ${ergebnis.error}${
        ergebnis.zeile ? ` (Zeile ${ergebnis.zeile})` : ''
      }${ergebnis.datei ? ` (${ergebnis.datei})` : ''}`,
    };
  }

  const packErgebnis = packManager.ladePack(yamlInhalt, dateiName);
  if (!packErgebnis.erfolgreich) {
    return {
      erfolgreich: false,
      meldung: packErgebnis.meldung,
    };
  }

  return {
    erfolgreich: true,
    packName: ergebnis.pack.name,
    meldung: `Pack "${ergebnis.pack.name}" erfolgreich geladen (inaktiv). Über den CLI aktivierbar.`,
  };
}

/**
 * Importiert ein Pack aus einer Datei. Liest die Datei als Text und validiert mit
 * importierePackAusYamlString.
 */
export async function importierePackAusDatei(datei: File): Promise<PackImportResult> {
  let yamlInhalt: string;
  try {
    yamlInhalt = await leseDateiAlsText(datei);
  } catch (e) {
    return {
      erfolgreich: false,
      meldung: `Datei konnte nicht gelesen werden: ${e instanceof Error ? e.message : String(e)}`,
    };
  }

  return importierePackAusYamlString(yamlInhalt, datei.name);
}

/**
 * Richtet Drag & Drop auf einem DOM-Element ein. Bei erfolgreichem Import wird ein Callback
 * aufgerufen, der das Ergebnis anzeigen kann.
 */
export function richteDragDropEin(
  ziel: HTMLElement,
  beiErfolg: (ergebnis: PackImportResult) => void,
): () => void {
  const beiDragOver = (e: DragEvent) => {
    e.preventDefault();
    ziel.classList.add('drag-over');
  };

  const beiDragLeave = () => {
    ziel.classList.remove('drag-over');
  };

  const beiDrop = async (e: DragEvent) => {
    e.preventDefault();
    ziel.classList.remove('drag-over');

    const dateien = e.dataTransfer?.files;
    if (!dateien || dateien.length === 0) {
      beiErfolg({
        erfolgreich: false,
        meldung: 'Keine Datei abgelegt.',
      });
      return;
    }

    const datei = dateien[0]!;
    if (!datei.name.endsWith('.yaml') && !datei.name.endsWith('.yml')) {
      beiErfolg({
        erfolgreich: false,
        meldung: 'Nur YAML-Dateien (.yaml, .yml) sind zulässig.',
      });
      return;
    }

    const ergebnis = await importierePackAusDatei(datei);
    beiErfolg(ergebnis);
  };

  ziel.addEventListener('dragover', beiDragOver);
  ziel.addEventListener('dragleave', beiDragLeave);
  ziel.addEventListener('drop', beiDrop);

  return () => {
    ziel.removeEventListener('dragover', beiDragOver);
    ziel.removeEventListener('dragleave', beiDragLeave);
    ziel.removeEventListener('drop', beiDrop);
  };
}

/**
 * Rendert die minimale Drag & Drop UI für den Pack-Import.
 */
export function renderePackImportUI(container: HTMLElement): void {
  container.innerHTML = `
    <div style="font-family: system-ui, sans-serif; max-width: 600px; margin: 2rem auto; padding: 1rem;">
      <h1>Staatslenker — Pack-Import (M4-10)</h1>
      <p>Ziehe eine YAML-Pack-Datei hierher oder klicke zum Auswählen.</p>

      <div id="drop-zone"
           style="border: 2px dashed #64748b; border-radius: 8px; padding: 2rem; text-align: center; margin: 1rem 0; background: #f8fafc;">
        <p style="margin: 0; color: #475569;">Drag & Drop Bereich</p>
        <p style="margin: 0.5rem 0 0; font-size: 0.9rem; color: #64748b;">.yaml oder .yml</p>
        <input type="file" id="datei-input" accept=".yaml,.yml" style="display: none;" />
      </div>

      <div id="ergebnis" style="margin: 1rem 0; padding: 1rem; border-radius: 4px; display: none;"></div>

      <p style="margin-top: 1rem; font-size: 0.85rem; color: #64748b;">
        Geladene Packs sind zunächst inaktiv. Über den CLI (<code>--pack-enable &lt;name&gt;</code>)
        können sie aktiviert werden.
      </p>
    </div>
  `;

  const dropZone = container.querySelector('#drop-zone') as HTMLElement;
  const dateiInput = container.querySelector('#datei-input') as HTMLInputElement;
  const ergebnisDiv = container.querySelector('#ergebnis') as HTMLDivElement;

  // Klick auf Drop-Zone öffnet Datei-Dialog
  dropZone.addEventListener('click', () => dateiInput.click());

  // Datei-Auswahl über Dialog
  dateiInput.addEventListener('change', async () => {
    const datei = dateiInput.files?.[0];
    if (!datei) return;

    const ergebnis = await importierePackAusDatei(datei);
    zeigeErgebnis(ergebnisDiv, ergebnis);
    dateiInput.value = '';
  });

  // Drag & Drop
  richteDragDropEin(dropZone, (ergebnis) => {
    zeigeErgebnis(ergebnisDiv, ergebnis);
  });
}

function zeigeErgebnis(container: HTMLDivElement, ergebnis: PackImportResult): void {
  container.style.display = 'block';
  container.style.background = ergebnis.erfolgreich ? '#dcfce7' : '#fee2e2';
  container.style.color = ergebnis.erfolgreich ? '#166534' : '#991b1b';
  container.style.padding = '1rem';
  container.style.borderRadius = '4px';
  container.style.margin = '1rem 0';
  container.innerHTML = `
    <p style="margin: 0; font-weight: 600;">
      ${ergebnis.erfolgreich ? '✅ Erfolg' : '❌ Fehler'}
    </p>
    <p style="margin: 0.5rem 0 0;">${ergebnis.meldung}</p>
    ${ergebnis.packName ? `<p style="margin: 0.5rem 0 0; font-size: 0.85rem;">Pack: ${ergebnis.packName}</p>` : ''}
  `;
}