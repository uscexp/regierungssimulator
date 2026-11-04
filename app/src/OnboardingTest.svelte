<script lang="ts">
  /**
   * @staatslenker/app OnboardingTest — Onboarding-Test für neue Spieler (US-M5-11).
   *
   * Führt den Spieler durch die Grundlagen des Spiels mit interaktiven Fragen
   * und sofortigem Feedback. Nach erfolgreichem Abschluss gilt der Spieler als
   * eingewiesen und kann das Spiel normal starten.
   *
   * Der Adapter liest readonly Snapshots; die Onboarding-Komponente rendert nur.
   */
  export let state: UIState | undefined;
  export let onComplete: () => void = () => {};

  export let currentStep: number = 0;
  export let completed: boolean = false;
  export let score: number = 0;
  export let totalQuestions: number = 0;
  export let showFeedback: boolean = false;
  export let currentFeedback: string = '';

  const questions = [
    {
      id: 'indikatoren',
      question: 'Was stellen Indikatoren im Spiel dar?',
      options: [
        { id: 'a', text: 'Die Zufriedenheit der Bevölkerungsgruppen', correct: false },
        { id: 'b', text: 'Die wichtigsten staatlichen Kennzahlen (z.B. Wirtschaft, Gesundheit, Bildung)', correct: true },
        { tag: 'c', text: 'Die Höhe der Staatsschulden', correct: false },
        { id: 'd', text: 'Die Anzahl der Regierungsmitglieder', correct: false },
      ],
      explanation: 'Indikatoren messen den Zustand wichtiger Staatsbereiche wie Wirtschaft, Bildung, Gesundheit, Infrastruktur und Forschung. Sie liegen zwischen 0 und 100.',
    },
    {
      id: 'zufriedenheit',
      question: 'Wie wird die Zufriedenheit einer Bevölkerungsgruppe berechnet?',
      options: [
        { id: 'a', text: 'Durchschnitt aller Indikatoren', correct: false },
        { id: 'b', text: 'Gewichteter Durchschnitt der Indikatoren, die für die Gruppe wichtig sind', correct: true },
        { id: 'c', text: 'Nur der wichtigste Indikator', correct: false },
        { id: 'd', text: 'Zufällig', correct: false },
      ],
      explanation: 'Jede Gruppe gewichtet Indikatoren unterschiedlich (z.B. Arbeitnehmer gewichten Wirtschaft stark, Bildung_Jugend gewichtet Bildung stark). Die Zufriedenheit ist der gewichtete Durchschnitt.',
    },
    {
      id: 'legitimität',
      question: 'Was bedeutet Legitimität im Spiel?',
      options: [
        { id: 'a', text: 'Wie viel Geld der Staat hat', correct: false },
        { id: 'b', text: 'Wie sehr die Bevölkerung der Regierung vertraut', correct: true },
        { id: 'c', text: 'Wie viele Karten der Spieler hat', correct: false },
        { id: 'd', text': 'Wie viele Jahre die Regierung noch regiert', correct: false },
      ],
      explanation: 'Legitimität misst das Vertrauen der Bevölkerung in die Regierung. Sie steigt mit Zufriedenheit und Konstitutionstreue, sinkt mit Skandalen und Zensur. Bei zu niedriger Legitimität verliert die Regierung die Wahl.',
    },
    {
      id: 'kapital',
      question: 'Wofür wird Politisches Kapital (PK) verwendet?',
      options: [
        { id: 'a', text: 'Für den Kauf von Indikatoren', correct: false },
        { id: 'b', text: 'Für das Spielen von Entscheidungskarten', correct: true },
        { id: 'c', text: 'Für die Bezahlung von Steuern', correct: false },
        { id: 'd', text: 'Für die Deaktivierung von Gruppen', correct: false },
      ],
      explanation: 'Politisches Kapital (PK) ist der wichtigste Engpass im Spiel. Es wird benötigt, um Entscheidungskarten zu spielen. PK regeneriert sich jedes Jahr basierend auf der Legitimität.',
    },
    {
      id: 'entscheidungen',
      question: 'Was sind Entscheidungen im Spiel?',
      options: [
        { id: 'a', text': 'Karten, die der Spieler spielen kann', correct: false },
        { id: 'b', text': 'Konstitutionelle Grundentscheidungen mit dauerhaften Effekten', correct: true },
        { id: 'c', text': 'Tägliche Regierungsakte', correct: false },
        { id: 'd', text': 'Wahlversprechen', correct: false },
      ],
      explanation: 'Entscheidungen sind konstitutionelle Grundentscheidungen (z.B. Steuermodell, Bildungsreform) mit dauerhaften Effekten auf Indikatoren und Gruppen. Sie werden in der Setup-Phase gewählt.',
    },
  ];

  function getCurrentQuestion() {
    return questions[currentStep];
  }

  function answer(optionId: string) {
    const question = getCurrentQuestion();
    const option = question.options.find((o) => o.id === optionId);
    if (!option) return;

    showFeedback = true;
    currentFeedback = option.correct
      ? `Richtig! ${getExplanation(question.id)}`
      : `Falsch. ${getExplanation(question.id)}`;

    if (option.correct) {
      score++;
    }
    totalQuestions++;

    // Automatisch zur nächsten Frage nach kurzer Verzögerung
    setTimeout(() => {
      if (currentStep < questions.length - 1) {
        currentStep++;
        showFeedback = false;
        currentFeedback = '';
      } else {
        completed = true;
      }
    }, 2000);
  }

  function getExplanation(questionId: string): string {
    const explanations: Record<string, string> = {
      indikatoren: 'Indikatoren sind die wichtigsten staatlichen Kennzahlen zwischen 0 und 100.',
      zufriedenheit: 'Die Zufriedenheit ist der gewichtete Durchschnitt der Indikatoren, die für eine Gruppe wichtig sind.',
      legitimität: 'Legitimität misst das Vertrauen der Bevölkerung in die Regierung.',
      kapital: 'Politisches Kapital wird benötigt, um Entscheidungskarten zu spielen.',
      entscheidungen: 'Entscheidungen sind konstitutionelle Grundentscheidungen mit dauerhaften Effekten.',
    };
    return explanations[questionId] || '';
  }

  function farbe(wert: number): string {
    if (wert < 40) return '#dc2626';
    if (wert < 60) return '#eab308';
    return '#16a34a';
  }

  function farbeName(wert: number): string {
    if (wert < 40) return 'kritisch';
    if (wert < 60) return 'warnung';
    return 'gut';
  }
</script>

<div class="onboarding-test">
  <h1>Onboarding-Test (M5-11)</h1>
  <p>Willkommen beim Staatslenker! Bevor du starten kannst, testen wir dein Wissen über die Spielgrundlagen.</p>

  {#if completed}
    <div class="onboarding-complete">
      <h2>✅ Onboarding abgeschlossen!</h2>
      <div class="score">
        <span class="score-label">Dein Score:</span>
        <span class="score-value" style:color={farbe(score / totalQuestions * 100)}>
          ${score} / ${totalQuestions}
        </span>
      </div>
      <div class="procent">
        ${Math.round((score / totalQuestions) * 100)}% richtig
      </div>
      <button onclick={onComplete} class="start-button">
        Spiel starten
      </button>
    </div>
  {/else}
    <div class="question-card">
      <h2>Frage {currentStep + 1} von ${questions.length}</h2>
      <div class="progress-bar">
        <div class="progress-fill" style:width={((currentStep + 1) / questions.length) * 100 + '%'}></div>
      </div>
      <div class="question-text">{getCurrentQuestion().question}</div>
      <div class="options">
        {#each getCurrentQuestion().options as option}
          <button
            class="option-button"
            class:selected={showFeedback && option.id === selectedOptionId}
            class:correct={showFeedback && option.correct}
            class:incorrect={showFeedback && option.id === selectedOptionId && !option.correct}
            onclick={() => answer(option.id)}
          >
            {option.text}
          </button>
        {/each}
      </div>
      {#if showFeedback && currentFeedback}
        <div class="feedback" class:correct={selectedOptionCorrect}>
          {currentFeedback}
        </div>
      {/if}
    </div>
  {/if}
</div>

<style>
  .onboarding-test {
    font-family: system-ui, sans-serif;
    max-width: 700px;
    margin: 2rem auto;
    padding: 1rem;
  }

  .onboarding-test h1 {
    font-size: 1.75rem;
    color: #1e293b;
    margin-bottom: 1rem;
  }

  .onboarding-test p {
    font-size: 0.9rem;
    color: #64748b;
    margin-bottom: 1.5rem;
  }

  .question-card {
    background: #ffffff;
    border: 1px solid #e2e8f0;
    border-radius: 8px;
    padding: 1.5rem;
    margin-bottom: 1rem;
  }

  .question-card h2 {
    font-size: 1.1rem;
    color: #1e293b;
    margin: 0 0 1rem 0;
  }

  .progress-bar {
    width: 100%;
    height: 8px;
    background: #e2e8f0;
    border-radius: 4px;
    margin-bottom: 1rem;
    overflow: hidden;
  }

  .progress-fill {
    height: 100%;
    background: #3b82f6;
    transition: width 0.3s ease;
  }

  .question-text {
    font-size: 1rem;
    color: #334155;
    margin-bottom: 1rem;
    line-height: 1.4;
  }

  .options {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .option-button {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0.75rem 1rem;
    background: #f8fafc;
    border: 2px solid #e2e8f0;
    border-radius: 6px;
    cursor: pointer;
    font-size: 0.9rem;
    color: #334155;
    transition: all 0.2s ease;
  }

  .option-button:hover:not(:disabled) {
    background: #f1f5f9;
    border-color: #3b82f6;
  }

  .option-button.correct {
    background: #dcfce7;
    border-color: #22c55e;
    color: #166534;
  }

  .option-button.incorrect {
    background: #fef2f2;
    border-color: #f87171;
    color: #991b1b;
  }

  .option-button:disabled {
    cursor: not-allowed;
    opacity: 0.7;
  }

  .feedback {
    margin-top: 1rem;
    padding: 0.75rem;
    border-radius: 6px;
    font-size: 0.85rem;
  }

  .feedback.correct {
    background: #dcfce7;
    color: #166534;
    border: 1px solid #86efac;
  }

  .feedback:not(.correct) {
    background: #fef2f2;
    color: #991b1b;
    border: 1px solid #fecaca;
  }

  .onboarding-complete {
    text-align: center;
    padding: 2rem;
    background: #f8fafc;
    border: 1px solid #e2e8f0;
    border-radius: 8px;
  }

  .onboarding-complete h2 {
    color: #16a34a;
    margin-bottom: 1rem;
  }

  .score {
    display: flex;
    align-items: center;
    gap: 1rem;
    font-size: 1.5rem;
    font-weight: 600;
    margin-bottom: 0.5rem;
  }

  .score-label {
    color: #64748b;
  }

  .score-value {
    font-size: 1.75rem;
  }

  .procent {
    color: #64748b;
    margin-bottom: 1.5rem;
  }

  .start-button {
    padding: 0.75rem 1.5rem;
    background: #3b82f6;
    color: white;
    border: none;
    border-radius: 6px;
    cursor: pointer;
    font-weight: 600;
    font-size: 1rem;
  }

  .start-button:hover {
    background: #2563eb;
  }

  .start-button:active {
    background: #1d4ed8;
  }
</style>
