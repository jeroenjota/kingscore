<script setup>
const emit = defineEmits(["close-help"]);

const negativeRules = [
  "Harten: -30 per hartenkaart",
  "Slagen: -50 per slag",
  "Laatste 2 slagen: -140 per slag",
  "Mannen: -60 per boer/heer",
  "Vrouwen: -100 per vrouw",
  "Hartenheer: -400 als je hem krijgt",
];
</script>

<template>
  <section
    class="mx-auto mt-8 w-full max-w-2xl rounded-xl border border-sky-600 bg-sky-50 p-3 shadow-sm">
    <div
      class="flex flex-wrap items-start justify-between gap-2 pb-1 text-sky-900">
      <div>
        <div class="flex items-center gap-4 text-sky-900">
          <h1 class="text-2xl font-bold text-sky-900">  
            Spelregels & Instructies
          </h1>
          <button
            type="button"
            class= "ml-auto rounded border border-sky-300 bg-white px-3 py-1 text-sm font-semibold text-sky-800 hover:bg-sky-50"
            @click="emit('close-help')">
            Terug naar lobby
          </button>
        </div>
        <p class="text-sm text-sky-800">
          Deze app is gemaakt om het bijhouden van scores bij het kaartspel
          <span class="font-semibold">Kingen</span> makkelijker te maken.
        </p>
      </div>
    </div>

    <div class="mt-1">
      <article class="rounded-lg border border-sky-200 bg-white p-3">
        <h2 class="text-normal font-semibold text-sky-900">Spelregels</h2>
        <p class="text-sm">Het spel <span class="font-semibold">Kingen</span> wordt in vele varianten gespeeld, deze variant werkt alsvolgt:</p>
        <ul class="mt-2 list-disc space-y-1 pl-3 text-sm">
        <li>Er worden in totaal 20 spellen gespeeld met een vol dek, 52 kaarten, zonder jokers.<br />  Er zijn vier spelers. Om de beurt delen de spelers alle kaarten. <br />De speler na de deler kiest een van de mogelijke spelsoorten </li>
        <li>Er zijn 6 spelsoorten met strafpunten, die elk 2 keer worden gespeeld en daarnaast moet er in totaal 8 keer troef worden gemaakt, wat punten oplevert.</li>
        <li>Elke speler moet drie keer een 'negatieve' en twee keer een 'positieve' spelsoort kiezen</li>
        <li>De punten zijn zo verdeeld dat aan het eind van het spel de totale score precies 0 is.</li>
        <li>Spelers met een positieve score ontvangen van de spelers met een negatieve score een vooraf afgesproken beloning (de eer, een drankje, geld, etc.). </li>
        </ul>
        <p class="mt-2 text-xs">Bij twee positieve spelers krijgt elk een beloning van één van de 'negatieve' spelers. Als er één speler is met negatieve eindstand, moet deze drie beloningen uitkeren; als er één speler is met een postitieve eindstand ontvangt deze drie beloningen. <br /> Theoretisch kan iedereen op 0 uitkomen, maar die kans is minimaal.</p>
      </article>
      <article class="rounded-lg border border-sky-200 bg-white p-3">
        <h2 class="text-lg font-semibold text-sky-900">Instructies voor gebruik</h2>
        <ol class="list-decimal space-y-1 pl-5 text-sm text-sky-900">
          <li>Voer eventueel spelersnamen in in de lobby.</li>
          <li>Klik op "Start als Gastheer".</li>
          <li>De gastheer vult als enige de scores in.</li>
          <li>In het score scherm is een knop voor een QR-code</li>
          <li>De andere spelers (of gasten) kunnen met behulp van de link in de QR-code de scores op hun eigen telefoon zien.</li>
        </ol>
       <h2 class="mt-2 text-lg font-semibold text-sky-900">Scores invullen</h2>
        <ul class="list-disc space-y-1 pl-5 text-sm text-sky-900">
          <li>Check onder de naam van de speler de betreffende spelkeuze, de mogelijke keuzes zijn lichtgeel gemarkeerd.</li>
          <li>Na afloop van de ronde vult de gastheer voor elke speler de scores in, mbv de keuzelijst (als alles is ingevuld, wordt de regel lichtgroen)</li>
          <li>De app houdt bij wat er al gekozen is en berekent punten automatisch.</li>
        </ul>
      </article>

      <article
        class="rounded-lg border border-sky-200 bg-white p-3 md:col-span-2">
        <h2 class="text-lg font-semibold text-sky-900">Puntverdeling</h2>
        <p class="text-sm text-sky-900">
          In de 12 negatieve rondes zijn er verschillende manieren om strafpunten te krijgen:
        </p>
        <ul
          class="grid list-disc gap-1 pl-3 text-sm text-sky-900 md:grid-cols-2">
          <li v-for="rule in negativeRules" :key="rule">{{ rule }}</li>
        </ul>
        <p class="mt-2 text-sm text-sky-900">
          In de 8 troefrondes telt elke gewonnen slag voor 50 punten.
        </p>
      </article>
    </div>
  </section>
</template>
