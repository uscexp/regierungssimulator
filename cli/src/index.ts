/**
 * @staatslenker/cli — der Einstieg für M0: Terminal-Loop (US-M0-14/15) und AutoSim-Harness (US-M0-17).
 *
 * Dieses Modul ist nur der Einstieg: Flag-Parsing, Boot-Report und der Loop liegen in
 * `cli-options.ts`, damit der Einstieg beim Import keinen Seiteneffekt hat und das Parsing testbar
 * ist. Der CLI importiert den Kern und sendet Actions; er berechnet keine eigene Simulation (ADR-002).
 * Mit TTY spielt er den Loop interaktiv; ohne TTY (CI-Boot) führt er eine kurze, deterministische
 * Demonstration aus — das Quality-Gate "ein Build bootet und ist spielbar" ist damit ein echter
 * Turn, nicht nur ein Import-Check.
 */
import { main } from '@staatslenker/cli/cli-options';

// Der Exit-Code kommt von `main`: ungültige Flags enden mit 1, ein gespielter Loop mit 0.
process.exitCode = await main(process.argv.slice(2));
